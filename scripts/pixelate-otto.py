"""Turns generated Otto artwork into assets the app can actually use.

The art arrives as large pictures *of* pixel art rather than as pixel art:
around a megabyte each, forty thousand colours, anti-aliased edges, and — worst
for a character who changes state — a different apparent pixel size in every
pose. Left alone he would visibly change resolution between idle and thinking.

So each pose is put through the same three steps:

  1. The background comes off. Most exports are already transparent; some carry
     a magenta screen or a pale card, and one had a corner that was *nearly*
     transparent rather than transparent, which is worth knowing about — taking
     that as the background colour meant taking black as the background colour,
     and every outline went with it.
  2. The whole canvas is scaled down to a small grid. Never trimmed: trimming
     to content is what makes a figure change size and leave the ground when it
     changes pose. One canvas, one scale, one ground line.
  3. The palette is cut to about forty colours and the alpha is made hard —
     a pixel is in or it is out — so it reads as drawn rather than as
     photographed.

Then @2x and @3x are written by nearest-neighbour from that clean base, because
React Native smooths anything it scales and a soft pixel is a contradiction.

Needs Pillow, which is already on this machine:

    python3 scripts/pixelate-otto.py ~/Downloads/Otto.zip
"""

from PIL import Image
from collections import deque
import os
import shutil
import sys
import tempfile
import zipfile

OUT = os.path.join(os.path.dirname(__file__), "..", "mobile", "assets", "images", "otto")

#: Standing, whole figure. One family — any of these may replace any other.
FULL = (80, 96)
#: Head and shoulders. A second family, and never mixed with the first in the
#: same place on screen: he would change size when he changed mood.
BUST = (80, 96)
#: Round, for a tab bar or a row.
FACE = (64, 64)

JOBS = [
    ("Idle pixel-art Otto with backpack straps.png", "otto-idle", FULL),
    ("Roava Otto walking pixel art.png", "otto-walking", FULL),
    ("Pixel Otto Searching with Binoculars.png", "otto-searching", FULL),
    ("Otto Planning with a Folded Map.png", "otto-planning", FULL),
    ("Otto Typing at His Laptop.png", "otto-typing", FULL),
    ("Otto points right in pixel art.png", "otto-pointing", FULL),
    ("Otto's pixel-art found-it celebration.png", "otto-found", FULL),
    ("Sleeping Otto with backpack.png", "otto-sleeping", FULL),
    ("Curious Otto with Forest Bucket Hat.png", "otto-bust-curious", BUST),
    ("Focused Otto pixel portrait.png", "otto-bust-focused", BUST),
    ("Happy Otto Pixel Portrait.png", "otto-bust-happy", BUST),
    ("Surprised Otto Pixel Portrait.png", "otto-bust-surprised", BUST),
    ("Thoughtful Otto on Magenta.png", "otto-bust-thinking", BUST),
    ("Otto Celebrates with Raised Fists.png", "otto-bust-celebrating", BUST),
    ("Otto Pixel Avatar with Forest Bucket Hat.png", "otto-avatar", FACE),
    ("Otto Pixel Avatar with Green Hat.png", "otto-avatar-alt", FACE),
    ("Pixel Otto Waving in Forest Green.png", "otto-avatar-waving", FACE),
]

#: Below this an alpha channel means transparent. Not zero: one export came
#: back with a corner of (0, 0, 0, 1).
CLEAR = 8
#: How far from the background colour still counts as background. Generous
#: enough for a compressed magenta screen, tight enough to leave the cream
#: circle behind the avatars alone.
TOLERANCE = 90


def strip_background(im):
    """Take off a flat background, if there is one.

    Flooded in from the edges rather than matched across the whole image: only
    what the border can reach is background, so a colour used inside the
    drawing survives even when it matches.
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    r0, g0, b0, a0 = px[0, 0]
    if a0 < CLEAR:
        return im

    seen = bytearray(w * h)
    queue = deque()
    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
    for y in range(h):
        queue.append((0, y))
        queue.append((w - 1, y))

    while queue:
        x, y = queue.popleft()
        if not (0 <= x < w and 0 <= y < h):
            continue
        i = y * w + x
        if seen[i]:
            continue
        r, g, b, a = px[x, y]
        if a < CLEAR:
            seen[i] = 1
            continue
        if abs(r - r0) + abs(g - g0) + abs(b - b0) > TOLERANCE:
            continue
        seen[i] = 1
        px[x, y] = (r, g, b, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def pixelate(path, grid, colours=32):
    im = strip_background(Image.open(path))
    small = im.resize(grid, Image.BOX)
    alpha = small.getchannel("A").point(lambda v: 255 if v > 128 else 0)
    rgb = small.convert("RGB").quantize(colors=colours, method=Image.MEDIANCUT).convert("RGB")
    rgb.putalpha(alpha)
    return rgb


def write(im, name, out):
    im.save(os.path.join(out, f"{name}.png"))
    for scale in (2, 3):
        im.resize((im.width * scale, im.height * scale), Image.NEAREST).save(
            os.path.join(out, f"{name}@{scale}x.png")
        )


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Give it the zip, or a folder of the exports.")
    source = os.path.expanduser(sys.argv[1])
    out = os.path.abspath(OUT)
    os.makedirs(out, exist_ok=True)

    unpacked = None
    if source.endswith(".zip"):
        unpacked = tempfile.mkdtemp()
        with zipfile.ZipFile(source) as z:
            z.extractall(unpacked)
        source = unpacked

    try:
        total = 0
        for filename, name, grid in JOBS:
            path = os.path.join(source, filename)
            if not os.path.exists(path):
                print(f"  ·  {name}: no {filename}")
                continue
            im = pixelate(path, grid)
            write(im, name, out)
            size = sum(
                os.path.getsize(os.path.join(out, f"{name}{s}.png"))
                for s in ("", "@2x", "@3x")
            )
            total += size
            print(f"  ✓  {name:22} {im.width}x{im.height}  {size // 1024} KB")
        print(f"\n{total / 1024 / 1024:.2f} MB in {out}")
    finally:
        if unpacked:
            shutil.rmtree(unpacked, ignore_errors=True)


if __name__ == "__main__":
    main()
