"""cards-char/NN.png(생성 원본) -> cards-char/NN.webp(앱용, 7:12, 560x960).
00번은 tools/char-anchor-00.png를 쓴다. 실행: python3 tools/build-char-webp.py"""
import os, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "cards-char")
W, H = 560, 960
def convert(src, dst):
    im = Image.open(src).convert("RGB")
    w, h = im.size; target = 7 / 12
    if w / h < target:  # 너무 길면 위아래를 똑같이 잘라 7:12로
        nh = round(w / target); top = (h - nh) // 2; im = im.crop((0, top, w, top + nh))
    else:
        nw = round(h * target); left = (w - nw) // 2; im = im.crop((left, 0, left + nw, h))
    im.resize((W, H), Image.LANCZOS).save(dst, "WEBP", quality=82, method=6)
done = 0
for i in range(78):
    nn = f"{i:02d}"
    src = os.path.join(ROOT, "tools", "char-anchor-00.png") if i == 0 else os.path.join(OUT, nn + ".png")
    if os.path.exists(src):
        convert(src, os.path.join(OUT, nn + ".webp")); done += 1
print("converted", done)
