import re

filepath = r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\shared.jsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_statusColor = """export function statusColor(status) {
    switch ((status || "").toUpperCase()) {
        case "COMPLETED":
            return "bg-[var(--color-success)] text-[var(--color-text-primary)] border-[var(--color-success)]";
        case "RUNNING":
            return "bg-[var(--color-info)] text-[var(--color-text-primary)] border-[var(--color-info)]";
        case "PENDING":
        case "QUEUED":
            return "bg-[var(--color-warning)] text-[var(--color-text-primary)] border-[var(--color-warning)]";
        case "FAILED":
            return "bg-[var(--color-critical)] text-[var(--color-text-primary)] border-[var(--color-critical)]";
        case "CANCELLED":
            return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]";
        default:
            return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]";
    }
}"""

content = re.sub(r'export function statusColor\(status\).*?\n\}', new_statusColor, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
