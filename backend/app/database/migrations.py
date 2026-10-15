"""Explicit, additive schema migration. Importing this module never connects to a DB.

Callers of migrate() are responsible for an external, verified backup and for
stopping writers. The CLI requires an explicit backup acknowledgement.
"""
from __future__ import annotations

import argparse
from datetime import datetime
from importlib import import_module
import json
import os
from pathlib import Path

from sqlalchemy import (
    Boolean, Column, DateTime, Integer, MetaData, Table, create_engine,
    func, inspect, select, update,
)
from sqlalchemy.schema import AddConstraint

from app.database.base import Base

SCHEMA_VERSION = 7
MODEL_MODULES = (
    "user", "organization", "organization_member", "session", "password_reset_token",
    "website", "enrollment_token", "integration", "event", "log", "alert", "incident", "scan",
    "settings", "response_action", "incident_evidence", "incident_note",
    "incident_timeline", "scan_result", "audit_log", "ai_analysis_job",
    "scanner_finding", "scanner_finding_observation", "investigation", "investigation_job",
)
ROOTS = {
    "website": "websites", "enrollment_token": "enrollment_tokens", "log": "logs", "alert": "alerts",
    "incident": "incidents", "settings": "settings",
}
TENANT_TABLES = (
    "websites", "enrollment_tokens", "integrations", "events", "logs", "alerts", "incidents", "scans",
    "settings", "response_actions", "incident_evidence", "incident_notes",
    "incident_timeline", "scan_results", "ai_analysis_jobs",
    "scanner_findings", "scanner_finding_observations", "investigations", "investigation_jobs",
)

_version_metadata = MetaData()
_versions = Table(
    "sentinel_schema_versions", _version_metadata,
    Column("version", Integer, primary_key=True),
    Column("applied_at", DateTime, nullable=False),
)


class SchemaMismatchError(RuntimeError):
    """The database is not ready for this application; run explicit migration."""


class OwnershipMappingError(ValueError):
    """An operator mapping is malformed, unresolved, or contradicts a parent."""


def _tables():
    # Explicit model allowlist; never import database.py, main.py, or scanners.
    for module in MODEL_MODULES:
        import_module(f"app.models.{module}")
    names = set(TENANT_TABLES) | {
        "users", "organizations", "organization_members", "sessions",
        "password_reset_tokens", "audit_logs",
    }
    return [table for table in Base.metadata.sorted_tables if table.name in names]


def _positive_id(value):
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise OwnershipMappingError("IDs must be positive integers")
    if isinstance(value, str) and (not value.isascii() or not value.isdigit()):
        raise OwnershipMappingError("IDs must be positive integers")
    value = int(value)
    if value < 1:
        raise OwnershipMappingError("IDs must be positive integers")
    return value


def _normalize_mapping(mapping):
    if mapping is None:
        return {}
    if not isinstance(mapping, dict):
        raise OwnershipMappingError("Mapping must be a JSON object")
    normalized = {}
    for root, entries in mapping.items():
        if root not in ROOTS or not isinstance(entries, dict):
            raise OwnershipMappingError(f"Unknown root {root!r}; expected one of: {', '.join(sorted(ROOTS))}")
        normalized[ROOTS[root]] = {}
        for row_id, org_id in entries.items():
            row_id, org_id = _positive_id(row_id), _positive_id(org_id)
            if row_id in normalized[ROOTS[root]]:
                raise OwnershipMappingError("Duplicate normalized row ID")
            normalized[ROOTS[root]][row_id] = org_id
    return normalized


