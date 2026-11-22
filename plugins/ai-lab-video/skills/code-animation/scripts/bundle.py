"""Inline engine.js + scene.js into one standalone HTML file (the deliverable that plays anywhere).
Usage: python3 bundle.py <scene_dir> [out.html]   (default: <scene_dir>/<dirname>.html)"""
import re, sys
from pathlib import Path

d = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]) if len(sys.argv) > 2 else d / f"{d.name}.html"
html = (d / "index.html").read_text(encoding="utf-8")
for name in ("engine.js", "scene.js"):
    src = (d / name).read_text(encoding="utf-8").replace("</script>", "<\\/script>")
    html, n = re.subn(rf'<script src="{re.escape(name)}"></script>', lambda m: f"<script>\n{src}\n</script>", html)
    if not n:
        sys.exit(f"index.html has no <script src=\"{name}\"> tag")
out.write_text(html, encoding="utf-8")
print(out)
