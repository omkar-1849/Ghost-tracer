from app.services.scanners.sqlmap.adapter import SQLMapScanner


class ScannerFactory:
    """
    Central registry for all scanner engines.
    """

    _SCANNERS = {
        "sqlmap": SQLMapScanner,
        # "nmap": NmapScanner,
        # "nikto": NiktoScanner,
        # "nuclei": NucleiScanner,
        # "zap": ZapScanner,
        # "ssl": SSLScanner,
    }

    @classmethod
    def get_scanner(cls, engine: str):
        scanner = cls._SCANNERS.get(engine.lower())

        if not scanner:
            raise ValueError(f"Unsupported scanner engine: {engine}")

        return scanner()