def _ownership_plan(conn, tables, mapping):
    """Validate against existing data BEFORE DDL; use only declared FK edges.

    No URL, IP, display-name, assignee, user, or organization-1 guesses. Multiple
    parent links must all resolve to the same known tenant before inference.
    """
    inspector = inspect(conn)
    existing = set(inspector.get_table_names())
    by_name = {table.name: table for table in tables}
    orgs = set()
    if "organizations" in existing:
        orgs = set(conn.execute(select(by_name["organizations"].c.id)).scalars())
    rows, edges, original = {}, {}, {}
    for name in TENANT_TABLES:
        table = by_name[name]
        links = [
            (fk.parent.name, fk.column.table.name)
            for fk in table.foreign_keys if fk.column.table.name in TENANT_TABLES
        ]
        edges[name] = links
        rows[name] = {}
        if name not in existing:
            continue
        available = {col["name"] for col in inspector.get_columns(name)}
        wanted = {"id", "organization_id"} | {col for col, _ in links}
        columns = [table.c[col] for col in sorted(wanted & available)]
        if "id" not in available:
            raise SchemaMismatchError(f"Existing table {name} has no id; manual review required")
        for row in conn.execute(select(*columns)).mappings():
            data = dict(row)
            data.setdefault("organization_id", None)
            for col, _ in links:
                data.setdefault(col, None)
            if data["organization_id"] is not None and data["organization_id"] not in orgs:
                raise OwnershipMappingError(f"{name} id={data['id']} references an unknown organization")
            rows[name][data["id"]] = data
            original[(name, data["id"])] = data["organization_id"]
    for name, entries in mapping.items():
        for row_id, org_id in entries.items():
            if org_id not in orgs:
                raise OwnershipMappingError(f"Unknown organization id={org_id}")
            if row_id not in rows[name]:
                raise OwnershipMappingError(f"Unknown {name} id={row_id}")
            current = rows[name][row_id]["organization_id"]
            if current is not None and current != org_id:
                raise OwnershipMappingError(f"Mapping contradicts existing {name} id={row_id}")
            rows[name][row_id]["organization_id"] = org_id
    changed = True
    while changed:
        changed = False
        for name, entries in rows.items():
            for row_id, row in entries.items():
                parent_orgs = []
                unresolved = False
                for column, parent in edges[name]:
                    if row[column] is None:
                        continue
                    parent_row = rows[parent].get(row[column])
                    if parent_row is None or parent_row["organization_id"] is None:
                        unresolved = True
                    else:
                        parent_orgs.append(parent_row["organization_id"])
                known = set(parent_orgs)
                if row["organization_id"] is not None:
                    known.add(row["organization_id"])
                if len(known) > 1:
                    raise OwnershipMappingError(f"Contradictory tenant links on {name} id={row_id}")
                if row["organization_id"] is None and parent_orgs and not unresolved:
                    row["organization_id"] = parent_orgs[0]
                    changed = True
    assignments = [
        (name, row_id, row["organization_id"])
        for name, entries in rows.items() for row_id, row in entries.items()
        if original[(name, row_id)] is None and row["organization_id"] is not None
    ]
    quarantined = {
        name: sum(row["organization_id"] is None for row in entries.values())
        for name, entries in rows.items()
    }
    return assignments, quarantined


def _safe_default(column):
    # Only known scalar numeric/boolean/string defaults are backfilled. In particular,
    # never fabricate historical timestamps, secrets, users, or tenant IDs.
    if column.name == "organization_id" or column.foreign_keys:
        return None
    if isinstance(column.type, (Integer, Boolean)):
        if column.default is not None and column.default.is_scalar:
            value = column.default.arg
            if isinstance(value, (bool, int)):
                return str(int(value))
    if column.server_default is not None:
        arg = column.server_default.arg
        if hasattr(arg, "text"):
            arg = arg.text
        if isinstance(arg, str):
            if (arg.startswith("'") and arg.endswith("'")) or (arg.startswith('"') and arg.endswith('"')):
                return arg
            return f"'{arg}'"
    if column.default is not None and column.default.is_scalar:
        value = column.default.arg
        if isinstance(value, str):
            if (value.startswith("'") and value.endswith("'")) or (value.startswith('"') and value.endswith('"')):
                return value
            return f"'{value}'"
    return None


def _add_column(conn, table, column):
    if column.primary_key:
        raise SchemaMismatchError(f"Cannot add primary key {table.name}.{column.name} additively")
    quote = conn.dialect.identifier_preparer.quote
    # All identifiers originate in the explicit model allowlist, not operator JSON.
    definition = f"{quote(column.name)} {column.type.compile(dialect=conn.dialect)}"
    default = _safe_default(column)
    if default is not None:
        definition += f" DEFAULT {default}"
        if not column.nullable:
            definition += " NOT NULL"
    else:
        definition += " NULL"
    if conn.dialect.name == "sqlite":
        for fk in column.foreign_keys:
            definition += (
                f" REFERENCES {quote(fk.column.table.name)} ({quote(fk.column.name)})"
            )
            if fk.ondelete:
                # ondelete is fixed by trusted model metadata.
                definition += f" ON DELETE {fk.ondelete}"
    conn.exec_driver_sql(f"ALTER TABLE {quote(table.name)} ADD COLUMN {definition}")
    if conn.dialect.name == "mysql":
        for fk in column.foreign_keys:
            conn.execute(AddConstraint(fk.constraint))


