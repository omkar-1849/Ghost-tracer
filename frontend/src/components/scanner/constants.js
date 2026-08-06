import { Globe, Box, Sparkles, Cpu, Lock, Target } from "lucide-react";

export const SCANNER_STATUS = {
    READY: "Ready",
    COMING_SOON: "Coming Soon",
    PLANNED: "Planned",
    DISABLED: "Disabled"
};

// Scan statuses the UI treats as "in progress" (live status card + polling).
export const ACTIVE_STATUSES = new Set(["PENDING", "QUEUED", "RUNNING"]);

// Every entry is driven by the generic EngineTab. To add a new scanner
// (e.g. OpenVAS, Trivy, Burp, Wazuh, Nessus) add a backend engine to
// VALID_ENGINES / ScannerFactory, add one entry here, and add a small
// renderer to engineResults.jsx — no new page or tab code required.
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
        engine: "sqlmap",
        name: "SQLMap",
        description: "SQL Injection Testing",
        status: SCANNER_STATUS.READY,
        isEngine: true,
        icon: Target,
        accent: "cyan",
        capabilities: [
            "Automated SQL injection detection",
            "Database footprinting and enumeration",
            "Data extraction and exfiltration testing",
            "Bypass WAF/IPS mechanisms"
        ]
    },
    {
        id: "nmap",
        engine: "nmap",
        name: "Nmap",
        description: "Network Discovery",
        status: SCANNER_STATUS.READY,
        isEngine: true,
        icon: Globe,
        accent: "blue",
        capabilities: [
            "Port scanning and service detection",
            "OS fingerprinting",
            "Network topology mapping",
            "Vulnerability detection scripts (NSE)"
        ]
    },
    {
        id: "nikto",
        engine: "nikto",
        name: "Nikto",
        description: "Web Server Scanner",
        status: SCANNER_STATUS.READY,
        isEngine: true,
        icon: Box,
        accent: "amber",
        capabilities: [
            "Detect outdated server versions",
            "Identify default files and misconfigurations",
            "Check for multiple index files",
            "Server configuration checks"
        ]
    },
    {
        id: "nuclei",
        engine: "nuclei",
        name: "Nuclei",
        description: "Template-Based Vulnerability Scanner",
        status: SCANNER_STATUS.READY,
        isEngine: true,
        icon: Sparkles,
        accent: "emerald",
        capabilities: [
            "Fast and customizable template scanning",
            "Detect known CVEs and misconfigurations",
            "Continuous integration support",
            "Protocol agnostic (TCP, DNS, HTTP)"
        ]
    },
    {
        id: "owasp-zap",
        engine: "zap",
        name: "OWASP ZAP",
        description: "Web Application Scanner",
        status: SCANNER_STATUS.READY,
        isEngine: true,
        icon: Cpu,
        accent: "rose",
        capabilities: [
            "Active and passive scanning",
            "AJAX spidering",
            "Automated vulnerability detection",
            "Fuzzing and payload injection"
        ]
    },
    {
        id: "ssl-analyzer",
        engine: "ssl",
        name: "SSL Analyzer",
        description: "SSL/TLS Configuration Testing",
        status: SCANNER_STATUS.READY,
        isEngine: true,
        icon: Lock,
        accent: "cyan",
        capabilities: [
            "Certificate validity and chain verification",
            "Detect weak cipher suites",
            "Protocol downgrade vulnerability checks",
            "HSTS and security headers analysis"
        ]
    }
];

// Backend engine value -> frontend tab id (reverse lookup helper).
export function engineToTabId(engine) {
    const entry = SCANNER_ENGINES.find((item) => item.engine === engine);
    return entry ? entry.id : engine;
}

// Frontend tab id -> backend engine value.
export function tabToEngineId(tabId) {
    const entry = SCANNER_ENGINES.find((item) => item.id === tabId);
    return entry && entry.engine ? entry.engine : tabId;
}
