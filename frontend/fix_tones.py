import re

filepath = r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\engineResults.jsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_metricTones = """const metricTones = {
    purple: { chip: "bg-[var(--color-surface-2)]", text: "text-[var(--color-accent)]" },
    cyan: { chip: "bg-[var(--color-surface-2)]", text: "text-[var(--color-info)]" },
    green: { chip: "bg-[var(--color-surface-2)]", text: "text-[var(--color-success)]" },
    amber: { chip: "bg-[var(--color-surface-2)]", text: "text-[var(--color-high)]" },
    yellow: { chip: "bg-[var(--color-surface-2)]", text: "text-[var(--color-medium)]" },
    red: { chip: "bg-[var(--color-surface-2)]", text: "text-[var(--color-critical)]" },
    blue: { chip: "bg-[var(--color-surface-2)]", text: "text-[var(--color-low)]" },
};"""

content = re.sub(r'const metricTones = \{.*?\n\};\n', new_metricTones + '\n', content, flags=re.DOTALL)

# StringList tones
new_string_list_tones = """const tones = {
        red: "bg-[var(--color-critical)] text-[var(--color-text-primary)] border-[var(--color-critical)]",
        amber: "bg-[var(--color-high)] text-[var(--color-text-primary)] border-[var(--color-high)]",
        cyan: "bg-[var(--color-info)] text-[var(--color-text-primary)] border-[var(--color-info)]",
    };"""
content = re.sub(r'const tones = \{.*?\n\s+\};', new_string_list_tones, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
