// The ball of yarn on T³: the hopping state, the layers behind the outer face, and the core mass.
// State, rotation and projection are copied from nava-robertson-schrodinger/docs/hopping.js.
// Counts are exact (TorusLayers, TorusWhiteBall); brightness and colours are browser drawing.
(() => {
  const $ = (id) => document.getElementById(id);
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // Ψ(s) on one ring: s = 0 is the site j = 0, s = 1 is the hopping mode m (H = −2t T°).
  function stateOf(d, m, s) {
    const phi = Math.max(0, Math.min(1, s)) * Math.PI / 2;
    const alpha = Math.cos(phi), beta = Math.sin(phi), inv = 1 / Math.sqrt(d);
    const re = new Float64Array(d), im = new Float64Array(d);
    for (let j = 0; j < d; j++) {
      const ang = 2 * Math.PI * m * j / d;
      re[j] = beta * inv * Math.cos(ang); im[j] = beta * inv * Math.sin(ang);
    }
    re[0] += alpha;
    let n2 = 0;
    for (let j = 0; j < d; j++) n2 += re[j] * re[j] + im[j] * im[j];
    const n = Math.sqrt(n2) || 1;
    return Array.from(re, (r, j) => (r * r + im[j] * im[j]) / (n * n));
  }

  // Masses in solar masses, as in TorusWhiteBall.
  const STARS = [
    { name: "Sirius B", m: 1.018 }, { name: "PSR J0740+6620", m: 2.08 },
    { name: "Cygnus X-1", m: 21.2 }, { name: "30 M☉ core", m: 30 },
  ];
  const CH_LO = 1.43, CH_HI = 1.44, WHITE_MAX = 2.08, DARK_MIN = 3.2;
  const regimeOf = (M, vac) => vac ? "vacuum" : M <= WHITE_MAX ? "white" : M >= DARK_MIN ? "dark" : "open";

  const formal = () => document.body && document.body.dataset.tone === "formal";
  let yaw = -0.6, pitch = 0.38, spin = true, last = 0;
  function rot([x, y, z]) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
    return [x1, cp * y - sp * z1, sp * y + cp * z1];
  }
  function proj(v, cx, cy, S) {
    const [x, y, z] = rot(v), f = 3.6 / (3.6 + z);
    return [cx + x * S * f, cy - y * S * f, z, f];
  }
  function setup(c) {
    const r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
    return [g, r.width, r.height];
  }

  const num = (id, v) => ($(id) ? +$(id).value : v);
  function read() {
    const dx = num("dx", 6), dy = num("dy", 4), dz = num("dz", 4);
    const kmax = dx - 2;
    if ($("layers")) $("layers").max = kmax;
    const k = Math.min(num("layers", 2), kmax);
    const M = Math.pow(10, num("mass", 0));
    const vac = $("vacuum") ? $("vacuum").getAttribute("aria-pressed") === "true" : false;
    return { dx, dy, dz, k, s: num("ss", 0.6), M, vac };
  }

  function drawBall(st) {
    const c = $("ball"); if (!c) return;
    const [g, w, h] = setup(c), cx = w / 2, cy = h / 2, S = Math.min(w, h) * 0.34;
    const { dx, dy, dz, k, s, M, vac } = st, reg = regimeOf(M, vac);
    const m = Math.max(dx, dy, dz), sc = 2 / (m - 1);
    const P = (i, j, l) => proj([i * sc - (dx - 1) * sc / 2, l * sc - (dz - 1) * sc / 2, j * sc - (dy - 1) * sc / 2], cx, cy, S);
    const px = stateOf(dx, 1, s), py = stateOf(dy, 0, s), pz = stateOf(dz, 0, s);
    const c0 = dx - 2;                                  // the outer face: the wall x = c0 | c0 + 1
    const layers = Array.from({ length: k }, (_, n) => c0 - 1 - n);
    const blue = css("--blue"), grid = css("--grid");
    const darkBg = /^#[01]/.test(css("--bg"));

    // the threads: hopping links along the three axes (the seam of x dashed)
    g.lineWidth = 0.7; g.strokeStyle = grid;
    for (let i = 0; i < dx; i++) for (let j = 0; j < dy; j++) for (let l = 0; l < dz; l++) {
      const a = P(i, j, l);
      for (const [b, seam] of [[i + 1 < dx ? P(i + 1, j, l) : null, false], [j + 1 < dy ? P(i, j + 1, l) : null, false],
        [l + 1 < dz ? P(i, j, l + 1) : null, false]]) {
        if (!b) continue;
        g.setLineDash(seam ? [3, 3] : []); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
    }
    g.setLineDash([]);

    // the layers behind the face: translucent walls x = c + 1/2
    const wall = (cpos, fill, stroke) => {
      const x = cpos + 0.5, q = [P(x, -0.4, -0.4), P(x, dy - 0.6, -0.4), P(x, dy - 0.6, dz - 0.6), P(x, -0.4, dz - 0.6)];
      g.fillStyle = fill; g.strokeStyle = stroke; g.lineWidth = 1;
      g.beginPath(); q.forEach((p, n) => (n ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); g.stroke();
    };
    for (const cpos of layers) wall(cpos, `color-mix(in srgb, ${blue} 9%, transparent)`, `color-mix(in srgb, ${blue} 35%, transparent)`);

    // the sites: |Ψ|² of the hopping state
    if (!vac) {
      const pts = [];
      for (let i = 0; i < dx; i++) for (let j = 0; j < dy; j++) for (let l = 0; l < dz; l++)
        pts.push([P(i, j, l), px[i] * py[j] * pz[l]]);
      const pm = Math.max(...pts.map((p) => p[1]));
      pts.sort((a, b) => b[0][2] - a[0][2]);
      for (const [p, pr] of pts) {
        const r = pr / pm;
        g.fillStyle = `color-mix(in srgb, ${blue} ${Math.round(25 + 60 * Math.sqrt(r))}%, transparent)`;
        g.beginPath(); g.arc(p[0], p[1], Math.max(1, 4.5 * Math.sqrt(r) * p[3]), 0, 2 * Math.PI); g.fill();
      }
    }

    // the outer face: one LED per step of the wall, lit by |Ψ|² at the two ends of the step
    if (reg === "dark") wall(c0, "rgba(6,6,6,0.94)", "#000");
    else wall(c0, `color-mix(in srgb, ${grid} 30%, transparent)`, grid);
    const pend = px[c0] + px[c0 + 1];
    let lmax = 1e-15;
    for (let j = 0; j < dy; j++) for (let l = 0; l < dz; l++) lmax = Math.max(lmax, pend * py[j] * pz[l]);
    for (let j = 0; j < dy; j++) for (let l = 0; l < dz; l++) {
      const p = P(c0 + 0.5, j, l), r = vac ? 0 : pend * py[j] * pz[l] / lmax;
      if (reg === "white") {
        const rad = (3 + 9 * Math.sqrt(r)) * p[3];
        const gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad * 2.2);
        const glow = darkBg ? "255,250,225" : "240,165,0";
        gr.addColorStop(0, `rgba(${glow},${0.35 + 0.65 * Math.sqrt(r)})`); gr.addColorStop(1, `rgba(${glow},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(p[0], p[1], rad * 2.2, 0, 2 * Math.PI); g.fill();
        g.fillStyle = darkBg ? "#fffdf2" : "#ffd23f"; g.strokeStyle = darkBg ? grid : "#b07800";
        g.beginPath(); g.arc(p[0], p[1], 2.4 * p[3], 0, 2 * Math.PI); g.fill(); g.stroke();
      } else {
        g.fillStyle = reg === "dark" ? "#1a1a1a" : grid;
        g.beginPath(); g.arc(p[0], p[1], 2 * p[3], 0, 2 * Math.PI); g.fill();
      }
    }
    g.font = "12px system-ui, sans-serif"; g.fillStyle = css("--muted");
    const lab = (formal() ? { vacuum: "vacuum Ω", white: "lightShare > 0", dark: "lightShare = 0",
      open: "2.08 < M < 3.2: collapseMass not fixed" } : { vacuum: "vacuum: no excitation, nothing to measure",
      white: "below collapse: the face shines", dark: "collapsed quantum: no light returns",
      open: "between 2.08 and 3.2 M☉: the data do not decide" })[reg];
    g.fillText(`${dx} × ${dy} × ${dz} · ${k} layer${k === 1 ? "" : "s"} · ${lab}`, 10, h - 10);
  }

  function drawMass(st) {
    const c = $("massChart"); if (!c) return;
    const [g, w, h] = setup(c), L = 40, R = w - 20, y0 = h * 0.55;
    const lo = Math.log10(0.5), hi = Math.log10(40), X = (m) => L + (Math.log10(m) - lo) / (hi - lo) * (R - L);
    const band = (a, b, col) => { g.fillStyle = col; g.fillRect(X(a), y0 - 16, X(b) - X(a), 32); };
    band(0.5, WHITE_MAX, "rgba(255,236,170,0.85)");
    band(WHITE_MAX, DARK_MIN, `color-mix(in srgb, ${css("--grid")} 70%, transparent)`);
    band(DARK_MIN, 40, "#060606");
    g.strokeStyle = css("--grid"); g.lineWidth = 1; g.strokeRect(X(0.5), y0 - 16, X(40) - X(0.5), 32);
    g.fillStyle = css("--orange"); g.fillRect(X(CH_LO), y0 - 22, Math.max(2, X(CH_HI) - X(CH_LO)), 44);
    g.font = "11px system-ui, sans-serif"; g.fillStyle = css("--ink2"); g.textAlign = "center";
    for (const t of [0.5, 1, 2, 5, 10, 20, 40]) g.fillText(String(t), X(t), y0 + 34);
    g.fillText("M☉ (core)", X(40) - 24, y0 + 48);
    g.fillStyle = css("--orange"); g.fillText("Chandrasekhar 1.43–1.44", X(1.435), y0 - 28);
    STARS.forEach((st2, n) => {
      const x = X(st2.m); g.fillStyle = "#555"; g.strokeStyle = "#fff"; g.lineWidth = 1.2;
      g.beginPath(); g.arc(x, y0, 4, 0, 2 * Math.PI); g.fill(); g.stroke();
      g.fillStyle = css("--muted"); g.fillText(st2.name, x, y0 - 46 - (n % 2) * 14);
    });
    const xm = X(Math.min(40, Math.max(0.5, st.M)));
    g.strokeStyle = css("--blue"); g.lineWidth = 2; g.beginPath(); g.moveTo(xm, y0 - 26); g.lineTo(xm, y0 + 22); g.stroke();
    g.textAlign = "left";
  }

  function readouts(st) {
    const set = (id, v) => { if ($(id)) $(id).textContent = v; };
    const face = st.dy * st.dz, inner = st.k * face;
    set("vdx", st.dx); set("vdy", st.dy); set("vdz", st.dz); set("vlayers", st.k);
    set("vss", st.s.toFixed(2)); set("vmass", st.M < 10 ? st.M.toFixed(2) : st.M.toFixed(1));
    set("rFace", `${face} steps · 2^${face} faces`);
    set("rInner", `${inner} steps`);
    set("rHidden", `2^${inner} per face`);
    set("rRegime", (formal() ? { vacuum: "–", white: "> 0", dark: "= 0", open: "not fixed by the data" }
      : { vacuum: "nothing to measure", white: "white", dark: "dark", open: "not decided" })[regimeOf(st.M, st.vac)]);
  }

  function frame(ts) {
    if (spin && ts - last > 2500) yaw += 0.004;
    const st = read(); drawBall(st); drawMass(st); readouts(st);
    requestAnimationFrame(frame);
  }
  document.addEventListener("DOMContentLoaded", () => {
    const c = $("ball");
    if (c) {
      let drag = null;
      c.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY]; c.setPointerCapture(e.pointerId); });
      c.addEventListener("pointermove", (e) => {
        if (!drag) return;
        yaw += (e.clientX - drag[0]) * 0.008; pitch = Math.max(-1.3, Math.min(1.3, pitch + (e.clientY - drag[1]) * 0.008));
        drag = [e.clientX, e.clientY]; last = performance.now();
      });
      c.addEventListener("pointerup", () => { drag = null; });
    }
    const v = $("vacuum");
    if (v) v.addEventListener("click", () => v.setAttribute("aria-pressed", v.getAttribute("aria-pressed") === "true" ? "false" : "true"));
    document.querySelectorAll("[data-mass]").forEach((b) =>
      b.addEventListener("click", () => { $("mass").value = Math.log10(+b.dataset.mass); }));
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) spin = false;
    requestAnimationFrame(frame);
  });
})();
