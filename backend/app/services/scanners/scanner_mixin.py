"""Tenant/claim-bound lifecycle; no adapter may write a terminal row twice.

External binaries resolve their own names and may discover additional targets.
SENTINEL_SCANNER_EGRESS_ISOLATED=1 is an operator acknowledgement, not an
application sandbox. Enforce network/filesystem isolation outside this process.
"""
import os
from datetime import datetime
from app.models.scan import Scan
from app.models.website import Website
from app.utils.destination import validate_destination
from app.utils.scanner_utils import redact_text, redact_data


class ScannerJobMixin:
    def begin_job(self, scan_id, worker_id=None):
        from app.database.database import SessionLocal
        if not worker_id:
            return None, None
        bootstrap = SessionLocal()
        try:
            bootstrap.info['system_scope'] = True
            row = bootstrap.query(Scan.organization_id).filter(
                Scan.id == scan_id, Scan.worker_id == worker_id, Scan.status == 'Running').first()
            organization_id = row[0] if row else None
        finally:
            bootstrap.close()
        if organization_id is None:
            return None, None
        db = SessionLocal()
        db.info['organization_id'] = organization_id
        scan = db.query(Scan).filter(Scan.id == scan_id, Scan.worker_id == worker_id,
                                     Scan.status == 'Running').first()
        if scan is None:
            db.close()
            return None, None
        try:
            website = db.query(Website).filter(Website.id == scan.website_id).first()
            if (not website or not website.verified or website.url != scan.target
                    or website.verified_target != scan.target):
                raise ValueError('Verified website target no longer matches the job.')
            destination = validate_destination(scan.target)
            if set(destination.addresses) != set(website.verified_addresses or []):
                raise ValueError('Destination addresses changed; ownership must be verified again.')
            if scan.engine != 'ssl' and os.getenv('SENTINEL_SCANNER_EGRESS_ISOLATED') != '1':
                raise ValueError('External scanner requires operator-configured egress isolation.')
        except ValueError:
            self.fail_job(db, scan, 'Destination authorization or isolation validation failed; reverify ownership and operator isolation.')
            db.close()
            return None, None
        return db, scan

    def _query(self, db, scan):
        return db.query(Scan).filter(Scan.id == scan.id, Scan.organization_id == scan.organization_id,
                                    Scan.worker_id == scan.worker_id, Scan.status == 'Running')

    def set_command(self, db, scan, command):
        # Never persist command arguments, targets' query strings or local binary paths.
        changed = self._query(db, scan).update({'command': scan.engine + ' (operator configured)',
                                              'heartbeat_at': datetime.utcnow()}, synchronize_session=False)
        db.commit()
        if not changed:
            raise ValueError('Job is no longer running.')

    def complete_job(self, db, scan, *, findings, risk_score, raw_output, parsed_output, truncated=False, **unused):
        import json
        if truncated or parsed_output.get('parse_error'):
            self.fail_job(db, scan, 'Scanner output is incomplete or invalid.', raw_output=raw_output,
                          truncated=truncated)
            return
        if len(json.dumps(parsed_output)) > 200000:
            self.fail_job(db, scan, 'Parsed output exceeded the storage limit.', truncated=True)
            return
        self._query(db, scan).update({
            'status': 'Completed', 'findings': max(0, findings), 'risk_score': min(100, max(0, risk_score)),
            'raw_output': redact_text(raw_output, 50000), 'parsed_output': redact_data(parsed_output),
            'completed_at': datetime.utcnow(), 'heartbeat_at': None, 'version': Scan.version + 1,
        }, synchronize_session=False)
        db.commit()

    def fail_job(self, db, scan, error, *, raw_output=None, truncated=False, parsed_output=None):
        db.rollback()
        values = {'status': 'Failed', 'error': redact_text(error), 'completed_at': datetime.utcnow(),
                  'heartbeat_at': None, 'version': Scan.version + 1, 'truncated': bool(truncated)}
        if raw_output is not None:
            values['raw_output'] = redact_text(raw_output, 50000)
        if parsed_output is not None:
            values['parsed_output'] = redact_data(parsed_output)
            values['findings'] = len(parsed_output.get('findings', []))
            values['risk_score'] = 15 if values['findings'] else 0
        self._query(db, scan).update(values, synchronize_session=False)
        db.commit()

    def missing_binary_error(self, engine):
        return 'Configure the absolute operator binary path in SENTINEL_SCANNER_BIN_' + engine.upper() + '.'

    def is_cancelled(self, db, scan):
        from app.services.scanner_worker import stopping
        if stopping():
            return True
        changed = self._query(db, scan).update({'heartbeat_at': datetime.utcnow()}, synchronize_session=False)
        db.commit()
        return not changed