def _schema_problems(conn, tables, require_version=True):
    inspector = inspect(conn)
    existing = set(inspector.get_table_names())
    problems = []
    for table in tables:
        if table.name not in existing:
            problems.append(f"missing table {table.name}")
            continue
        actual = {col["name"]: col for col in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name not in actual:
                problems.append(f"missing column {table.name}.{column.name}")
                continue
            kind = actual[column.name]["type"]
            # SQLite reflects JSON/Boolean as their declared types. MySQL may
            # represent JSON as LONGTEXT on MariaDB (MariaDB is not supported).
            if kind._type_affinity is not column.type._type_affinity:
                if not (conn.dialect.name == "mysql" and isinstance(column.type, Boolean)
                        and isinstance(kind, Integer)):
                    problems.append(f"incompatible type {table.name}.{column.name}")
            expected_length = getattr(column.type, "length", None)
            actual_length = getattr(kind, "length", None)
            if expected_length and actual_length and actual_length < expected_length:
                problems.append(f"short column {table.name}.{column.name}")
        indexes = {index["name"] for index in inspector.get_indexes(table.name)}
        for index in table.indexes:
            if index.name not in indexes:
                problems.append(f"missing index {index.name}")
    if require_version:
        if _versions.name not in existing:
            problems.append("migration version table missing")
        else:
            versions = set(conn.execute(select(_versions.c.version)).scalars())
            if SCHEMA_VERSION not in versions:
                problems.append(f"migration version {SCHEMA_VERSION} not applied")
            if any(version > SCHEMA_VERSION for version in versions):
                problems.append("database schema is newer than this application")
    return problems


def check_schema(engine):
    """Read-only readiness guard. Return None or raise SchemaMismatchError.

    Call before request sessions/startup. Never creates tables, alters data, or
    imports the application's configured engine. A nullable legacy owner is
    intentionally schema-compatible but must be denied by authorization.
    """
    with engine.connect() as conn:
        problems = _schema_problems(conn, _tables())
    if problems:
        raise SchemaMismatchError(
            "Database requires operator migration (python -m app.database.migrations): "
            + "; ".join(problems)
        )


def _legacy_constraint_notes(conn, tables):
    inspector = inspect(conn)
    notes = []
    for table in tables:
        actual_columns = {col["name"]: col for col in inspector.get_columns(table.name)}
        actual_fks = inspector.get_foreign_keys(table.name)
        for col in table.columns:
            if col.nullable != actual_columns[col.name]["nullable"] and not col.primary_key:
                notes.append(f"{table.name}.{col.name}: legacy nullability retained")
        for fk in table.foreign_keys:
            found = any(
                info["constrained_columns"] == [fk.parent.name]
                and info["referred_table"] == fk.column.table.name
                and info["referred_columns"] == [fk.column.name]
                and (info.get("options", {}).get("ondelete") or "NO ACTION").upper()
                    == (fk.ondelete or "NO ACTION").upper()
                for info in actual_fks
            )
            if not found:
                notes.append(f"{table.name}.{fk.parent.name}: legacy FK/delete policy requires manual review")
    return notes


def migrate(engine, ownership_mapping=None):
    """Apply repeatable additive changes to the explicitly provided engine.

    Prerequisite: operator verified an external backup and stopped all writers.
    Does NOT make a backup. SQLite and MySQL only; MySQL DDL can auto-commit.
    Returns version, added_columns, ownership_assignments, quarantined, and
    legacy_constraints. Existing types/constraints/timestamps are never rewritten.
    """
    if engine.dialect.name not in {"sqlite", "mysql"}:
        raise ValueError("Only SQLite and MySQL migrations are supported")
    mapping = _normalize_mapping(ownership_mapping)
    tables = _tables()
    with engine.begin() as conn:
        inspector = inspect(conn)
        existing = set(inspector.get_table_names())
        if _versions.name in existing:
            versions = set(conn.execute(select(_versions.c.version)).scalars())
            if any(version > SCHEMA_VERSION for version in versions):
                raise SchemaMismatchError("Refusing migration of a newer schema")
        assignments, quarantined = _ownership_plan(conn, tables, mapping)
        # Validate missing primary keys before making any changes.
        for table in tables:
            if table.name in existing:
                names = {col["name"] for col in inspector.get_columns(table.name)}
                if any(col.primary_key and col.name not in names for col in table.columns):
                    raise SchemaMismatchError(f"Manual primary-key repair required: {table.name}")
        # Explicit migration only. create_all adds missing tables; never recreates.
        Base.metadata.create_all(conn, tables=tables, checkfirst=True)
        added = []
        for table in tables:
            names = {col["name"] for col in inspect(conn).get_columns(table.name)}
            for column in table.columns:
                if column.name not in names:
                    _add_column(conn, table, column)
                    added.append(f"{table.name}.{column.name}")
            if table.name == "websites":
                w_indexes = {idx["name"]: idx for idx in inspect(conn).get_indexes(table.name)}
                if "ix_websites_url" in w_indexes and w_indexes["ix_websites_url"].get("unique"):
                    if conn.dialect.name == "sqlite":
                        conn.exec_driver_sql("DROP INDEX IF EXISTS ix_websites_url")
                    elif conn.dialect.name == "mysql":
                        conn.exec_driver_sql("DROP INDEX ix_websites_url ON websites")
            if table.name == "integrations":
                i_indexes = {idx["name"]: idx for idx in inspect(conn).get_indexes(table.name)}
                if "ix_integrations_website_id" in i_indexes and i_indexes["ix_integrations_website_id"].get("unique"):
                    if conn.dialect.name == "sqlite":
                        conn.exec_driver_sql("DROP INDEX IF EXISTS ix_integrations_website_id")
                    elif conn.dialect.name == "mysql":
                        conn.exec_driver_sql("DROP INDEX ix_integrations_website_id ON integrations")
                conn.execute(
                    update(table).where(
                        table.c.name.is_(None)
                    ).values(name="Legacy integration")
                )
            if table.name == "enrollment_tokens":
                col_info = {c["name"]: c for c in inspect(conn).get_columns(table.name)}
                if "website_id" in col_info and not col_info["website_id"]["nullable"]:
                    if conn.dialect.name == "sqlite":
                        conn.exec_driver_sql("PRAGMA foreign_keys = OFF")
                        conn.exec_driver_sql("""
                            CREATE TABLE enrollment_tokens_temp (
                                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                                website_id INTEGER,
                                token_hash VARCHAR(64) NOT NULL,
                                token_prefix VARCHAR(16) NOT NULL,
                                label VARCHAR(100),
                                created_by_user_id INTEGER,
                                expires_at DATETIME NOT NULL,
                                max_uses INTEGER NOT NULL,
                                used_count INTEGER NOT NULL,
                                revoked_at DATETIME,
                                last_used_at DATETIME,
                                created_at DATETIME NOT NULL,
                                organization_id INTEGER,
                                CONSTRAINT ck_enrollment_tokens_max_uses CHECK (max_uses >= 1 AND max_uses <= 50),
                                CONSTRAINT ck_enrollment_tokens_used_count CHECK (used_count >= 0 AND used_count <= max_uses),
                                FOREIGN KEY(website_id) REFERENCES websites (id) ON DELETE CASCADE,
                                FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
                                FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
                            )
                        """)
                        conn.exec_driver_sql("""
                            INSERT INTO enrollment_tokens_temp (
                                id, website_id, token_hash, token_prefix, label,
                                created_by_user_id, expires_at, max_uses, used_count,
                                revoked_at, last_used_at, created_at, organization_id
                            )
                            SELECT id, website_id, token_hash, token_prefix, label,
                                   created_by_user_id, expires_at, max_uses, used_count,
                                   revoked_at, last_used_at, created_at, organization_id
                            FROM enrollment_tokens
                        """)
                        conn.exec_driver_sql("DROP TABLE enrollment_tokens")
                        conn.exec_driver_sql("ALTER TABLE enrollment_tokens_temp RENAME TO enrollment_tokens")
                        conn.exec_driver_sql("CREATE UNIQUE INDEX ix_enrollment_tokens_token_hash ON enrollment_tokens (token_hash)")
                        conn.exec_driver_sql("CREATE INDEX ix_enrollment_tokens_organization_id ON enrollment_tokens (organization_id)")
                        conn.exec_driver_sql("CREATE INDEX ix_enrollment_tokens_id ON enrollment_tokens (id)")
                        conn.exec_driver_sql("CREATE INDEX ix_enrollment_tokens_website_id ON enrollment_tokens (website_id)")
                        conn.exec_driver_sql("PRAGMA foreign_keys = ON")
                    elif conn.dialect.name == "mysql":
                        conn.exec_driver_sql("ALTER TABLE enrollment_tokens MODIFY COLUMN website_id INT NULL")
            names = {index["name"] for index in inspect(conn).get_indexes(table.name)}

            for index in sorted(table.indexes, key=lambda item: item.name):
                if index.name not in names:
                    index.create(conn)
        problems = _schema_problems(conn, tables, require_version=False)
        if problems:
            raise SchemaMismatchError("Manual schema review required: " + "; ".join(problems))
        by_name = {table.name: table for table in tables}
        for name, row_id, org_id in assignments:
            table = by_name[name]
            # Core update invokes Python onupdate defaults unless overridden;
            # explicitly preserve every historical onupdate timestamp.
            values = {"organization_id": org_id}
            values.update({col.name: col for col in table.columns if col.onupdate is not None})
            conn.execute(update(table).where(
                table.c.id == row_id, table.c.organization_id.is_(None)
            ).values(**values))
        _versions.create(conn, checkfirst=True)
        existing_versions = set(conn.execute(select(_versions.c.version)).scalars())
        if not existing_versions:
            conn.execute(_versions.insert().values(version=SCHEMA_VERSION, applied_at=datetime.utcnow()))
        else:
            for v in range(max(existing_versions) + 1, SCHEMA_VERSION + 1):
                conn.execute(_versions.insert().values(version=v, applied_at=datetime.utcnow()))
        notes = _legacy_constraint_notes(conn, tables)
    return {
        "version": SCHEMA_VERSION, "added_columns": added,
        "ownership_assignments": len(assignments), "quarantined": quarantined,
        "legacy_constraints": notes,
    }


def downgrade_phase1(engine):
    """Downgrade schema from Phase 1 to Phase 0.

    Re-adds global uniqueness on websites.url. Refuses if duplicate URLs exist.
    """
    with engine.begin() as conn:
        inspector = inspect(conn)
        if "websites" not in inspector.get_table_names():
            return
        w_table = [t for t in _tables() if t.name == "websites"][0]
        duplicates = conn.execute(
            select(w_table.c.url)
            .group_by(w_table.c.url)
            .having(func.count(w_table.c.url) > 1)
        ).scalars().all()
        if duplicates:
            raise SchemaMismatchError(
                f"Cannot downgrade: duplicate URLs exist across organizations: {', '.join(duplicates)}"
            )
        if conn.dialect.name == "sqlite":
            conn.exec_driver_sql("DROP INDEX IF EXISTS ix_websites_org_url_active")
            conn.exec_driver_sql("DROP INDEX IF EXISTS ix_websites_url")
            conn.exec_driver_sql("CREATE UNIQUE INDEX ix_websites_url ON websites (url)")
        elif conn.dialect.name == "mysql":
            w_indexes = {idx["name"]: idx for idx in inspector.get_indexes("websites")}
            if "ix_websites_org_url_active" in w_indexes:
                conn.exec_driver_sql("DROP INDEX ix_websites_org_url_active ON websites")
            if "ix_websites_url" in w_indexes:
                conn.exec_driver_sql("DROP INDEX ix_websites_url ON websites")
            conn.exec_driver_sql("CREATE UNIQUE INDEX ix_websites_url ON websites (url)")
        if _versions.name in inspector.get_table_names():
            conn.execute(_versions.delete().where(_versions.c.version >= 2))


def downgrade_phase2(engine):
    """Downgrade schema from Phase 2 to Phase 1.

    Re-adds uniqueness on integrations.website_id. Refuses if any website has >1 integration.
    """
    with engine.begin() as conn:
        inspector = inspect(conn)
        if "integrations" not in inspector.get_table_names():
            return
        i_table = [t for t in _tables() if t.name == "integrations"][0]
        duplicates = conn.execute(
            select(i_table.c.website_id)
            .group_by(i_table.c.website_id)
            .having(func.count(i_table.c.website_id) > 1)
        ).scalars().all()
        if duplicates:
            raise SchemaMismatchError(
                f"Cannot downgrade: websites have multiple integrations: {', '.join(str(d) for d in duplicates)}"
            )
        if conn.dialect.name == "sqlite":
            conn.exec_driver_sql("DROP INDEX IF EXISTS ix_integrations_website_id")
            conn.exec_driver_sql("CREATE UNIQUE INDEX ix_integrations_website_id ON integrations (website_id)")
        elif conn.dialect.name == "mysql":
            i_indexes = {idx["name"]: idx for idx in inspector.get_indexes("integrations")}
            if "ix_integrations_website_id" in i_indexes:
                conn.exec_driver_sql("DROP INDEX ix_integrations_website_id ON integrations")
            conn.exec_driver_sql("CREATE UNIQUE INDEX ix_integrations_website_id ON integrations (website_id)")
        if _versions.name in inspector.get_table_names():
            conn.execute(_versions.delete().where(_versions.c.version >= 3))


def downgrade_phase3(engine):
    """Downgrade schema from Phase 3 to Phase 2.

    Refuses if any non-legacy collectors exist.
    """
    with engine.begin() as conn:
        inspector = inspect(conn)
        if "integrations" in inspector.get_table_names():
            i_table = [t for t in _tables() if t.name == "integrations"][0]
            non_legacy = conn.execute(
                select(i_table.c.id)
                .where(i_table.c.kind != "legacy")
            ).scalars().all()
            if non_legacy:
                raise SchemaMismatchError(
                    f"Cannot downgrade: non-legacy collectors exist: {', '.join(str(i) for i in non_legacy)}"
                )
        if "enrollment_tokens" in inspector.get_table_names():
            if conn.dialect.name == "sqlite":
                conn.exec_driver_sql("DROP TABLE IF EXISTS enrollment_tokens")
            elif conn.dialect.name == "mysql":
                conn.exec_driver_sql("DROP TABLE IF EXISTS enrollment_tokens")
        if _versions.name in inspector.get_table_names():
            conn.execute(_versions.delete().where(_versions.c.version >= 4))


def downgrade_phase4(engine):
    """Downgrade schema from Phase 4 to Phase 3 (v6/v5 -> v4).

    Drops ai_analysis_jobs table and client_event_id unique index.
    """
    with engine.begin() as conn:
        inspector = inspect(conn)
        if "ai_analysis_jobs" in inspector.get_table_names():
            if conn.dialect.name == "sqlite":
                conn.exec_driver_sql("DROP TABLE IF EXISTS ai_analysis_jobs")
            elif conn.dialect.name == "mysql":
                conn.exec_driver_sql("DROP TABLE IF EXISTS ai_analysis_jobs")
        if "events" in inspector.get_table_names():
            e_indexes = {idx["name"]: idx for idx in inspector.get_indexes("events")}
            if "ix_events_org_integration_client_event_id" in e_indexes:
                if conn.dialect.name == "sqlite":
                    conn.exec_driver_sql("DROP INDEX IF EXISTS ix_events_org_integration_client_event_id")
                elif conn.dialect.name == "mysql":
                    conn.exec_driver_sql("DROP INDEX ix_events_org_integration_client_event_id ON events")
        if _versions.name in inspector.get_table_names():
            conn.execute(_versions.delete().where(_versions.c.version >= 5))





def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise OwnershipMappingError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def main(argv=None):
    from app.config.runtime import _load_dotenv_if_present, get_runtime_config
    _load_dotenv_if_present()
    default_url = None
    try:
        default_url = get_runtime_config().database_url
    except Exception:
        default_url = os.environ.get("DATABASE_URL")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", default=default_url)
    parser.add_argument("--ownership-map", type=Path)
    parser.add_argument("--backup-confirmed", action="store_true",
                        help="I verified an external backup and stopped writers; this tool creates NO backup")
    args = parser.parse_args(argv)
    if not args.backup_confirmed:
        parser.error("An operator-verified external backup is required; pass --backup-confirmed")
    if not args.database_url:
        parser.error("Provide --database-url or DATABASE_URL (no hardcoded/live default)")
    mapping = None
    if args.ownership_map:
        mapping = json.loads(args.ownership_map.read_text(encoding="utf-8"), object_pairs_hook=_unique_object)
    engine = create_engine(args.database_url)
    try:
        report = migrate(engine, mapping)
        check_schema(engine)
        print(json.dumps(report, indent=2))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
