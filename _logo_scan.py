import re
from pathlib import Path

html = Path(r"C:\Users\USER\AppData\Local\Temp\afez-home.html").read_text(encoding="utf-8", errors="replace")
urls = set(re.findall(r"""(?:src|href)=["']([^"']+)["']""", html))
for u in sorted(urls):
    low = u.lower()
    if any(k in low for k in ("logo", "svg", "favicon", "brand", "header")):
        print(u[:240])
print("---SCRIPTS---")
for u in sorted(set(re.findall(r"""src=["']([^"']+)["']""", html))):
    if "_next" in u or u.endswith(".js"):
        print(u[:220])
print("---CSS---")
for u in sorted(set(re.findall(r"""href=["']([^"']+\.css[^"']*)["']""", html))):
    print(u[:220])
print("---LOGO WORD---")
for m in re.finditer(r".{40}[Ll]ogo.{40}", html):
    s = m.group(0).replace("\n", " ")
    if "Medinex" in s or "hm_logo" in s:
        continue
    print(s[:160])
print("---UPLOADS---")
ups = set(re.findall(r"https?://api\.afez\.az/uploads[^\"'\\s<]+", html))
ups |= set(re.findall(r"/uploads/[^\"'\\s<]+", html))
for u in sorted(ups):
    if "logo" in u.lower() or u.lower().endswith((".svg", ".png", ".jpg", ".webp")):
        print(u[:300])
print("upload count", len(ups))
print("---SAMPLE IMG---")
for u in sorted(urls):
    if any(u.lower().endswith(ext) for ext in (".svg", ".png", ".webp", ".jpg")):
        print(u[:240])
