from app.services.scanners.sqlmap.parser import SQLMapParser


class SQLMapReportGenerator:
    def __init__(self):
        self.parser = SQLMapParser()

    def generate(self, raw_output: str) -> dict:
        parsed = self.parser.parse(raw_output)

        return {
            "summary": parsed["summary"],
            "findings": parsed["findings"],
            "timeline": parsed["timeline"],
            "recommendations": parsed["recommendations"],
            "metadata": parsed["metadata"],
            "raw_output": parsed["raw_output"],
        }