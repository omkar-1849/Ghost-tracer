export const SCANNER_STATUS = {
    READY: "Ready",
    COMING_SOON: "Coming Soon",
    PLANNED: "Planned",
    DISABLED: "Disabled"
};

export const SCANNER_ENGINES = [
    {
        id: "overview",
        name: "Overview",
        description: "Scanner Dashboard",
        status: SCANNER_STATUS.READY,
        isEngine: false
    },
    {
        id: "sqlmap",
        name: "SQLMap",
        description: "SQL Injection Testing",
        status: SCANNER_STATUS.READY,
        isEngine: true,
        capabilities: [
            "Automated SQL injection detection",
            "Database footprinting and enumeration",
            "Data extraction and exfiltration testing",
            "Bypass WAF/IPS mechanisms"
        ]
    },
    {
        id: "nmap",
        name: "Nmap",
        description: "Network Discovery",
        status: SCANNER_STATUS.COMING_SOON,
        isEngine: true,
        capabilities: [
            "Port scanning and service detection",
            "OS fingerprinting",
            "Network topology mapping",
            "Vulnerability detection scripts (NSE)"
        ]
    },
    {
        id: "nikto",
        name: "Nikto",
        description: "Web Server Scanner",
        status: SCANNER_STATUS.COMING_SOON,
        isEngine: true,
        capabilities: [
            "Detect outdated server versions",
            "Identify default files and misconfigurations",
            "Check for multiple index files",
            "Server configuration checks"
        ]
    },
    {
        id: "nuclei",
        name: "Nuclei",
        description: "Template-Based Vulnerability Scanner",
        status: SCANNER_STATUS.PLANNED,
        isEngine: true,
        capabilities: [
            "Fast and customizable template scanning",
            "Detect known CVEs and misconfigurations",
            "Continuous integration support",
            "Protocol agnostic (TCP, DNS, HTTP)"
        ]
    },
    {
        id: "owasp-zap",
        name: "OWASP ZAP",
        description: "Web Application Scanner",
        status: SCANNER_STATUS.PLANNED,
        isEngine: true,
        capabilities: [
            "Active and passive scanning",
            "AJAX spidering",
            "Automated vulnerability detection",
            "Fuzzing and payload injection"
        ]
    },
    {
        id: "ssl-analyzer",
        name: "SSL Analyzer",
        description: "SSL/TLS Configuration Testing",
        status: SCANNER_STATUS.PLANNED,
        isEngine: true,
        capabilities: [
            "Certificate validity and chain verification",
            "Detect weak cipher suites",
            "Protocol downgrade vulnerability checks",
            "HSTS and security headers analysis"
        ]
    }
];
