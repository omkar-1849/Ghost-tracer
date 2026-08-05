import re

from app.services.scanners.sqlmap.recommendations import (
    SQLMapRecommendationEngine,
)


class SQLMapParser:
    def parse(self, raw_output: str) -> dict:
        report = {
            "summary": {
                "status": "Completed",
                "risk": "Unknown",
                "target": None,
                "engine": "SQLMap",
                "started_at": None,
                "completed_at": None,
                "duration": None,
            },
            "findings": {
                "waf": None,
                "dbms": None,
                "injectable": False,
                "parameters_tested": 0,
                "http_errors": [],
                "warnings": [],
                "critical": [],
                "databases": [],
                "tables": [],
                "columns": [],
            },
            "timeline": [],
            "recommendations": [],
            "metadata": {
                "sqlmap_version": None,
                "exit_status": "Completed",
            },
            "raw_output": raw_output,
        }

        for line in raw_output.splitlines():
            line = line.strip()

            if not line:
                continue

            # ---------- Timeline ----------
            if "[INFO]" in line:
                report["timeline"].append(
                    {
                        "level": "INFO",
                        "message": line.split("[INFO]")[-1].strip(),
                    }
                )

            elif "[WARNING]" in line:
                report["timeline"].append(
                    {
                        "level": "WARNING",
                        "message": line.split("[WARNING]")[-1].strip(),
                    }
                )

            elif "[CRITICAL]" in line:
                report["timeline"].append(
                    {
                        "level": "CRITICAL",
                        "message": line.split("[CRITICAL]")[-1].strip(),
                    }
                )

            elif "[ERROR]" in line:
                report["timeline"].append(
                    {
                        "level": "ERROR",
                        "message": line.split("[ERROR]")[-1].strip(),
                    }
                )

            # ---------- Metadata ----------
            version = re.search(r"\{(.+?)\}", line)
            if version:
                report["metadata"]["sqlmap_version"] = version.group(1)

            started = re.search(r"\[\*\] starting @ (.+)", line)
            if started:
                report["summary"]["started_at"] = started.group(1)

            finished = re.search(r"\[\*\] ending @ (.+)", line)
            if finished:
                report["summary"]["completed_at"] = finished.group(1)

            # ---------- Findings ----------
            if "[WARNING]" in line:
                report["findings"]["warnings"].append(line)

            if "[CRITICAL]" in line:
                report["findings"]["critical"].append(line)

            waf = re.search(r"WAF\/IPS identified as '(.*?)'", line)
            if waf:
                report["findings"]["waf"] = waf.group(1)

            dbms = re.search(r"back-end DBMS: (.+)", line)
            if dbms:
                report["findings"]["dbms"] = dbms.group(1)

            if "parameter" in line.lower() and "injectable" in line.lower():
                report["findings"]["injectable"] = True

            if "no parameter(s) found" in line.lower():
                report["findings"]["parameters_tested"] = 0

            http_error = re.search(r"(\d{3}) \((.*?)\)", line)
            if http_error:
                report["findings"]["http_errors"].append(
                    {
                        "code": http_error.group(1),
                        "message": http_error.group(2),
                    }
                )

            database = re.search(r"available databases \[(\d+)\]", line)
            if database:
                report["findings"]["databases"].append(database.group(1))

        # ---------- Risk ----------
        if report["findings"]["injectable"]:
            report["summary"]["risk"] = "High"
        elif report["findings"]["waf"]:
            report["summary"]["risk"] = "Medium"
        else:
            report["summary"]["risk"] = "Low"

        # ---------- Recommendations ----------
        recommendation_engine = SQLMapRecommendationEngine()

        report["recommendations"] = recommendation_engine.generate(
            report["findings"]
        )

        return report