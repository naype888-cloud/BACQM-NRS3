// The uncertainty cone, computed from the matrices of the base repository.
// T_d = adjacency / ρ_d with ρ_d = 2 cos(π/(d+1)); P_d = diag(−1 + 2j/(d−1));
// maxCurrentState_j ∝ (−i)^j sin((j+1)π/(d+1)), the maximal current state (speed 1).
// For a state ψ the fluctuation vectors are x = (T − ⟨T⟩)ψ, y = (P − ⟨P⟩)ψ and the four-vector
// is v = ((‖x‖² + ‖y‖²)/2, Re⟪x,y⟫, Im⟪x,y⟫, (‖x‖² − ‖y‖²)/2)   (Cone.coneVector, Lean).
// v*(d) for 4 ≤ d ≤ 16: D44 of the base (exact at d = 4, numerical above).
window.Cone = (() => {
  const VSTAR = { 4: 0.927051, 5: 0.983875, 6: 0.971246, 7: 0.988397, 8: 0.967133, 9: 0.990498,
    10: 0.977936, 11: 0.992063, 12: 0.98361, 13: 0.993255, 14: 0.987185, 15: 0.994186,
    16: 0.989613 };
  const C_INF = Math.sqrt(Math.PI ** 2 / 3 - 2);

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    const u = Math.max(1e-12, r()), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // complex vectors as {re: Float64Array, im: Float64Array}
  const vec = (d) => ({ re: new Float64Array(d), im: new Float64Array(d) });
  function norm2(a) { let s = 0; for (let j = 0; j < a.re.length; j++) s += a.re[j] ** 2 + a.im[j] ** 2; return s; }
  function scale(a, k) { for (let j = 0; j < a.re.length; j++) { a.re[j] *= k; a.im[j] *= k; } return a; }
  function inner(a, b) { // ⟪a, b⟫, conjugate-linear in a
    let re = 0, im = 0;
    for (let j = 0; j < a.re.length; j++) {
      re += a.re[j] * b.re[j] + a.im[j] * b.im[j];
      im += a.re[j] * b.im[j] - a.im[j] * b.re[j];
    }
    return [re, im];
  }
  const rho = (d) => 2 * Math.cos(Math.PI / (d + 1));
  const pos = (d, j) => -1 + 2 * j / (d - 1);
  function applyT(d, a) {
    const o = vec(d), r = rho(d);
    for (let j = 0; j < d; j++) {
      let re = 0, im = 0;
      if (j > 0) { re += a.re[j - 1]; im += a.im[j - 1]; }
      if (j < d - 1) { re += a.re[j + 1]; im += a.im[j + 1]; }
      o.re[j] = re / r; o.im[j] = im / r;
    }
    return o;
  }
  function applyP(d, a) {
    const o = vec(d);
    for (let j = 0; j < d; j++) { const p = pos(d, j); o.re[j] = p * a.re[j]; o.im[j] = p * a.im[j]; }
    return o;
  }
  function maxCurrentState(d) {
    const s = vec(d), ph = [[1, 0], [0, -1], [-1, 0], [0, 1]];
    for (let j = 0; j < d; j++) {
      const a = Math.sin((j + 1) * Math.PI / (d + 1));
      s.re[j] = a * ph[j % 4][0]; s.im[j] = a * ph[j % 4][1];
    }
    return scale(s, 1 / Math.sqrt(norm2(s)));
  }
  // ψ = maxCurrentState + ε χ (χ a fixed random state), normalized; over ℝ the imaginary part is dropped
  function state(d, eps, seed, real) {
    const r = rng(seed * 7919 + d), s = maxCurrentState(d);
    for (let j = 0; j < d; j++) { s.re[j] += eps * gauss(r); s.im[j] += eps * gauss(r); }
    if (real) s.im.fill(0);
    const n = Math.sqrt(norm2(s));
    if (n < 1e-12) { s.re[0] = 1; return s; }
    return scale(s, 1 / n);
  }
  function fluct(Aop, d, s) {
    const As = Aop(d, s), m = inner(s, As)[0];
    for (let j = 0; j < d; j++) { As.re[j] -= m * s.re[j]; As.im[j] -= m * s.im[j]; }
    return As;
  }
  // everything the pages show, for a state s of H_d and units λ (A → λA, B → B/λ)
  function analyse(d, s, lam = 1) {
    const x = fluct(applyT, d, s), y = fluct(applyP, d, s);
    const a = norm2(x) * lam * lam, b = norm2(y) / (lam * lam), [ipr, ipi] = inner(x, y);
    const v = [(a + b) / 2, ipr, ipi, (a - b) / 2];
    const interval = v[0] ** 2 - v[1] ** 2 - v[2] ** 2 - v[3] ** 2;
    const rest = Math.sqrt(a * b);                        // v₀ in the balanced frame, ‖x‖‖y‖
    const beta = rest > 0 ? Math.hypot(ipr, ipi) / rest : 0;
    const speedPos = -(d - 1) * inner(applyT(d, s), applyP(d, s))[1]; // ((d−1)/2)⟨K_d⟩
    const vs = VSTAR[d];
    const band = vs === undefined ? null : Math.abs(speedPos) > vs;
    return { x, y, a, b, v, interval, rest, beta, speed: speedPos, vstar: vs, band,
      gram: [[a, 0], [ipr, ipi], [ipr, -ipi], [b, 0]] };
  }
  const cache = {};
  function CNava(d) {
    if (cache[d]) return cache[d];
    const r = analyse(d, maxCurrentState(d));
    return (cache[d] = r.beta > 0 ? 1 / r.beta : Infinity);
  }

  // ---------- drawing ----------
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function setup(canvas) {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(10, Math.round(r.width * dpr)), H = Math.max(10, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    return { g, w: r.width, h: r.height };
  }
  // a 3D view: z is up; yaw and pitch from dragging
  function view3d(canvas, state, onChange) {
    let drag = null;
    canvas.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      state.yaw += (e.clientX - drag[0]) * 0.01;
      state.pitch = Math.max(-0.2, Math.min(1.35, state.pitch + (e.clientY - drag[1]) * 0.01));
      drag = [e.clientX, e.clientY];
      state.user = true;
      onChange();
    });
    const end = () => { drag = null; };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }
  function projector(w, h, st, scale, zc = 0.5) {
    const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
    const S = Math.min(w, h) * scale;
    return (p) => {
      const x = p[0] * cy - p[1] * sy, y = p[0] * sy + p[1] * cy, z = p[2] - zc;
      const yy = y * cp - z * sp, zz = y * sp + z * cp;
      const f = 3.2 / (3.2 + yy);
      return [w / 2 + x * S * f, h * 0.55 - zz * S * f, yy];
    };
  }
  function line(g, P, a, b, col, lw = 1, dash = null) {
    const A = P(a), B = P(b);
    g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []);
    g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); g.setLineDash([]);
  }
  function poly(g, P, pts, col, lw = 1, dash = null, fill = null) {
    g.beginPath();
    pts.forEach((p, i) => { const q = P(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
    if (fill) { g.fillStyle = fill; g.fill(); }
    g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]);
  }
  function dot(g, P, p, r, col) {
    const q = P(p); g.fillStyle = col; g.beginPath(); g.arc(q[0], q[1], r, 0, 2 * Math.PI); g.fill();
  }
  function label(g, P, p, text, col, dx = 6, dy = -6, font = "12px system-ui") {
    const q = P(p); g.fillStyle = col; g.font = font; g.fillText(text, q[0] + dx, q[1] + dy);
  }
  function mix(c, a) { return `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`; }
  // the cone v₀ = √(v₁² + v₂²) up to height hmax, drawn as rings and generators
  function drawCone(g, P, hmax, col) {
    for (let k = 1; k <= 4; k++) {
      const h = hmax * k / 4, ring = [];
      for (let t = 0; t <= 64; t++) ring.push([h * Math.cos(t * Math.PI / 32), h * Math.sin(t * Math.PI / 32), h]);
      poly(g, P, ring, mix(col, k === 4 ? 0.9 : 0.35), k === 4 ? 1.4 : 1, null, k === 4 ? mix(col, 0.06) : null);
    }
    for (let t = 0; t < 16; t++) {
      const c = Math.cos(t * Math.PI / 8), s = Math.sin(t * Math.PI / 8);
      line(g, P, [0, 0, 0], [hmax * c, hmax * s, hmax], mix(col, 0.25));
    }
  }
  function themeToggle(btn, redraw) {
    btn.addEventListener("click", () => {
      const root = document.documentElement, cur = root.getAttribute("data-theme");
      const dark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      root.setAttribute("data-theme", dark ? "light" : "dark");
      redraw();
    });
  }
  return { VSTAR, C_INF, maxCurrentState, state, analyse, CNava, css, setup, view3d, projector, line, poly,
    dot, label, mix, drawCone, themeToggle, rng, gauss };
})();
