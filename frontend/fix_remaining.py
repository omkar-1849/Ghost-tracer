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

    # fix remaining slate issues
    content = re.sub(r'scrollbar-thumb-slate-700', 'scrollbar-thumb-[var(--color-border-strong)]', content)
    content = re.sub(r'border-[a-z]-slate-700/[0-9]+', 'border-[var(--color-border-subtle)]', content)
    content = re.sub(r'border-[a-z]-slate-800/[0-9]+', 'border-[var(--color-border-subtle)]', content)
    
    # replace shadow-lg, shadow-xl, shadow-2xl, shadow-md, shadow-sm, shadow-black/.*
    content = re.sub(r'shadow-(sm|md|lg|xl|2xl|inner|black/[0-9]+)', 'shadow-[var(--shadow-1)]', content)
    # clean up duplicate or trailing shadows
    content = re.sub(r'(shadow-\[var\(--shadow-1\)]\s*)+', 'shadow-[var(--shadow-1)] ', content)
    
    # ring
    content = re.sub(r'ring-1 ring-purple-400/30', '', content)
    content = re.sub(r'focus:ring-2 focus:ring-purple-500/20', '', content)
    
    # check for other stragglers
    content = re.sub(r'text-cyan-400/80', 'text-[var(--color-accent)]', content)
    
    # remove shadow-[0_...
    content = re.sub(r'shadow-\[[0-9]+_[0-9]+.*?\]', '', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for f in files:
    migrate_file(f)
