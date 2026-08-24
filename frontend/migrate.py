import os
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
    
    # Text
    content = re.sub(r'text-slate-100|text-slate-200|text-white', 'text-[var(--color-text-primary)]', content)
    content = re.sub(r'text-slate-300|text-slate-400', 'text-[var(--color-text-secondary)]', content)
    content = re.sub(r'text-slate-500', 'text-[var(--color-text-muted)]', content)
    content = re.sub(r'text-slate-600|text-slate-700|text-slate-800|text-slate-900', 'text-[var(--color-text-disabled)]', content)
    
    # Backgrounds
    content = re.sub(r'bg-slate-950/[0-9]+|bg-slate-900/[0-9]+|bg-\[\#09090b\]', 'bg-[var(--color-canvas)]', content)
    content = re.sub(r'bg-slate-950|bg-slate-900|bg-slate-800/20|bg-slate-800/25|bg-\[\#0f172a\]', 'bg-[var(--color-surface-1)]', content)
    content = re.sub(r'bg-slate-800/[3-6][0-9]|bg-slate-800/[7-9][0-9]|bg-slate-800|bg-\[\#1e293b\]', 'bg-[var(--color-surface-2)]', content)
    content = re.sub(r'bg-slate-700|bg-slate-600|bg-slate-500', 'bg-[var(--color-surface-3)]', content)

    # Borders
    content = re.sub(r'border-slate-800/[0-9]+|border-slate-800', 'border-[var(--color-border-subtle)]', content)
    content = re.sub(r'border-slate-700/[0-9]+|border-slate-700', 'border-[var(--color-border-default)]', content)
    content = re.sub(r'border-slate-600|border-slate-500', 'border-[var(--color-border-strong)]', content)
    
    # Border colors standalone
    content = re.sub(r'border-b border-slate-800/60|border-t border-slate-800/60', 'border-[var(--color-border-subtle)]', content)

    # Remove glows, backdrop-blur, animate-ping
    content = re.sub(r'shadow-\[[^\]]+\]', '', content)
    content = re.sub(r'backdrop-blur-[a-z]+|backdrop-blur', '', content)
    content = re.sub(r'animate-ping', '', content)
    content = re.sub(r'bg-gradient-to-[a-z]{1,2}', '', content)
    content = re.sub(r'from-[a-z]+-[0-9]+(/[0-9]+)?|via-[a-z]+-[0-9]+(/[0-9]+)?|to-[a-z]+-[0-9]+(/[0-9]+)?', '', content)
    content = re.sub(r'drop-shadow-\[[^\]]+\]', '', content)
    
    # Remove rounded-2xl/3xl -> rounded-lg
    content = re.sub(r'rounded-2xl|rounded-3xl', 'rounded-lg', content)

    # Tabular nums
    # we don't necessarily want to append it blindly, but we can look for specific numbers

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Processed {filepath}")

for f in files:
    migrate_file(f)
