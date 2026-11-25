"""產生英文版頁面：依 i18n/en.json 把中文頁（index.html、products.html、product.html）轉成 en/ 底下的英文頁。

- 英文頁加 <base href="../">，css、js、圖片和中文版共用同一份；連到有英文版的頁面改成 en/…
- 中文頁和英文頁都加上 hreflang，告訴 Google 兩個版本互相對應
- 只翻 HTML 裡的文字和 alt、aria-label、title、placeholder、meta content；JS 產生的文字由 js/i18n.js 和後端 ?lang=en 處理
- 對照表沒有的中文會列出來（品牌名、茶名等刻意保留中文的會一起列出，看一下有沒有漏翻就好）

中文頁改版後重新執行：python3 scripts/build_en.py（之後再跑 bump_assets.py）
"""
import html
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
SITE = 'https://www.organic-naturetea.com/'
PAGES = ['index.html', 'products.html', 'product.html']
CJK = re.compile(r'[㐀-鿿]')

table = json.loads((root / 'i18n' / 'en.json').read_text(encoding='utf-8'))
norm = lambda s: ' '.join(s.split())


def url_of(page, en):
    path = ('en/' if en else '') + ('' if page == 'index.html' else page)
    return SITE + path


def hreflang(page):
    return (f'<link rel="alternate" hreflang="zh-Hant" href="{url_of(page, False)}">\n'
            f'<link rel="alternate" hreflang="en" href="{url_of(page, True)}">\n'
            f'<link rel="alternate" hreflang="x-default" href="{url_of(page, False)}">')


def add_hreflang(text, page):
    text = re.sub(r'<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?', '', text)
    return re.sub(r'(<meta charset="[^"]*">)', r'\1\n' + hreflang(page).replace('\\', r'\\'), text, count=1, flags=re.I)


def translate(text, page):
    words = {**table['common'], **table.get(page, {})}
    words = {norm(k): v for k, v in words.items()}
    missing = []

    def tr(s):
        key = norm(html.unescape(s))
        if key in words:
            return html.escape(words[key], quote=False)
        if CJK.search(key):
            missing.append(key)
        return s

    # 不動 <script>、<style> 和註解，只處理其他部分
    parts = re.split(r'(<script[\s\S]*?</script>|<style[\s\S]*?</style>|<!--[\s\S]*?-->)', text)
    for i in range(0, len(parts), 2):
        p = parts[i]
        # 標籤之間的文字
        p = re.sub(r'>([^<>]+)<', lambda m: '>' + (m.group(1).replace(m.group(1).strip(), tr(m.group(1)), 1)
                                                    if m.group(1).strip() else m.group(1)) + '<', p)
        # 屬性
        p = re.sub(r'\b(alt|aria-label|title|placeholder|content)="([^"]*)"',
                   lambda m: f'{m.group(1)}="{tr(m.group(2)) if CJK.search(m.group(2)) else m.group(2)}"', p)
        parts[i] = p
    return ''.join(parts), missing


def localize_links(text):
    def fix(m):
        attr, href = m.group(1), m.group(2)
        if href == '#':
            return m.group(0)  # 品牌理念的「#」由 philosophy.js 處理
        if href.startswith('#'):
            return m.group(0)  # 同頁錨點（首頁「關於我們」），由頁面 JS 平滑捲動
        file = href.split('?')[0].split('#')[0]
        if file in PAGES:
            return f'{attr}="en/{href}"'
        return m.group(0)
    return re.sub(r'\b(href)="([^"]*)"', fix, text)


for page in PAGES:
    src = root / page
    zh = src.read_text(encoding='utf-8')
    # 中文頁補 hreflang
    zh_new = add_hreflang(zh, page)
    if zh_new != zh:
        src.write_text(zh_new, encoding='utf-8')

    en, missing = translate(zh_new, page)
    en = en.replace('<html lang="zh-Hant">', '<html lang="en">', 1)
    en = re.sub(r'(<meta charset="[^"]*">)', r'\1\n<base href="../">', en, count=1, flags=re.I)
    en = localize_links(en)
    # 英文排版調整（字距、直排選單）
    en = en.replace('</head>', '<link rel="stylesheet" href="css/en.css">\n</head>', 1)
    en = re.sub(r'(<link rel="canonical" href=")[^"]*(")', lambda m: m.group(1) + url_of(page, True) + m.group(2), en)
    en = re.sub(r'(<meta property="og:url" content=")[^"]*(")', lambda m: m.group(1) + url_of(page, True) + m.group(2), en)
    en = en.replace('<meta property="og:locale" content="zh_TW">', '<meta property="og:locale" content="en_US">')
    out = root / 'en' / page
    out.parent.mkdir(exist_ok=True)
    # 註解放在 <head> 裡，放在 <!DOCTYPE> 前面會讓瀏覽器進入相容模式
    en = en.replace('<base href="../">', '<!-- 自動產生：請改中文頁或 i18n/en.json，再執行 python3 scripts/build_en.py -->\n<base href="../">', 1)
    out.write_text(en, encoding='utf-8')
    print(f'{page} → en/{page}')
    for m in sorted(set(missing)):
        print('   保留中文：', m)
