import re

filepath = r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\shared.jsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_badge = """export function EngineStatusBadge({ status }) {
    let colorClasses = "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]"; // default / Disabled
    
    if (status === "Ready") {
        colorClasses = "bg-[var(--color-success)] text-[var(--color-text-primary)] border-[var(--color-success)]";
    } else if (status === "Coming Soon") {
        colorClasses = "bg-[var(--color-warning)] text-[var(--color-text-primary)] border-[var(--color-warning)]";
    } else if (status === "Planned") {
        colorClasses = "bg-[var(--color-info)] text-[var(--color-text-primary)] border-[var(--color-info)]";
    }

    return (
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colorClasses}`}>
            {status}
        </span>
    );
}"""

content = re.sub(r'export function EngineStatusBadge.*?\}\n?', new_badge + '\n', content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
