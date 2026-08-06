from app.services.scanners.sqlmap.adapter import SQLMapScanner
from app.services.scanners.nmap_scanner import NmapScanner
from app.services.scanners.nuclei_scanner import NucleiScanner
from app.services.scanners.nikto_scanner import NiktoScanner
from app.services.scanners.zap_scanner import ZapScanner
from app.services.scanners.ssl_scanner import SSLScanner


class ScannerFactory:
    """
    Central registry for all scanner engines.
    """

    _SCANNERS = {
        "sqlmap": SQLMapScanner,
        "nmap": NmapScanner,
        "nikto": NiktoScanner,
        "nuclei": NucleiScanner,
        "zap": ZapScanner,
        "ssl": SSLScanner,
    }

    @classmethod
    def get_scanner(cls, engine: str):
        scanner = cls._SCANNERS.get(engine.lower())

        if not scanner:
            raise ValueError(f"Unsupported scanner engine: {engine}")

        return scanner()

    @classmethod
    def list_engines(cls):
        """Return list of registered engine names."""
        return list(cls._SCANNERS.keys())