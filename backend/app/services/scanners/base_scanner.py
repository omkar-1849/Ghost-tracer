from abc import ABC, abstractmethod


class BaseScanner(ABC):
    """
    Base contract for every scanner engine.

    Every scanner (SQLMap, Nmap, Nikto, Nuclei, ZAP, SSL, etc.)
    must implement these methods.

    Scanners operate on the **Scan** model as the primary data store.
    Each scanner's ``start_scan`` opens its own DB session, reads the
    Scan record, executes the tool, and persists results back to the
    same Scan row (status, findings, risk_score, raw_output,
    parsed_output, error, completed_at).
    """

    name: str = "Unknown Scanner"

    @abstractmethod
    def start_scan(self, scan_id: int) -> None:
        """
        Execute a scan end-to-end.

        Opens its own database session, queries the Scan record by
        *scan_id*, runs the external tool / analysis, and updates the
        Scan record with results.
        """
        pass

    @abstractmethod
    def parse_output(self, raw_output: str) -> dict:
        """Convert raw scanner output into structured findings data."""
        pass

    @abstractmethod
    def generate_report(self, parsed_data: dict) -> dict:
        """Generate the standardized report dict stored in parsed_output."""
        pass