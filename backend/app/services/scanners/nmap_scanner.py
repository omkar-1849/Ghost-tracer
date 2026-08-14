import xml.etree.ElementTree as ET
from app.database.database import SessionLocal
from app.models.scan import Scan
from app.models.website import Website
from app.services.audit_log_service import create_audit_log, resolve_audit_organization_id
from app.services.scanners.base_scanner import BaseScanner
from app.utils.scanner_utils import (
    run_subprocess, check_binary, extract_hostname,
    clean_output, normalize_severity, calculate_risk_score, ist_now,
)

class NmapScanner(BaseScanner):
    name = "Nmap"

    def start_scan(self, scan_id: int) -> None:
        db = SessionLocal()
        try:
            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            if not scan or scan.status == "Cancelled":
                return
            scan.status = "Running"
            db.commit()

            if not check_binary("nmap"):
                scan.status = "Failed"
                scan.error = "nmap is not installed."
                scan.completed_at = ist_now()
                db.commit()
                return

            hostname = extract_hostname(scan.target)
            cmd = ["nmap", "-sV", "-sC", "--open", "-oX", "-", hostname]
            scan.command = " ".join(cmd)
            db.commit()

            result = run_subprocess(cmd, timeout=300)
            raw_output = clean_output(result["stdout"])

            if not result["success"] and result["error"]:
                scan.status = "Failed"
                scan.error = result["error"]
                scan.raw_output = raw_output or clean_output(result["stderr"])
                scan.completed_at = ist_now()
                db.commit()
                return

            parsed = self.parse_output(raw_output)
            report = self.generate_report(parsed)
            findings_list = parsed.get("findings", [])

            scan.status = "Completed"
            scan.findings = len(findings_list)
            scan.risk_score = calculate_risk_score(findings_list)
            scan.raw_output = raw_output
            scan.parsed_output = report
            scan.completed_at = ist_now()
            db.commit()

            org_id = resolve_audit_organization_id(db)
            create_audit_log(
                db=db,
                organization_id=org_id if org_id is not None else 1,
                user_id=None,
                action="SCAN_COMPLETED",
                resource_type="SCAN",
                resource_id=str(scan.id),
                description=f"Scan ({scan.engine}) on {scan.target} completed with {scan.findings} findings.",
            )
        except Exception as e:
            try:
                scan.status = "Failed"
                scan.error = str(e)[:4000]
                scan.completed_at = ist_now()
                db.commit()

                org_id = resolve_audit_organization_id(db)
                create_audit_log(
                    db=db,
                    organization_id=org_id if org_id is not None else 1,
                    user_id=None,
                    action="SCAN_FAILED",
                    resource_type="SCAN",
                    resource_id=str(scan.id),
                    description=f"Scan ({scan.engine}) on {scan.target} failed: {scan.error[:200] if scan.error else 'Unknown error'}.",
                )
            except Exception:
                pass
        finally:
            db.close()

    def parse_output(self, raw_output: str) -> dict:
        parsed_data = {
            "hosts": [],
            "findings": []
        }
        if not raw_output:
            return parsed_data
            
        try:
            root = ET.fromstring(raw_output)
            for host in root.findall('host'):
                host_info = {"status": "", "ports": []}
                status = host.find('status')
                if status is not None:
                    host_info["status"] = status.get('state', '')
                
                ports = host.find('ports')
                if ports is not None:
                    for port in ports.findall('port'):
                        state = port.find('state')
                        if state is not None and state.get('state') == 'open':
                            port_id = port.get('portid', '')
                            protocol = port.get('protocol', '')
                            
                            service = port.find('service')
                            service_name = service.get('name', '') if service is not None else ''
                            service_version = service.get('version', '') if service is not None else ''
                            service_product = service.get('product', '') if service is not None else ''
                            
                            scripts = []
                            for script in port.findall('script'):
                                scripts.append({
                                    "id": script.get('id', ''),
                                    "output": script.get('output', '')
                                })
                                
                            port_info = {
                                "port": port_id,
                                "protocol": protocol,
                                "service": service_name,
                                "product": service_product,
                                "version": service_version,
                                "scripts": scripts
                            }
                            host_info["ports"].append(port_info)
                            
                            try:
                                port_num = int(port_id)
                            except ValueError:
                                port_num = -1
                                
                            severity = "Low"
                            if port_num in [21, 23, 445, 3389, 5900]:
                                severity = "Critical"
                            elif port_num in [22, 25, 110, 143, 3306, 5432, 6379, 27017]:
                                severity = "High"
                            elif port_num in [80, 443, 8080, 8443]:
                                severity = "Medium"
                                
                            parsed_data["findings"].append({
                                "type": "Open Port",
                                "name": f"Open Port: {port_id}/{protocol} ({service_name})",
                                "severity": normalize_severity(severity),
                                "description": f"The port {port_id} is open running {service_name} {service_version}.",
                                "details": port_info
                            })
                            
                parsed_data["hosts"].append(host_info)
        except Exception:
            pass
        return parsed_data

    def generate_report(self, parsed_data: dict) -> dict:
        total_ports = sum(len(h.get("ports", [])) for h in parsed_data.get("hosts", []))
        
        recommendations = []
        findings = parsed_data.get("findings", [])
        if findings:
            recommendations.append("Review all open ports and close unnecessary ones.")
            for f in findings:
                if f.get("severity") in ["critical", "high"]:
                    recommendations.append(f"Investigate high/critical finding: {f.get('name')}")
        else:
            recommendations.append("No open ports found or scan failed.")

        return {
            "scanner": self.name,
            "summary": {
                "total_hosts": len(parsed_data.get("hosts", [])),
                "total_ports": total_ports,
                "total_findings": len(findings)
            },
            "findings": findings,
            "hosts": parsed_data.get("hosts", []),
            "recommendations": recommendations
        }
