"""在每個 HTML 的本地 CSS／JS 網址後面加上版本號（?v=檔案內容的雜湊），
檔案有改動版本號才會變，瀏覽器就會抓新檔、不會用到快取裡的舊樣式。
改完 CSS/JS 後執行：python3 scripts/bump_assets.py
"""
import hashlib
import re
import sys
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
pattern = re.compile(r'((?:href|src)=")((?:css|js)/[^"?#]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(")')


def version(rel):
    f = root / rel
    return hashlib.sha1(f.read_bytes()).hexdigest()[:8] if f.exists() else None


for html in sorted(root.glob('*.html')):
    text = html.read_text(encoding='utf-8')
    new = pattern.sub(lambda m: m.group(1) + m.group(2) + (f'?v={v}' if (v := version(m.group(2))) else '') + m.group(3), text)
    if new != text:
        html.write_text(new, encoding='utf-8')
        print('updated', html.name)
