#!/usr/bin/env python3
"""The animated banner: docs/media/intro.svg, for the README and for the landing.

GitHub renders a README image without JavaScript and without web fonts, so the
banner is one self-contained SVG: CSS keyframes and SMIL only, every letter an
outline (shaped with HarfBuzz, drawn with fontTools, each glyph defined once).

Story, then a loop:
  0.0-1.6  the 27 positions appear, nearest first
  0.6-2.8  the links, the hopping, are drawn
  2.4      the dotted half-links at the faces: every axis is closed, T³
  2.8-     quanta of light run along the axes, leave through one face and come
           back through the opposite one; each position breathes in its bubble
  1.0-3.0  title, subtitle, rule
  3.5-     the nine results in turn, each with its Lean name (27 s cycle)

Usage: tools/intro_svg.py [OUT]   (default docs/media/intro.svg)
Needs: pip install fonttools brotli uharfbuzz
Fonts: tools/fonts (Instrument Serif, JetBrains Mono; SIL Open Font License).
"""
import io
import math
import sys
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "docs/media/intro.svg"

W, H = 1600, 800
BG0, BG1 = "#06080b", "#0d1520"
INK, INK2, MUTED, GRID = "#f2f1ee", "#c4c3bf", "#8a8985", "#232b36"
BLUE, WARM, WARM_CORE = "#5b9be6", "#f08a5d", "#fff1e4"

# ---------------------------------------------------------------- lattice ----
CX, CY, S = 432, 390, 132
AZ, EL = math.radians(-33), math.radians(23)
STUB = 0.44
NODES = [(i, j, k) for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1)]
EDGES = [(a, b) for a in range(27) for b in range(a + 1, 27)
         if sum(abs(NODES[a][t] - NODES[b][t]) for t in range(3)) == 1]


def project(p):
    x, y, z = p
    x1 = x * math.cos(AZ) - y * math.sin(AZ)
    y1 = x * math.sin(AZ) + y * math.cos(AZ)
    up = z * math.cos(EL) + y1 * math.sin(EL)
    depth = y1 * math.cos(EL) - z * math.sin(EL)
    return CX + S * x1, CY - S * up, depth


P = [project(n) for n in NODES]
DMIN, DMAX = min(p[2] for p in P), max(p[2] for p in P)


def near(d):
    """1 for the nearest position, 0 for the farthest."""
    return (DMAX - d) / (DMAX - DMIN)


