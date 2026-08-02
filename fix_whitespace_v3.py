import os
import re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace ONLY specific invisible unicode characters known to cause irregular whitespace errors
    content = re.sub(r'[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]', ' ', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_file('src/pages/DisclaimerPage.tsx')
