import re

files = [
    r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\shared.jsx",
    r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\TargetSelect.jsx",
    r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\ScannerTabs.jsx",
    r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\engineResults.jsx",
    r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\ScanHistoryTable.jsx",
    r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\OverviewTab.jsx",
    r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\EngineTab.jsx",
    r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\scanner\ScannerLayout.jsx",
    r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\components\report\ReportComponents.jsx",
    r"c:\Users\omkar\OneDrive\Desktop\Games\c  program\new\frontend\src\pages\Report.jsx"
]

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Generic replace of text-red-*, text-emerald-* etc. unless it's in a specific status object we already replaced.
    content = re.sub(r'text-(red|rose|pink)-[3456]00', 'text-[var(--color-critical)]', content)
    content = re.sub(r'text-(orange|amber)-[3456]00', 'text-[var(--color-high)]', content)
    content = re.sub(r'text-(yellow)-[3456]00', 'text-[var(--color-medium)]', content)
    content = re.sub(r'text-(green|emerald|teal)-[3456]00', 'text-[var(--color-success)]', content)
    content = re.sub(r'text-(cyan|sky|blue)-[3456]00', 'text-[var(--color-info)]', content)
    content = re.sub(r'text-(purple|fuchsia|indigo)-[3456]00', 'text-[var(--color-accent)]', content)

    # Backgrounds
    content = re.sub(r'bg-(red|rose|pink)-[3456]00/[0-9]+', 'bg-[var(--color-critical)]', content)
    content = re.sub(r'bg-(orange|amber)-[3456]00/[0-9]+', 'bg-[var(--color-high)]', content)
    content = re.sub(r'bg-(yellow)-[3456]00/[0-9]+', 'bg-[var(--color-medium)]', content)
    content = re.sub(r'bg-(green|emerald|teal)-[3456]00/[0-9]+', 'bg-[var(--color-success)]', content)
    content = re.sub(r'bg-(cyan|sky|blue)-[3456]00/[0-9]+', 'bg-[var(--color-info)]', content)
    content = re.sub(r'bg-(purple|fuchsia|indigo)-[3456]00/[0-9]+', 'bg-[var(--color-accent-subtle)]', content)

    content = re.sub(r'bg-(red|rose|pink)-[3456]00', 'bg-[var(--color-critical)]', content)
    content = re.sub(r'bg-(orange|amber)-[3456]00', 'bg-[var(--color-high)]', content)
    content = re.sub(r'bg-(yellow)-[3456]00', 'bg-[var(--color-medium)]', content)
    content = re.sub(r'bg-(green|emerald|teal)-[3456]00', 'bg-[var(--color-success)]', content)
    content = re.sub(r'bg-(cyan|sky|blue)-[3456]00', 'bg-[var(--color-info)]', content)
    content = re.sub(r'bg-(purple|fuchsia|indigo)-[3456]00', 'bg-[var(--color-accent)]', content)

    # Borders
    content = re.sub(r'border-(red|rose|pink)-[3456]00(/[0-9]+)?', 'border-[var(--color-critical)]', content)
    content = re.sub(r'border-(orange|amber)-[3456]00(/[0-9]+)?', 'border-[var(--color-high)]', content)
    content = re.sub(r'border-(yellow)-[3456]00(/[0-9]+)?', 'border-[var(--color-medium)]', content)
    content = re.sub(r'border-(green|emerald|teal)-[3456]00(/[0-9]+)?', 'border-[var(--color-success)]', content)
    content = re.sub(r'border-(cyan|sky|blue)-[3456]00(/[0-9]+)?', 'border-[var(--color-info)]', content)
    content = re.sub(r'border-(purple|fuchsia|indigo)-[3456]00(/[0-9]+)?', 'border-[var(--color-accent)]', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for f in files:
    migrate_file(f)
