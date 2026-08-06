"""Assemble the PokeQuant site into docs/ from web/ sources + docs/data.json.

Outputs:
  docs/index.html                    — fetches ./data.json on every load (always current)
  docs/PokeQuant-Terminal-LIVE.html  — fully self-contained offline snapshot
Run after scripts/analytics.py.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
DOCS = os.path.join(ROOT, "docs")

def read(p):
    with open(p, encoding="utf-8") as f: return f.read()

css = read(os.path.join(WEB, "style.css"))
app_js = "\n".join(read(os.path.join(WEB, f)) for f in ("core.js", "views.js", "product.js"))
boot = ("function boot(){\n" + app_js +
        '\ndocument.documentElement.dataset.theme="dark";\n'
        'addEventListener("hashchange",applyHash);\napplyHash();\n'
        'window.go=go;window.render=render;window.setTheme=setTheme;\n'
        'addEventListener("resize",(()=>{let t;return()=>{clearTimeout(t);t=setTimeout(render,250);};})());\n}\n')

SHELL = """<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%233987e5'/%3E%3Cpath d='M2 16h28' stroke='%230d0d0d' stroke-width='3'/%3E%3Ccircle cx='16' cy='16' r='5' fill='%23fff' stroke='%230d0d0d' stroke-width='3'/%3E%3C/svg%3E">
<title>PMT — Pokémon Market Tracker</title>
<style>
__CSS__
#loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:14px;color:var(--ink2)}
#loading .logo{width:42px;height:42px;border-radius:50%;background:conic-gradient(from 180deg,var(--s1) 0 50%,var(--surface2) 50% 100%);border:3px solid var(--ink);position:relative;animation:spin 1.2s linear infinite}
#loading .logo::after{content:"";position:absolute;inset:13px;border-radius:50%;background:var(--surface);border:3px solid var(--ink)}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div id="app"><div id="loading"><div class="logo"></div><div>Loading live market data…</div></div></div>
<script>
__LOADER__
</script>
</body>
</html>
"""

FETCH_LOADER = """
fetch("data.json?v="+Date.now()).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
  .then(d=>{window.DATA=d;boot();})
  .catch(e=>{document.getElementById("app").innerHTML=
    '<div id="loading"><div>Could not load market data ('+e.message+').<br>Check your connection and refresh.</div></div>';});
"""

data = read(os.path.join(DOCS, "data.json"))
news_path = os.path.join(DOCS, "news.json")
news = read(news_path) if os.path.exists(news_path) else "null"

os.makedirs(DOCS, exist_ok=True)
# fetch version (always current when served from pmt.today)
out = SHELL.replace("__CSS__", css).replace("__LOADER__", FETCH_LOADER + "\n" + boot)
with open(os.path.join(DOCS, "index.html"), "w", encoding="utf-8") as f:
    f.write(out)
# offline snapshot (data + news inlined)
inline_loader = "window.DATA=" + data + ";\nwindow.NEWS=" + news + ";\n" + boot + "\nboot();"
snap = SHELL.replace("__CSS__", css).replace("__LOADER__", inline_loader)
snap = snap.replace("<title>PMT — Pokémon Market Tracker</title>",
                    "<title>PMT — Pokémon Market Tracker (offline snapshot)</title>")
with open(os.path.join(DOCS, "PMT-Snapshot.html"), "w", encoding="utf-8") as f:
    f.write(snap)
with open(os.path.join(DOCS, ".nojekyll"), "w") as f:
    f.write("")
with open(os.path.join(DOCS, "CNAME"), "w") as f:
    f.write("pmt.today\n")
print(f"docs/index.html ({os.path.getsize(os.path.join(DOCS,'index.html'))/1e3:.0f} KB) + "
      f"docs/PMT-Snapshot.html ({os.path.getsize(os.path.join(DOCS,'PMT-Snapshot.html'))/1e6:.2f} MB) + CNAME pmt.today")
