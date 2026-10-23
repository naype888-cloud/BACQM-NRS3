// Position events on one closed axis (EventsTopology, SiteEvents in nrs3-tritoro). The event "the
// excitation is at j" has probability p_j = |ψ_j|²; under the transport T° its rate is the flow through
// the two links of j, rate_j = F_{j−1} − F_j with F_j = Im(conj ψ_{j+1} · ψ_j) (continuity). The rates
// add up to 0, the flows add up to the velocity ⟨K⟩, and each rate obeys Robertson for bits,
// rate_j² ≤ 4 Var T° · p_j (1 − p_j). Here ψ(s) = e^{−isT°} ψ(0), computed from the modes of the ring.
// Fills <div id="sflow"></div>; redraws on resize and on a theme change.
(() => {
  const host = document.getElementById("sflow");
  if (!host) return;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let L = 8, kind = "packet", s = 0, playing = false, last = 0;
  let modes = [], amp = [];

  host.innerHTML = `
    <div class="sf-bar">
      <div class="chips" role="group" aria-label="Initial state">
        <button class="chip" type="button" data-k="one">one position</button>
        <button class="chip" type="button" data-k="packet">moving packet</button>
        <button class="chip" type="button" data-k="still">definite energy</button>
      </div>
      <button class="act" type="button" id="sf-play" aria-pressed="false">▶ Transport</button>
      <button class="act" type="button" id="sf-reset">s = 0</button>
      <label class="sl sf-sl">positions<input type="range" id="sf-L" min="3" max="16" value="8"
        aria-label="Positions on the ring"><b id="sf-Lv">8</b></label>
    </div>
    <div class="sf-grid">
      <figure><figcaption>The ring: <span class="sf-k">disc</span> p<sub>j</sub>, <span class="sf-k">arrow</span> flow F<sub>j</sub> through each link</figcaption>
        <canvas id="sf-ring" aria-label="The ring of positions with probabilities and link flows"></canvas></figure>
      <figure><figcaption>The rate of each position and its Robertson bound</figcaption>
        <canvas id="sf-bars" aria-label="The rate of each position event against its Robertson bound"></canvas></figure>
    </div>
    <div class="sf-read" aria-live="polite">
      <div><span class="k">Σ rate<sub>j</sub> (nothing is lost)</span><span id="sf-sum">–</span></div>
      <div><span class="k">velocity ⟨K⟩ = Σ F<sub>j</sub></span><span id="sf-vel">–</span></div>
      <div><span class="k">Var T° (constant in s)</span><span id="sf-var">–</span></div>
      <div><span class="k">largest |rate| / bound</span><span id="sf-rob">–</span></div>
    </div>`;

  const style = document.createElement("style");
  style.textContent = `
    #sflow .sf-bar { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; margin: 6px 4px 10px; }
    #sflow .sf-sl { min-width: 200px; flex: 1; max-width: 320px; }
    #sflow .sf-grid { display: grid; grid-template-columns: 1fr 1.3fr; gap: 14px; }
    @media (max-width: 820px) { #sflow .sf-grid { grid-template-columns: 1fr; } }
    #sflow figure { margin: 0; }
    #sflow figcaption { font-size: .85rem; font-weight: 600; color: var(--ink2); margin: 2px 4px 6px; }
    #sflow .sf-k { color: var(--muted); font-weight: 500; }
    #sflow canvas { width: 100%; display: block; cursor: default; touch-action: pan-y; }
    #sf-ring { aspect-ratio: 1 / 1; max-height: 420px; }
    #sf-bars { aspect-ratio: 13 / 10; max-height: 420px; }
    #sflow .sf-read { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 4px 34px; }
    @media (max-width: 820px) { #sflow .sf-read { grid-template-columns: 1fr 1fr; } }
    #sflow .sf-read div { border: 1px solid var(--grid); border-radius: 8px; padding: 6px 9px;
      font-variant-numeric: tabular-nums; font-size: .9rem; }
    #sflow .sf-read .k { display: block; color: var(--muted); font-size: .74rem; }`;
  document.head.appendChild(style);

  const $ = (id) => document.getElementById(id);
  const ring = $("sf-ring"), bars = $("sf-bars");

  // The modes e^{2πi m j / L}/√L of T°, eigenvalue cos(2πm/L), and the amplitudes of ψ(0) on them.
  function prepare() {
    const psi = [];
    for (let j = 0; j < L; j++) {
      if (kind === "one") psi.push([j === 0 ? 1 : 0, 0]);
      else if (kind === "still") psi.push([Math.cos(2 * Math.PI * j / L), 0]);
      else {
        const d = Math.min(j, L - j), g = Math.exp(-(d * d) / (2 * Math.max(0.6, L / 7) ** 2)), ph = -Math.PI / 2 * j;
        psi.push([g * Math.cos(ph), g * Math.sin(ph)]);
      }
    }
    const n = Math.sqrt(psi.reduce((t, [a, b]) => t + a * a + b * b, 0));
    modes = []; amp = [];
    for (let m = 0; m < L; m++) {
      let re = 0, im = 0;
      for (let j = 0; j < L; j++) {
        const th = -2 * Math.PI * m * j / L, c = Math.cos(th), sn = Math.sin(th);
        re += (psi[j][0] * c - psi[j][1] * sn) / n; im += (psi[j][0] * sn + psi[j][1] * c) / n;
      }
      modes.push(Math.cos(2 * Math.PI * m / L)); amp.push([re / Math.sqrt(L), im / Math.sqrt(L)]);
    }
  }
  function state() {
    const out = [];
    for (let j = 0; j < L; j++) {
      let re = 0, im = 0;
      for (let m = 0; m < L; m++) {
        const th = -s * modes[m] + 2 * Math.PI * m * j / L, c = Math.cos(th), sn = Math.sin(th);
        re += (amp[m][0] * c - amp[m][1] * sn) / Math.sqrt(L); im += (amp[m][0] * sn + amp[m][1] * c) / Math.sqrt(L);
      }
      out.push([re, im]);
    }
    return out;
  }
  function stats() {
    const psi = state(), p = psi.map(([a, b]) => a * a + b * b);
    // F_j = Im(conj ψ_{j+1} · ψ_j)
    const F = psi.map((u, j) => { const v = psi[(j + 1) % L]; return v[0] * u[1] - v[1] * u[0]; });
    const rate = F.map((f, j) => F[(j - 1 + L) % L] - f);
    let e1 = 0, e2 = 0;
    amp.forEach(([a, b], m) => { const w = a * a + b * b; e1 += w * modes[m]; e2 += w * modes[m] ** 2; });
    const v = Math.max(0, e2 - e1 * e1);
    const bound = p.map((q) => 2 * Math.sqrt(v * q * Math.max(0, 1 - q)));
    return { p, F, rate, v, bound };
  }

  function setup(c) {
    const b = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(b.width * dpr), h = Math.round(b.height * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, b.width, b.height);
    return [g, b.width, b.height];
  }
  const label = (g, t, x, y, col, align = "center", size = 11) => {
    g.font = `${size}px system-ui, sans-serif`; g.fillStyle = col; g.textAlign = align; g.fillText(t, x, y);
  };
  const fmt = (x, n = 3) => (Math.abs(x) < 5 * 10 ** -(n + 1) ? 0 : x).toFixed(n).replace("-", "−");

  function drawRing(S) {
    const [g, W, H] = setup(ring), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36;
    const at = (j) => [cx + R * Math.sin(2 * Math.PI * j / L), cy - R * Math.cos(2 * Math.PI * j / L)];
    g.strokeStyle = css("--grid"); g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    const fmax = Math.max(0.05, ...S.F.map(Math.abs));
    // the flow through each link: the arrow points the way probability moves
    for (let j = 0; j < L; j++) {
      const f = S.F[j]; if (Math.abs(f) < 1e-4) continue;
      const a0 = 2 * Math.PI * j / L, a1 = 2 * Math.PI * (j + 1) / L, am = (a0 + a1) / 2, dir = Math.sign(f);
      const w = 1 + 6 * Math.abs(f) / fmax;
      g.strokeStyle = css("--orange"); g.lineWidth = w; g.globalAlpha = 0.9;
      g.beginPath(); g.arc(cx, cy, R, a0 - Math.PI / 2 + 0.18, a1 - Math.PI / 2 - 0.18); g.stroke();
      const mx = cx + R * Math.sin(am), my = cy - R * Math.cos(am);
      const tx = Math.cos(am) * dir, ty = Math.sin(am) * dir, hs = 5 + w;
      g.fillStyle = css("--orange"); g.beginPath();
      g.moveTo(mx + tx * hs, my + ty * hs);
      g.lineTo(mx - tx * hs * 0.6 - ty * hs * 0.7, my - ty * hs * 0.6 + tx * hs * 0.7);
      g.lineTo(mx - tx * hs * 0.6 + ty * hs * 0.7, my - ty * hs * 0.6 - tx * hs * 0.7);
      g.fill(); g.globalAlpha = 1;
    }
    const rmax = Math.min(R * Math.sin(Math.PI / L) * 0.95, Math.min(W, H) * 0.09);
    for (let j = 0; j < L; j++) {
      const [x, y] = at(j);
      g.fillStyle = css("--panel"); g.strokeStyle = css("--grid"); g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, rmax, 0, 7); g.fill(); g.stroke();
      g.fillStyle = css("--violet"); g.beginPath(); g.arc(x, y, Math.max(1.2, rmax * Math.sqrt(S.p[j])), 0, 7); g.fill();
      const lx = cx + (R + rmax + 11) * Math.sin(2 * Math.PI * j / L), ly = cy - (R + rmax + 11) * Math.cos(2 * Math.PI * j / L);
      label(g, String(j), lx, ly + 4, css("--muted"), "center", 10.5);
    }
    label(g, `s = ${s.toFixed(2)}`, cx, cy - 4, css("--ink2"), "center", 12);
    label(g, `⟨K⟩ = ${fmt(S.F.reduce((t, f) => t + f, 0))}`, cx, cy + 14, css("--muted"), "center", 11);
  }

  function drawBars(S) {
    const [g, W, H] = setup(bars), l = 36, r = W - 8, t = 18, b = H - 24, mid = (t + b) / 2;
    const top = Math.max(0.05, ...S.bound, ...S.rate.map(Math.abs)) * 1.08, sc = (b - t) / 2 / top;
    g.strokeStyle = css("--grid"); g.lineWidth = 1;
    g.beginPath(); g.moveTo(l, mid); g.lineTo(r, mid); g.stroke();
    label(g, "gains", l - 6, t + 10, css("--muted"), "right", 10);
    label(g, "loses", l - 6, b, css("--muted"), "right", 10);
    const bw = (r - l) / L;
    for (let j = 0; j < L; j++) {
      const x = l + j * bw + bw * 0.18, w = bw * 0.64, B = S.bound[j] * sc, q = S.rate[j] * sc;
      // the Robertson bound: the rate can never leave this frame
      g.strokeStyle = css("--ink2"); g.setLineDash([3, 3]); g.strokeRect(x, mid - B, w, 2 * B); g.setLineDash([]);
      g.fillStyle = q >= 0 ? css("--green") : css("--red");
      g.fillRect(x + w * 0.2, Math.min(mid, mid - q), w * 0.6, Math.abs(q));
      label(g, String(j), x + w / 2, b + 15, css("--muted"), "center", 10.5);
    }
    label(g, "dashed: 2 ΔT° √(p_j (1 − p_j))", r, t - 4, css("--ink2"), "right", 10.5);
  }

  function read(S) {
    const sum = S.rate.reduce((t, x) => t + x, 0), vel = S.F.reduce((t, x) => t + x, 0);
    let worst = 0;
    S.rate.forEach((x, j) => { if (S.bound[j] > 1e-9) worst = Math.max(worst, Math.abs(x) / S.bound[j]); });
    $("sf-sum").textContent = fmt(sum, 6);
    $("sf-vel").textContent = fmt(vel);
    $("sf-var").textContent = fmt(S.v);
    $("sf-rob").textContent = S.v < 1e-9 ? "no change: definite energy" : `${fmt(worst)} ≤ 1`;
    $("sf-Lv").textContent = L;
    host.querySelectorAll("button[data-k]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === kind)));
  }
  function draw() { const S = stats(); read(S); drawRing(S); drawBars(S); }

  function tick(ts) {
    if (!playing) return;
    if (last) s += Math.min(0.05, (ts - last) / 1000) * 1.2;
    last = ts; draw(); requestAnimationFrame(tick);
  }
  const play = $("sf-play");
  play.addEventListener("click", () => {
    playing = !playing; last = 0; play.setAttribute("aria-pressed", String(playing));
    play.textContent = playing ? "❚❚ Pause" : "▶ Transport";
    if (playing) requestAnimationFrame(tick);
  });
  $("sf-reset").addEventListener("click", () => { s = 0; draw(); });
  $("sf-L").addEventListener("input", (e) => { L = +e.target.value; prepare(); draw(); });
  host.querySelectorAll("button[data-k]").forEach((b) => b.addEventListener("click", () => {
    kind = b.dataset.k; s = 0; prepare(); draw();
  }));
  new ResizeObserver(draw).observe(host);
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  prepare(); s = 0.9; draw();
})();
