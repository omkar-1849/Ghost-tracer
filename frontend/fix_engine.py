import re

filepath = r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\engineResults.jsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_severityClasses = """function severityClasses(severity) {
    switch ((severity || "").toLowerCase()) {
        case "critical": return "bg-[var(--color-critical)] text-[var(--color-text-primary)] border-[var(--color-critical)]";
        case "high": return "bg-[var(--color-high)] text-[var(--color-text-primary)] border-[var(--color-high)]";
        case "medium": return "bg-[var(--color-medium)] text-[var(--color-text-primary)] border-[var(--color-medium)]";
        case "low": return "bg-[var(--color-low)] text-[var(--color-text-primary)] border-[var(--color-low)]";
        case "info": return "bg-[var(--color-info)] text-[var(--color-text-primary)] border-[var(--color-info)]";
        default: return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]";
    }
}"""

content = re.sub(r'function severityClasses\(severity\).*?\n\}', new_severityClasses, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
