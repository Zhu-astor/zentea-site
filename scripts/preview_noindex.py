"""預覽站（GitHub Pages）專用：每個 HTML 的 <head> 加上 noindex，不讓 Google 收錄，
避免預覽站跟正式站 organic-naturetea.com 內容重複、互搶排名。正式站不要跑這支。
同步預覽站時，在 bump_assets.py 之後執行：python3 scripts/preview_noindex.py <預覽站資料夾>
"""
import re
import sys
from pathlib import Path

TAG = '<meta name="robots" content="noindex, nofollow">'
root = Path(sys.argv[1])
for html in sorted(root.glob('*.html')):
    text = html.read_text(encoding='utf-8')
    if re.search(r'<meta name="robots"', text):
        new = re.sub(r'<meta name="robots"[^>]*>', TAG, text)
    else:
        new = re.sub(r'(<meta charset="[^"]*">)', r'\1\n' + TAG, text, count=1, flags=re.I)
    if new != text:
        html.write_text(new, encoding='utf-8')
        print('noindex', html.name)
