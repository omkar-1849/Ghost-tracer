class SQLMapRecommendationEngine:
    def generate(self, findings: dict) -> list[str]:
        recommendations = []

        if findings.get("waf"):
            recommendations.append(
                "Review the detected Web Application Firewall configuration."
            )

        if not findings.get("injectable"):
            recommendations.append(
                "Verify the target contains injectable GET or POST parameters."
            )

        if findings.get("dbms"):
            recommendations.append(
                "Review database permissions and apply the principle of least privilege."
            )

        if findings.get("http_errors"):
            recommendations.append(
                "Investigate HTTP errors that may have affected scan coverage."
            )

        if findings.get("injectable"):
            recommendations.append(
                "Immediately validate and remediate the detected SQL Injection vulnerability."
            )
            recommendations.append(
                "Perform authenticated testing to determine the impact."
            )

        if not recommendations:
            recommendations.append(
                "No immediate remediation required based on the current scan."
            )

        return recommendations