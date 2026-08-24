import re

filepath = r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\report\ReportComponents.jsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_styles = """const SEVERITY_STYLES = {
    critical: { bar: "bg-[var(--color-critical)]", text: "text-[var(--color-critical)]" },
    high: { bar: "bg-[var(--color-high)]", text: "text-[var(--color-high)]" },
    medium: { bar: "bg-[var(--color-medium)]", text: "text-[var(--color-medium)]" },
    low: { bar: "bg-[var(--color-low)]", text: "text-[var(--color-low)]" },
    info: { bar: "bg-[var(--color-info)]", text: "text-[var(--color-info)]" },
};"""
content = re.sub(r'const SEVERITY_STYLES = \{.*?\n\};', new_styles, content, flags=re.DOTALL)

new_riskLabel = """function riskLabelFromScore(score) {
    if (score >= 70) return { label: "High", color: "text-[var(--color-critical)]" };
    if (score >= 40) return { label: "Medium", color: "text-[var(--color-high)]" };
    if (score > 0) return { label: "Low", color: "text-[var(--color-success)]" };
    return { label: "Unknown", color: "text-[var(--color-text-secondary)]" };
}"""
content = re.sub(r'function riskLabelFromScore\(score\) \{.*?\n\}', new_riskLabel, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
