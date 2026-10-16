"""Minimal Markdown -> PDF (A4) via headless Edge. Usage: md2pdf.py <in.md> <out.pdf> [max_pages]
Handles headings, paragraphs, tables, lists, hr, bold/italic/code/links. Shrinks the type a little if the page cap is exceeded."""
import html, re, sys, os
from playwright.sync_api import sync_playwright

src, out = sys.argv[1], sys.argv[2]; max_pages = int(sys.argv[3]) if len(sys.argv) > 3 else 0
HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r"<em>\1</em>", t)
    t = re.sub(r"(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])", r"<em>\1</em>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', t)
    return t


def convert(md):
    out, para, lst, table = [], [], None, []
    def flush_para():
        nonlocal para
        if para: out.append("<p>" + inline(" ".join(para)) + "</p>"); para = []
    def flush_list():
        nonlocal lst
        if lst: out.append(f"<{lst[0]}>" + "".join(f"<li>{inline(x)}</li>" for x in lst[1]) + f"</{lst[0]}>"); lst = None
    def flush_table():
        nonlocal table
        if table:
            rows = [r for r in table if not re.match(r"^\|?\s*:?-{2,}", r)]
            cells = [[inline(c.strip()) for c in r.strip().strip("|").split("|")] for r in rows]
            if cells:
                head = "".join(f"<th>{c}</th>" for c in cells[0]); body = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in cells[1:])
                out.append(f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>")
            table = []
    for line in md.splitlines():
        s = line.rstrip()
        if s.startswith("|"): flush_para(); flush_list(); table.append(s); continue
        else: flush_table()
        m = re.match(r"^(#{1,4})\s+(.*)", s)
        if m: flush_para(); flush_list(); out.append(f"<h{len(m.group(1))}>{inline(m.group(2))}</h{len(m.group(1))}>"); continue
        if s.strip() in ("---", "***"): flush_para(); flush_list(); out.append("<hr>"); continue
        m = re.match(r"^\s*[-*]\s+(.*)", s)
        if m: flush_para(); (lst or None) and lst[0] != "ul" and flush_list(); lst = lst or ("ul", []); lst[1].append(m.group(1)); continue
        m = re.match(r"^\s*\d+\.\s+(.*)", s)
        if m: flush_para(); (lst or None) and lst[0] != "ol" and flush_list(); lst = lst or ("ol", []); lst[1].append(m.group(1)); continue
        if not s.strip(): flush_para(); flush_list(); continue
        para.append(s.strip())
    flush_para(); flush_list(); flush_table()
    return "\n".join(out)


CSS = """@font-face{font-family:'NotoSerifBn';src:url('file:///%s/fonts/NotoSerifBengali.ttf');font-weight:100 900}
body{font-family:'NotoSerifBn','Noto Serif Bengali','Nirmala UI',Georgia,serif;font-size:%spt;line-height:1.38;color:#1d1a14;margin:0}
h1{font-size:%spt;margin:0 0 4pt;line-height:1.2} h2{font-size:%spt;margin:11pt 0 3pt;border-bottom:1px solid #b9ad92;padding-bottom:1pt} h3{font-size:%spt;margin:8pt 0 2pt}
p{margin:0 0 5pt} ul,ol{margin:0 0 5pt 16pt;padding:0} li{margin:0 0 2pt}
table{border-collapse:collapse;width:100%%;margin:3pt 0 7pt;font-size:%spt} th,td{border:1px solid #cfc7b5;padding:2.5pt 5pt;vertical-align:top;text-align:left} th{background:#f1ede2}
code{font-family:Consolas,monospace;font-size:90%%;background:#f3f0e8;padding:0 2pt} hr{border:0;border-top:1px solid #b9ad92;margin:8pt 0} a{color:#0b5d3b;text-decoration:none}
"""
md = open(src, encoding="utf-8").read()
body = convert(md)
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True); pg = b.new_page()
    for base in (10.5, 10, 9.5, 9):
        css = CSS % (HERE, base, base + 7.5, base + 2.5, base + 1, base - 1.5)
        pg.set_content(f"<html><head><meta charset='utf-8'><style>{css}</style></head><body>{body}</body></html>"); pg.evaluate("document.fonts.ready")
        pg.pdf(path=out, format="A4", margin=dict(top="14mm", bottom="14mm", left="15mm", right="15mm"), print_background=True)
        try:
            sys.path.insert(0, os.path.join(os.environ.get("TEMP", ""), "pylib")); import pypdf
            n = len(pypdf.PdfReader(out).pages)
        except Exception:
            n = -1
        print(f"font {base}pt -> {n} pages")
        if not max_pages or n <= max_pages or n < 0: break
    b.close()
print("wrote", out)
