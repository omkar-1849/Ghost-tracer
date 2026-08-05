from abc import ABC, abstractmethod


class BaseScanner(ABC):
    """
    Base contract for every scanner engine.

    Every scanner (SQLMap, Nmap, Nikto, Nuclei, etc.)
    must implement these methods.
    """

    name: str = "Unknown Scanner"

    @abstractmethod
    def start_scan(self, scan_id: int):
        """Start executing a scan."""
        pass

    @abstractmethod
    def parse_output(self, raw_output: str):
        """Convert raw scanner output into structured data."""
        pass

    @abstractmethod
    def generate_report(self, parsed_data):
        """Generate the standardized report object."""
        pass