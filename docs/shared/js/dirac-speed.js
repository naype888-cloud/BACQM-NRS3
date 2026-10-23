// The mass gap and the speed limit of one closed axis with a Dirac mass m (DiracSpeed, TorusDiracBound,
// DiracQubit in nrs3-tritoro). At momentum k the transport is cos k and the energy E = ±√(cos²k + m²);
// the velocity of the eigenstate is the slope of its band, v = dE/dk = −sin k cos k / E.
// Lean: |E| ≥ |m| for every eigenvalue, |v| ≤ r = √(1 + m²) − |m| for every eigenstate, reached only at
// cos²k = |m| r; m = sinh θ gives r = e^{−θ}. The fibre of three positions gives m = 1/2 (rotating
// modes, r = 1/φ) and m = 1 (uniform mode, r = √2 − 1).
// Fills <div id="dspeed"></div>; redraws on resize and on a theme change.
(() => {
  const host = document.getElementById("dspeed");
  if (!host) return;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const PHI = (1 + Math.sqrt(5)) / 2;
  let m = 0.5, k = null;

  host.innerHTML = `
    <div class="ds-bar">
      <div class="chips" role="group" aria-label="Mass">
        <button class="chip" type="button" data-m="0">m = 0 · no fibre</button>
        <button class="chip" type="button" data-m="0.5">m = ½ · fibre, rotating mode</button>
        <button class="chip" type="button" data-m="1">m = 1 · fibre, uniform mode</button>
      </div>
      <label class="sl ds-sl">m<input type="range" id="ds-m" min="0" max="2" step="0.01" value="0.5"
        aria-label="Dirac mass m"><b id="ds-mv">0.50</b></label>
    </div>
    <div class="ds-grid">
      <figure class="ds-pane"><figcaption>Energy of one closed axis, <code>E = ±√(cos²k + m²)</code></figcaption>
        <canvas id="ds-band" aria-label="The two Dirac bands of one closed axis and the gap between them"></canvas></figure>
      <figure class="ds-pane"><figcaption>Velocity of each state = slope of its band</figcaption>
        <canvas id="ds-vel" aria-label="The velocity of every eigenstate and the speed limit"></canvas></figure>
    </div>
    <div class="ds-read" aria-live="polite">
      <div><span class="k">mass gap</span><span id="ds-gap">–</span></div>
      <div><span class="k">speed limit r = √(1 + m²) − m</span><span id="ds-r">–</span></div>
      <div><span class="k">rapidity θ, m = sinh θ</span><span id="ds-th">–</span></div>
      <div><span class="k">fastest state, cos²k = m·r</span><span id="ds-k">–</span></div>
    </div>`;

  const style = document.createElement("style");
  style.textContent = `
    #dspeed .ds-bar { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; margin: 6px 4px 10px; }
    #dspeed .ds-sl { min-width: 220px; flex: 1; max-width: 360px; }
    #dspeed .ds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 820px) { #dspeed .ds-grid { grid-template-columns: 1fr; } }
    #dspeed figure { margin: 0; }
    #dspeed figcaption { font-size: .85rem; font-weight: 600; color: var(--ink2); margin: 2px 4px 6px; }
    #dspeed canvas { width: 100%; aspect-ratio: 8 / 5; display: block; cursor: crosshair; touch-action: pan-y; }
    #dspeed .ds-read { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 4px 34px; }
    @media (max-width: 820px) { #dspeed .ds-read { grid-template-columns: 1fr 1fr; } }
    #dspeed .ds-read div { border: 1px solid var(--grid); border-radius: 8px; padding: 6px 9px;
      font-variant-numeric: tabular-nums; font-size: .9rem; }
    #dspeed .ds-read .k { display: block; color: var(--muted); font-size: .74rem; }
    #dspeed .ds-read b { color: var(--violet); font-weight: 650; }`;
  document.head.appendChild(style);

  const $ = (id) => document.getElementById(id);
  const band = $("ds-band"), vel = $("ds-vel"), slider = $("ds-m");

  const r = () => Math.sqrt(1 + m * m) - m;
  const E = (q) => Math.sqrt(Math.cos(q) ** 2 + m * m);
  const V = (q) => { const e = E(q); return e < 1e-9 ? 0 : -Math.sin(q) * Math.cos(q) / e; };
  // The four momenta in (−π, π] where the limit is reached: cos²k = m r.
  const fastest = () => {
    if (m < 1e-9) return [Math.PI / 2, -Math.PI / 2];
    const a = Math.acos(Math.sqrt(m * r()));
    return [a, -a, Math.PI - a, a - Math.PI];
  };

  function setup(c) {
    const b = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(b.width * dpr), h = Math.round(b.height * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, b.width, b.height);
    return [g, b.width, b.height];
  }
  const frame = (W, H) => ({ L: 34, R: W - 24, T: 12, B: H - 26 });
  const xOf = (f, q) => f.L + (q + Math.PI) / (2 * Math.PI) * (f.R - f.L);
  const kOf = (f, x) => -Math.PI + (x - f.L) / (f.R - f.L) * 2 * Math.PI;
  const yOf = (f, y, lo, hi) => f.B - (y - lo) / (hi - lo) * (f.B - f.T);
  const label = (g, s, x, y, col, align = "left", size = 11) => {
    g.font = `${size}px system-ui, sans-serif`; g.fillStyle = col; g.textAlign = align; g.fillText(s, x, y);
  };

  function axes(g, f, lo, hi, ticks) {
    g.strokeStyle = css("--grid"); g.lineWidth = 1;
    g.strokeRect(f.L, f.T, f.R - f.L, f.B - f.T);
    for (const [q, s] of [[-Math.PI, "−π"], [-Math.PI / 2, "−π/2"], [0, "0"], [Math.PI / 2, "π/2"], [Math.PI, "π"]]) {
      const x = xOf(f, q);
      g.beginPath(); g.moveTo(x, f.T); g.lineTo(x, f.B); g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
      label(g, s, x, f.B + 15, css("--muted"), "center", 10.5);
    }
    for (const [y, s] of ticks) label(g, s, f.L - 5, yOf(f, y, lo, hi) + 4, css("--muted"), "right", 10.5);
    label(g, "k", f.R + 18, f.B + 15, css("--muted"), "right", 10.5);
  }
  function curve(g, f, fn, lo, hi, col, width = 2, dash = []) {
    g.strokeStyle = col; g.lineWidth = width; g.setLineDash(dash); g.beginPath();
    for (let i = 0; i <= 360; i++) {
      const q = -Math.PI + 2 * Math.PI * i / 360, x = xOf(f, q), y = yOf(f, fn(q), lo, hi);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke(); g.setLineDash([]);
  }
  const dot = (g, x, y, col, rad = 4.5) => {
    g.fillStyle = col; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    g.strokeStyle = css("--panel"); g.lineWidth = 1.5; g.stroke();
  };

  function drawBand() {
    const [g, W, H] = setup(band), f = frame(W, H), lo = -2.3, hi = 2.3;
    // the gap: no eigenvalue has |E| < m
    if (m > 0) {
      g.fillStyle = css("--red"); g.globalAlpha = 0.13;
      g.fillRect(f.L, yOf(f, m, lo, hi), f.R - f.L, yOf(f, -m, lo, hi) - yOf(f, m, lo, hi)); g.globalAlpha = 1;
      label(g, `gap: no energy with |E| < ${fmt(m)}`, xOf(f, 0), yOf(f, 0, lo, hi) + 4, css("--red"), "center", 11);
    }
    axes(g, f, lo, hi, [[2, "2"], [1, "1"], [0, "0"], [-1, "−1"], [-2, "−2"]]);
    // m = 0: the doublers close the gap at k = ±π/2
    curve(g, f, (q) => Math.abs(Math.cos(q)), lo, hi, css("--muted"), 1.2, [4, 4]);
    curve(g, f, (q) => -Math.abs(Math.cos(q)), lo, hi, css("--muted"), 1.2, [4, 4]);
    curve(g, f, E, lo, hi, css("--violet"), 2.2);
    curve(g, f, (q) => -E(q), lo, hi, css("--blue"), 2.2);
    for (const q of fastest()) dot(g, xOf(f, q), yOf(f, E(q), lo, hi), css("--orange"));
    if (k !== null) {
      // the tangent at the chosen momentum: its slope is the velocity
      const x0 = xOf(f, k), y0 = yOf(f, E(k), lo, hi), sx = (f.R - f.L) / (2 * Math.PI), sy = (f.B - f.T) / (hi - lo);
      const s = V(k) * sy / sx, d = 46;
      g.strokeStyle = css("--ink"); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x0 - d, y0 + s * d); g.lineTo(x0 + d, y0 - s * d); g.stroke();
      dot(g, x0, y0, css("--ink"), 4);
    }
    label(g, "dashed: m = 0", f.R - 6, f.T + 14, css("--muted"), "right", 10.5);
  }

  function drawVel() {
    const [g, W, H] = setup(vel), f = frame(W, H), lo = -1.12, hi = 1.12, lim = r();
    // the cone, |v| = 1, and the band the mass allows, |v| ≤ r
    g.fillStyle = css("--green"); g.globalAlpha = 0.1;
    g.fillRect(f.L, yOf(f, lim, lo, hi), f.R - f.L, yOf(f, -lim, lo, hi) - yOf(f, lim, lo, hi)); g.globalAlpha = 1;
    axes(g, f, lo, hi, [[1, "1"], [0.5, "½"], [0, "0"], [-0.5, "−½"], [-1, "−1"]]);
    for (const y of [1, -1]) {
      g.strokeStyle = css("--ink2"); g.lineWidth = 1; g.beginPath();
      g.moveTo(f.L, yOf(f, y, lo, hi)); g.lineTo(f.R, yOf(f, y, lo, hi)); g.stroke();
    }
    label(g, "light cone, |v| = 1", f.R - 6, yOf(f, 1, lo, hi) - 4, css("--ink2"), "right", 10.5);
    for (const y of [lim, -lim]) {
      g.strokeStyle = css("--orange"); g.lineWidth = 1.4; g.setLineDash([6, 4]); g.beginPath();
      g.moveTo(f.L, yOf(f, y, lo, hi)); g.lineTo(f.R, yOf(f, y, lo, hi)); g.stroke(); g.setLineDash([]);
    }
    label(g, `limit r = ${fmt(lim, 4)}${named(lim)}`, f.L + 8, yOf(f, lim, lo, hi) - 5, css("--orange"), "left", 11);
    curve(g, f, V, lo, hi, css("--violet"), 2.2);
    for (const q of fastest()) dot(g, xOf(f, q), yOf(f, V(q), lo, hi), css("--orange"));
    if (k !== null) {
      dot(g, xOf(f, k), yOf(f, V(k), lo, hi), css("--ink"), 4);
      label(g, `v(${fmt(k, 2)}) = ${fmt(V(k), 3)}`, Math.min(f.R - 70, xOf(f, k) + 8), yOf(f, V(k), lo, hi) - 8,
        css("--ink"), "left", 11);
    }
  }

  const fmt = (x, n = 2) => (Math.abs(x) < 5e-13 ? 0 : x).toFixed(n).replace("-", "−");
  const near = (a, b) => Math.abs(a - b) < 5e-4;
  function named(x) {
    if (near(x, 1 / PHI)) return " = 1/φ";
    if (near(x, Math.SQRT2 - 1)) return " = √2 − 1";
    if (near(x, 1)) return " = c";
    return "";
  }
  function read() {
    const lim = r(), th = Math.asinh(m);
    $("ds-mv").textContent = fmt(m);
    $("ds-gap").innerHTML = m > 0 ? `|E| ≥ <b>${fmt(m)}</b>` : "none: the doublers reach E = 0";
    $("ds-r").innerHTML = `<b>${fmt(lim, 4)}</b>${named(lim)}`;
    $("ds-th").innerHTML = `θ = ${fmt(th, 4)}${near(th, Math.log(PHI)) ? " = log φ" : ""} · e<sup>−θ</sup> = ${fmt(Math.exp(-th), 4)}`;
    $("ds-k").innerHTML = m > 0
      ? `cos²k = <b>${fmt(m * lim, 4)}</b>${near(m * lim, 1 / (2 * PHI)) ? " = 1/(2φ)" : ""}`
      : "cos²k → 0: the corner k = ±π/2";
    host.querySelectorAll("button[data-m]").forEach((b) => b.setAttribute("aria-pressed", String(near(+b.dataset.m, m))));
  }
  function draw() { read(); drawBand(); drawVel(); }

  slider.addEventListener("input", () => { m = +slider.value; draw(); });
  host.querySelectorAll("button[data-m]").forEach((b) => b.addEventListener("click", () => {
    m = +b.dataset.m; slider.value = m; draw();
  }));
  for (const c of [band, vel]) {
    c.addEventListener("pointermove", (e) => {
      const f = frame(c.getBoundingClientRect().width, c.getBoundingClientRect().height);
      const x = e.clientX - c.getBoundingClientRect().left;
      k = x < f.L || x > f.R ? null : kOf(f, x); draw();
    });
    c.addEventListener("pointerleave", () => { k = null; draw(); });
  }
  new ResizeObserver(draw).observe(host);
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  draw();
})();