def f(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


# ------------------------------------------------------------- typography ----
class Face:
    def __init__(self, name, key):
        tt = TTFont(ROOT / "fonts" / f"{name}.woff2")
        tt.flavor = None
        buf = io.BytesIO()
        tt.save(buf)
        self.key = key
        self.tt = TTFont(io.BytesIO(buf.getvalue()))
        self.hb = hb.Font(hb.Face(buf.getvalue()))
        self.upem = self.tt["head"].unitsPerEm
        self.gs = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()


SERIF = Face("instrument-serif-latin-400-normal", "s")
SERIF_I = Face("instrument-serif-latin-400-italic", "i")
MONO = Face("jetbrains-mono-latin-400-normal", "m")
MONO_M = Face("jetbrains-mono-latin-500-normal", "b")
GLYPHS = {}          # id -> path data, font units, y down


def glyph_id(face, gid):
    gname = face.order[gid]
    key = f"{face.key}{gid}"
    if key not in GLYPHS:
        pen = SVGPathPen(face.gs)
        face.gs[gname].draw(TransformPen(pen, (1, 0, 0, -1, 0, 0)))
        GLYPHS[key] = pen.getCommands()
    return key if GLYPHS[key] else None


def shape(face, text, tracking=0.0):
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(face.hb, buf, {"kern": True, "liga": True})
    x, out = 0, []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        gid = glyph_id(face, info.codepoint)
        if gid:
            out.append((gid, x + pos.x_offset))
        x += pos.x_advance + tracking * face.upem
    return out, x - tracking * face.upem


def text(face, s, x, y, size, fill, anchor="start", tracking=0.0, cls="", per_glyph=None):
    run, width = shape(face, s, tracking)
    k = size / face.upem
    if anchor == "end":
        x -= width * k
    elif anchor == "middle":
        x -= width * k / 2
    uses = []
    for n, (gid, gx) in enumerate(run):
        extra = per_glyph(n) if per_glyph else ""
        uses.append(f'<use href="#{gid}" x="{gx:.0f}"{extra}/>')
    g = (f'<g fill="{fill}" transform="translate({f(x)} {f(y)}) scale({k:.5f})">'
         + "".join(uses) + "</g>")
    return (f'<g class="{cls}">{g}</g>' if cls else g), width * k


# ---------------------------------------------------------------- content ----
RESULTS = [
    ("Uncertainty relation", "Torus.robertson_det_torus"),
    ("Light share / dark share", "TorusDark.lightShare_add_darkShare"),
    ("Boundary entropy · area law", "TorusBekenstein.bekenstein_bound"),
    ("Saturation · uniform field", "TorusSaturation.saturated_iff_uniform"),
    ("Bakry–Émery curvature", "TorusBochner.not_curvature_pos"),
    ("Lorentz cone", "TorusCone.axisVector_mem_futureCone"),
    ("Dirac operator · doublers", "TorusDirac3.dirac3_sq"),
    ("Einstein / Unruh flow", "CutEinstein.clausius_torus"),
    ("Layered boundaries", "TorusStack.dark_torus"),
]
TICK = 3.0                    # seconds per result
CYCLE = TICK * len(RESULTS)
T0 = 3.5


def build():
    body = []

    # -- background: a cool glow behind the lattice, a vignette at the edges
    body.append(f'<rect width="{W}" height="{H}" rx="18" fill="url(#bg)"/>')
    body.append(f'<rect width="{W}" height="{H}" rx="18" fill="url(#glow)"/>')

    # -- lattice: half-links (closed axes), links, bubbles, positions
    stubs, links, bubbles, dots = [], [], [], []
    for n, (i, j, k) in enumerate(NODES):
        for ax in range(3):
            c = (i, j, k)[ax]
            if c == 0:
                continue
            q = list(NODES[n])
            q[ax] = c * (1 + STUB)
            x0, y0, d0 = P[n]
            x1, y1, _ = project(q)
            o = 0.22 + 0.4 * near(d0)
            stubs.append(f'<path d="M{f(x0)} {f(y0)}L{f(x1)} {f(y1)}" stroke-opacity="{o:.2f}"/>')
    order = sorted(range(len(EDGES)), key=lambda e: -(P[EDGES[e][0]][2] + P[EDGES[e][1]][2]))
    for rank, e in enumerate(order):
        a, b = EDGES[e]
        nr = near((P[a][2] + P[b][2]) / 2)
        delay = 0.6 + 1.6 * (1 - nr) + 0.006 * rank
        links.append(
            f'<path class="ln" d="M{f(P[a][0])} {f(P[a][1])}L{f(P[b][0])} {f(P[b][1])}" pathLength="1" '
            f'stroke-opacity="{0.28 + 0.52 * nr:.2f}" stroke-width="{1.3 + 1.1 * nr:.2f}" '
            f'style="animation-delay:{delay:.2f}s"/>')
    for n in sorted(range(27), key=lambda n: -P[n][2]):
        x, y, d = P[n]
        nr = near(d)
        r = 3.6 + 2.6 * nr
        appear = 0.05 + 1.3 * (1 - nr)
        bubbles.append(
            f'<circle class="bb" cx="{f(x)}" cy="{f(y)}" r="{f(17 + 9 * nr)}" '
            f'style="animation-delay:{appear + 2.2:.2f}s,{2.6 + (n * 0.61) % 6:.2f}s"/>')
        dots.append(
            f'<circle class="nd" cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill-opacity="{0.55 + 0.45 * nr:.2f}" '
            f'style="animation-delay:{appear:.2f}s"/>')
    body.append(f'<g class="stubs" stroke="{BLUE}" stroke-width="2" stroke-linecap="round" '
                f'stroke-dasharray="0 7" fill="none">' + "".join(stubs) + "</g>")
    body.append(f'<g stroke="{BLUE}" stroke-linecap="round" fill="none">' + "".join(links) + "</g>")
    body.append('<g fill="url(#bubble)">' + "".join(bubbles) + "</g>")
    body.append(f'<g fill="{INK}">' + "".join(dots) + "</g>")

    # -- quanta: one per result, along x, y and z; out through a face, back through the other
    lines = [(0, (-1, 0)), (1, (1, -1)), (2, (0, 1)), (0, (1, 1)), (1, (-1, 1)),
             (2, (-1, -1)), (0, (0, -1)), (1, (0, 0)), (2, (1, 0))]
    quanta = []
    for q, (ax, (u, v)) in enumerate(lines):
        def pt(t):
            c = [0, 0, 0]
            c[ax] = t
            others = [a for a in range(3) if a != ax]
            c[others[0]], c[others[1]] = u, v
            return project(c)
        a, b = pt(-1 - STUB), pt(1 + STUB)
        dur = 3.4 + (q * 0.37) % 1.3
        begin = 2.8 + q * 0.83
        path = f"M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}"
        quanta.append(
            f'<g opacity="0"><circle r="15" fill="url(#quantum)"/><circle r="2.6" fill="{WARM_CORE}"/>'
            f'<animateMotion path="{path}" dur="{dur:.2f}s" begin="{begin:.2f}s" repeatCount="indefinite" '
            f'calcMode="spline" keyTimes="0;1" keySplines=".45 .05 .55 .95"/>'
            f'<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.16;.84;1" dur="{dur:.2f}s" '
            f'begin="{begin:.2f}s" repeatCount="indefinite"/></g>')
    body.append('<g class="quanta">' + "".join(quanta) + "</g>")

    # -- lattice caption
    cap, _ = text(MONO, "T³  ·  EVERY AXIS CLOSED", CX, 722, 13, MUTED, "middle", 0.1, "fx d26")
    body.append(cap)

    # -- typography
    X = 830
    kick, _ = text(MONO_M, "LEAN 4  ·  STANDARD AXIOMS", X, 236, 14, BLUE, tracking=0.2, cls="fx d10")
    body.append(kick)
    title_run = "BACQM-NRS"
    title, tw = text(SERIF, title_run, X - 4, 352, 132, INK, cls="ttl",
                     per_glyph=lambda n: f' style="animation-delay:{1.05 + 0.06 * n:.2f}s"')
    body.append(title)
    sup, _ = text(SERIF, "3", X - 4 + tw + 6, 300, 66, INK, cls="ttl",
                  per_glyph=lambda n: ' style="animation-delay:1.65s"')
    body.append(sup)
    sub, _ = text(SERIF_I, "Uncertainty on the three-torus", X, 412, 42, INK2, cls="fx d17")
    body.append(sub)
    body.append(f'<path class="rule" d="M{X} 462H1510" stroke="{GRID}" stroke-width="1.5" pathLength="1"/>')
    body.append(f'<path class="rule r2" d="M{X} 462H{X + 64}" stroke="{BLUE}" stroke-width="2.5" pathLength="1"/>')

    ticks = []
    for n, (name, lean) in enumerate(RESULTS):
        num, _ = text(MONO, f"{n + 1:02d} / {len(RESULTS):02d}", X, 506, 13, MUTED, tracking=0.14)
        nm, _ = text(SERIF, name, X, 560, 38, INK)
        ln, _ = text(MONO, lean, X, 598, 16, BLUE)
        ticks.append(f'<g class="tk" style="animation-delay:{T0 + n * TICK:.1f}s">{num}{nm}{ln}</g>')
    body.append('<g class="ticker">' + "".join(ticks) + "</g>")
    body.append(f'<path d="M{X} 630H{X + 220}" stroke="{GRID}" stroke-width="2" stroke-linecap="round"/>')
    body.append(f'<path class="prog" d="M{X} 630H{X + 220}" stroke="{WARM}" stroke-width="2" '
                f'stroke-linecap="round" pathLength="1"/>')

    foot, _ = text(MONO, "R³  ·  T³  ·  FIBRED BOX  ·  T³ × w", X, 722, 13, MUTED,
                   tracking=0.08, cls="fx d26")
    body.append(foot)
    site, sw = text(MONO_M, "OPEN THE SITE", 1490, 722, 13, INK, "end", 0.18, "fx d30")
    body.append(site)
    body.append(f'<path class="fx d30" d="M1496 717.5h14m-5-5 5 5-5 5" stroke="{WARM}" stroke-width="1.6" '
                f'fill="none" stroke-linecap="round" stroke-linejoin="round"/>')

    defs = [
        f'<radialGradient id="bg" cx="27%" cy="48%" r="85%"><stop offset="0" stop-color="{BG1}"/>'
        f'<stop offset="1" stop-color="{BG0}"/></radialGradient>',
        f'<radialGradient id="glow" cx="27%" cy="50%" r="32%"><stop offset="0" stop-color="{BLUE}" stop-opacity=".09"/>'
        f'<stop offset="1" stop-color="{BLUE}" stop-opacity="0"/></radialGradient>',
        f'<radialGradient id="bubble"><stop offset=".55" stop-color="{BLUE}" stop-opacity="0"/>'
        f'<stop offset=".92" stop-color="{BLUE}" stop-opacity=".22"/><stop offset="1" stop-color="{BLUE}" stop-opacity="0"/></radialGradient>',
        f'<radialGradient id="quantum"><stop offset="0" stop-color="{WARM}" stop-opacity=".85"/>'
        f'<stop offset=".35" stop-color="{WARM}" stop-opacity=".28"/><stop offset="1" stop-color="{WARM}" stop-opacity="0"/></radialGradient>',
    ] + [f'<path id="{k}" d="{d}"/>' for k, d in GLYPHS.items()]

    tick_in = 100 * 0.45 / CYCLE
    tick_hold = 100 * (TICK - 0.35) / CYCLE
    tick_out = 100 * TICK / CYCLE
    css = f"""
.ln{{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.1s cubic-bezier(.6,0,.2,1) both}}
.nd{{transform-box:fill-box;transform-origin:center;animation:pop .9s cubic-bezier(.2,.9,.3,1.25) both}}
.bb{{opacity:.35;animation:fade 1s ease-out both,breathe 6s ease-in-out infinite alternate}}
.stubs{{animation:fade 1.4s 2.4s ease-out both}}
.ttl use{{animation:riseg 1.1s cubic-bezier(.2,.8,.2,1) both}}
.fx{{animation:rise 1s cubic-bezier(.2,.8,.2,1) both}}
.d10{{animation-delay:1s}}.d17{{animation-delay:1.7s}}.d26{{animation-delay:2.6s}}.d30{{animation-delay:3s}}
.rule{{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.4s 2s cubic-bezier(.6,0,.2,1) both}}
.r2{{animation-delay:2.5s}}
.tk{{opacity:0;animation:tick {CYCLE:.0f}s linear infinite both}}
.prog{{stroke-dasharray:1;stroke-dashoffset:1;animation:draw {TICK:.0f}s {T0}s linear infinite both}}
@keyframes draw{{to{{stroke-dashoffset:0}}}}
@keyframes pop{{from{{opacity:0;transform:scale(0)}}to{{opacity:1;transform:scale(1)}}}}
@keyframes riseg{{from{{opacity:0;transform:translateY(160px)}}to{{opacity:1;transform:none}}}}
@keyframes fade{{from{{opacity:0}}}}
@keyframes breathe{{from{{opacity:.12}}to{{opacity:.6}}}}
@keyframes rise{{from{{opacity:0;transform:translateY(18px)}}to{{opacity:1;transform:none}}}}
@keyframes tick{{0%{{opacity:0;transform:translateY(10px)}}{tick_in:.2f}%{{opacity:1;transform:none}}
{tick_hold:.2f}%{{opacity:1;transform:none}}{tick_out:.2f}%,100%{{opacity:0;transform:translateY(-6px)}}}}
@media (prefers-reduced-motion:reduce){{
*{{animation:none!important}}.ln,.rule,.prog{{stroke-dashoffset:0}}.quanta{{display:none}}
.tk{{opacity:0}}.tk:first-child{{opacity:1}}}}
"""
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
           f'role="img" aria-label="BACQM-NRS³ — uncertainty on the three-torus. Nine results, each with its Lean 4 theorem.">'
           f'<title>BACQM-NRS³ — uncertainty on the three-torus</title>'
           f'<style>{" ".join(css.split())}</style><defs>{"".join(defs)}</defs>{"".join(body)}</svg>\n')
    return svg


if __name__ == "__main__":
    s = build()
    OUT.write_text(s)
    print(f"{OUT}  {len(s.encode()) / 1024:.1f} KB  {len(GLYPHS)} glyphs")
