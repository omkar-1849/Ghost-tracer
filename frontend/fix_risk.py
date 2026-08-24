import re

filepath = r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\shared.jsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_riskClasses = """function riskClasses(score) {
    if (score >= 70) return "bg-[var(--color-critical)] text-[var(--color-text-primary)] border-[var(--color-critical)]";
    if (score >= 40) return "bg-[var(--color-high)] text-[var(--color-text-primary)] border-[var(--color-high)]";
    if (score > 0) return "bg-[var(--color-success)] text-[var(--color-text-primary)] border-[var(--color-success)]";
    return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]";
}"""

content = re.sub(r'function riskClasses\(score\).*?\n\}', new_riskClasses, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
