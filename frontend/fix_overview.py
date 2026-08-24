import re

filepath = r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\OverviewTab.jsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_stateThemes = """const stateThemes = {
    ready: { label: "Ready", classes: "bg-[var(--color-success)] text-[var(--color-text-primary)] border-[var(--color-success)]" },
    running: { label: "Running", classes: "bg-[var(--color-info)] text-[var(--color-text-primary)] border-[var(--color-info)]" },
    offline: { label: "Offline", classes: "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]" },
};"""

content = re.sub(r'const stateThemes = \{.*?\n\};\n', new_stateThemes + '\n', content, flags=re.DOTALL)

new_severityText = """const severityText = {
    critical: "bg-[var(--color-critical)] text-[var(--color-text-primary)] border-[var(--color-critical)]",
    high: "bg-[var(--color-high)] text-[var(--color-text-primary)] border-[var(--color-high)]",
    medium: "bg-[var(--color-medium)] text-[var(--color-text-primary)] border-[var(--color-medium)]",
    low: "bg-[var(--color-low)] text-[var(--color-text-primary)] border-[var(--color-low)]",
    info: "bg-[var(--color-info)] text-[var(--color-text-primary)] border-[var(--color-info)]",
};"""

content = re.sub(r'const severityText = \{.*?\n\};\n', new_severityText + '\n', content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
