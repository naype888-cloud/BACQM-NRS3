#!/usr/bin/env python3
"""The landing intro: frames of the 3 x 3 x 3 lattice, written as PNG for ffmpeg.

Story, 12 s at 30 fps, ending on the poster (docs/media/intro-poster.svg):
  0.0-1.5  black: nothing has happened yet
  1.0-4.0  the positions appear and the links between them, the hopping, are drawn
  3.5-8.5  light runs along the links; each position sits in a transparent bubble
  7.5-9.8  the lattice turns into the isometric view of the poster, the bubbles fade
  9.0-12   the title and the subtitle

Usage: tools/intro_video.py OUTDIR   (then tools/intro_video.sh encodes it)
"""
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

W, H, SS = 1920, 1080, 2          # output size and supersampling
FPS, SECONDS = 30, 12.0
BG = (15, 15, 14)
BLUE = (91, 155, 230)
INK = (242, 241, 238)
MUTED = (138, 137, 133)
CX, CY, A = 960, 430, 120         # the poster: centre and edge length
ISO_AZ, ISO_EL = -math.pi / 4, math.atan(1 / math.sqrt(2))
FONT_BOLD = "/usr/share/fonts/open-sans/OpenSans-Semibold.ttf"
FONT_REG = "/usr/share/fonts/open-sans/OpenSans-Regular.ttf"

NODES = [(i, j, k) for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1)]
EDGES = [(a, b) for a in range(27) for b in range(a + 1, 27)
         if sum(abs(NODES[a][t] - NODES[b][t]) for t in range(3)) == 1]


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def ease(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def ramp(t, t0, t1):
    return ease((t - t0) / (t1 - t0))


def project(p, az, el):
    """Orthographic view: turn by `az` about the vertical axis, tilt by `el`."""
    x, y, z = p
    x1, y1 = x * math.cos(az) - y * math.sin(az), x * math.sin(az) + y * math.cos(az)
    depth = y1 * math.cos(el) - z * math.sin(el)
    up = y1 * math.sin(el) + z * math.cos(el)
    s = A / math.cos(ISO_EL)
    return CX + s * x1, CY - s * up, depth


def mix(c, k):
    return tuple(int(BG[t] + (c[t] - BG[t]) * k) for t in range(3))


def frame(t, pulses, font_t, font_s):
    big = (W * SS, H * SS)
    base = Image.new("RGB", big, BG)
    glow = Image.new("RGB", big, (0, 0, 0))
    d, g = ImageDraw.Draw(base), ImageDraw.Draw(glow)
    S = lambda v: v * SS

    settle = ramp(t, 7.5, 9.8)
    az = ISO_AZ - (1 - settle) * (0.55 + 1.35 * math.pi * (1 - ramp(t, 1.0, 9.8)))
    el = ISO_EL - (1 - settle) * 0.32
    pts = [project(p, az, el) for p in NODES]

    appear = [ramp(t, 1.0 + 0.06 * n, 1.6 + 0.06 * n) for n in range(27)]
    links = ramp(t, 2.0, 4.0)
    bubbles = ramp(t, 3.5, 5.0) * (1 - ramp(t, 7.8, 9.4))
    light = ramp(t, 3.5, 4.5) * (1 - ramp(t, 8.6, 9.6))

    # the light: excitations hopping along the links
    heat = [0.0] * 27
    for (a, b, t0) in pulses:
        u = (t - t0) / 0.7
        if 0 <= u <= 1 and light > 0:
            (xa, ya, _), (xb, yb, _) = pts[a], pts[b]
            x, y = xa + (xb - xa) * u, ya + (yb - ya) * u
            for rr, cc in ((22, mix(BLUE, light)), (7, mix(INK, light))):
                g.ellipse([S(x - rr), S(y - rr), S(x + rr), S(y + rr)], fill=cc)
        if 0.85 <= u <= 1.6:
            heat[b] = max(heat[b], light * (1 - abs(u - 1.0) / 0.6))

    # the links: the plastic between the bubbles
    for a, b in EDGES:
        k = links * min(appear[a], appear[b])
        if k <= 0:
            continue
        (xa, ya, _), (xb, yb, _) = pts[a], pts[b]
        xe, ye = xa + (xb - xa) * k, ya + (yb - ya) * k
        d.line([S(xa), S(ya), S(xe), S(ye)], fill=mix(BLUE, 0.55), width=S(2))

    # the bubbles: transparent, a thin film around each position
    if bubbles > 0:
        lay = Image.new("RGBA", big, (0, 0, 0, 0))
        ld = ImageDraw.Draw(lay)
        r = S(52)
        for n in sorted(range(27), key=lambda n: -pts[n][2]):
            x, y = S(pts[n][0]), S(pts[n][1])
            al = bubbles * appear[n]
            lit = heat[n]
            ld.ellipse([x - r, y - r, x + r, y + r], fill=(*BLUE, int((16 + 40 * lit) * al)),
                       outline=(*INK, int((80 + 150 * lit) * al)), width=S(1) + int(S(1) * lit))
            ld.arc([x - r * 0.72, y - r * 0.72, x + r * 0.72, y + r * 0.72], 200, 250,
                   fill=(*INK, int(150 * al)), width=S(2))
        base = Image.alpha_composite(base.convert("RGBA"), lay).convert("RGB")
        d = ImageDraw.Draw(base)

    # the positions
    for n in sorted(range(27), key=lambda n: -pts[n][2]):
        if appear[n] <= 0:
            continue
        x, y, _ = pts[n]
        r = 7 * appear[n]
        d.ellipse([S(x - r), S(y - r), S(x + r), S(y + r)], fill=mix(INK, appear[n]))
        if heat[n] > 0:
            rr = 22
            g.ellipse([S(x - rr), S(y - rr), S(x + rr), S(y + rr)], fill=mix(BLUE, 0.8 * heat[n]))

    out = ImageChops.add(base, glow.filter(ImageFilter.GaussianBlur(S(9))))

    # the title
    ti, su = ramp(t, 9.0, 10.2), ramp(t, 9.7, 10.9)
    od = ImageDraw.Draw(out)
    if ti > 0:
        dy = (1 - ti) * 18
        od.text((S(960), S(830 + dy)), "BACQM-NRS³", font=font_t, fill=mix(INK, ti), anchor="ms")
    if su > 0:
        od.text((S(960), S(900)), "uncertainty on the three-torus · Lean 4", font=font_s,
                fill=mix(MUTED, su), anchor="ms")
    return out.resize((W, H), Image.LANCZOS)


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    rnd = random.Random(1934)
    adj = {n: [] for n in range(27)}
    for a, b in EDGES:
        adj[a].append(b)
        adj[b].append(a)
    pulses, walkers = [], [13, 0, 26, 4, 22]
    t0 = 3.4
    while t0 < 8.6:
        for w in range(len(walkers)):
            nxt = rnd.choice(adj[walkers[w]])
            pulses.append((walkers[w], nxt, t0 + 0.11 * w))
            walkers[w] = nxt
        t0 += 0.62
    font_t = ImageFont.truetype(FONT_BOLD, 96 * SS)
    font_s = ImageFont.truetype(FONT_REG, 36 * SS)
    for f in range(int(FPS * SECONDS)):
        frame(f / FPS, pulses, font_t, font_s).save(out / f"f{f:04d}.png")


if __name__ == "__main__":
    main()
