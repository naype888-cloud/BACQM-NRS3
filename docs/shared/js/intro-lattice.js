// The living lattice of the landing: 3 × 3 × 3 positions, their links, and the
// dotted half-links at the faces (every axis closed: T³). Nine quanta of light
// hop along the axes, leave through one face and return through the opposite
// one; a position brightens as a quantum passes through it. Drag to turn.
// Also drives the ticker of the nine results. No dependencies.
(() => {
  "use strict";
  const canvas = document.getElementById("lattice");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  const BLUE = [91, 155, 230], INK = [242, 241, 238], WARM = [240, 138, 93];
  const STUB = 0.44, EL0 = 0.52;
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

  const nodes = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) nodes.push([i, j, k]);
  const edges = [], stubs = [];
  nodes.forEach((a, m) => nodes.forEach((b, n) => {
    if (n > m && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) === 1) edges.push([m, n]);
  }));
  nodes.forEach((p, n) => [0, 1, 2].forEach((ax) => {
    if (p[ax] === 0) return;
    const q = p.slice(); q[ax] = p[ax] * (1 + STUB); stubs.push([n, q]);
  }));
  // one quantum per result: [axis, the two other coordinates, speed]
  const quanta = [[0, -1, 0], [1, 1, -1], [2, 0, 1], [0, 1, 1], [1, -1, 1], [2, -1, -1], [0, 0, -1], [1, 0, 0], [2, 1, 0]]
    .map(([ax, u, v], q) => ({ ax, u, v, phase: (q * 0.618) % 1, speed: 0.5 / (1 + (q * 0.37) % 1.3 / 3.4) }));

  // view
  let az = -0.58, el = EL0, vaz = 0, dragging = false, lastX = 0, lastY = 0;
  let W = 0, H = 0, S = 0, CX = 0, CY = 0, dpr = 1;
  const cs = [Math.cos(az), Math.sin(az), Math.cos(el), Math.sin(el)];
  function setView() { cs[0] = Math.cos(az); cs[1] = Math.sin(az); cs[2] = Math.cos(el); cs[3] = Math.sin(el); }
  function project(p, out) {
    const x1 = p[0] * cs[0] - p[1] * cs[1], y1 = p[0] * cs[1] + p[1] * cs[0];
    out[0] = CX + S * x1;
    out[1] = CY - S * (p[2] * cs[2] + y1 * cs[3]);
    out[2] = y1 * cs[2] - p[2] * cs[3];
    return out;
  }

  // a soft warm sprite for the quanta, drawn once
  const sprite = document.createElement("canvas");
  function makeSprite() {
    const r = Math.round(22 * dpr);
    sprite.width = sprite.height = r * 2;
    const g = sprite.getContext("2d"), grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, rgba(WARM, 0.9)); grd.addColorStop(0.3, rgba(WARM, 0.3)); grd.addColorStop(1, rgba(WARM, 0));
    g.fillStyle = grd; g.fillRect(0, 0, r * 2, r * 2);
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    S = Math.min(W, H) * 0.215; CX = W / 2; CY = H * 0.47;
    makeSprite();
    if (!running) frame(performance.now());
  }

  const P = nodes.map(() => [0, 0, 0]), tmp = [0, 0, 0], tmp2 = [0, 0, 0];
  const glow = new Float32Array(27);
  let t0 = performance.now(), last = t0, running = false, raf = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = still.matches ? 99 : (now - t0) / 1000;
    if (!dragging && !still.matches) { az += (0.07 + vaz) * dt; vaz *= Math.pow(0.04, dt); el += (EL0 - el) * dt * 0.8; }
    setView();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    nodes.forEach((p, n) => project(p, P[n]));
    let dmin = Infinity, dmax = -Infinity;
    for (const p of P) { dmin = Math.min(dmin, p[2]); dmax = Math.max(dmax, p[2]); }
    const near = (d) => (dmax - d) / (dmax - dmin || 1);

    // glow of each position from the quanta passing through it
    glow.fill(0);
    const pos = quanta.map((q) => {
      const s = ((t - 2.6) * q.speed * 0.5 + q.phase) % 1;
      const c = -1 - STUB + s * 2 * (1 + STUB);
      if (t > 2.6) for (let m = -1; m <= 1; m++) {
        const g = Math.exp(-((c - m) ** 2) / 0.035);
        const p = [0, 0, 0]; p[q.ax] = m; const o = [0, 1, 2].filter((a) => a !== q.ax); p[o[0]] = q.u; p[o[1]] = q.v;
        const n = (p[0] + 1) * 9 + (p[1] + 1) * 3 + (p[2] + 1);
        glow[n] = Math.max(glow[n], g);
      }
      return c;
    });

    // half-links at the faces: dotted, they continue on the opposite side
    const stubA = ease((t - 2.2) / 1.4);
    if (stubA > 0) {
      ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.setLineDash([0, 6.5]);
      for (const [n, q] of stubs) {
        const a = P[n], b = project(q, tmp);
        ctx.strokeStyle = rgba(BLUE, stubA * (0.2 + 0.42 * near(a[2])));
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // links, far to near, drawn in during the first seconds
    const order = edges.map((e, i) => [P[e[0]][2] + P[e[1]][2], i]).sort((x, y) => y[0] - x[0]);
    for (const [, i] of order) {
      const [a, b] = edges[i], A = P[a], B = P[b], nr = near((A[2] + B[2]) / 2);
      const k = ease((t - 0.5 - 1.5 * (1 - nr)) / 1.1);
      if (k <= 0) continue;
      ctx.strokeStyle = rgba(BLUE, 0.22 + 0.5 * nr + 0.25 * Math.max(glow[a], glow[b]));
      ctx.lineWidth = 1.1 + 1.1 * nr;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k); ctx.stroke();
    }

    // quanta
    if (t > 2.6) {
      const sw = sprite.width / dpr;
      quanta.forEach((q, i) => {
        const c = pos[i], fade = ease((1 + STUB - Math.abs(c)) / 0.32);
        const p = [0, 0, 0]; p[q.ax] = c; const o = [0, 1, 2].filter((a) => a !== q.ax); p[o[0]] = q.u; p[o[1]] = q.v;
        const s = project(p, tmp2), a = fade * Math.min(1, (t - 2.6) / 0.8);
        if (a <= 0.01) return;
        ctx.globalAlpha = a;
        ctx.drawImage(sprite, s[0] - sw / 2, s[1] - sw / 2, sw, sw);
        ctx.fillStyle = "rgb(255,241,228)";
        ctx.beginPath(); ctx.arc(s[0], s[1], 2.4, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

    // positions, far to near, each in its transparent bubble
    const byDepth = P.map((p, n) => [p[2], n]).sort((x, y) => y[0] - x[0]);
    for (const [d, n] of byDepth) {
      const nr = near(d), p = P[n], k = ease((t - 0.05 - 1.3 * (1 - nr)) / 0.8), g = glow[n];
      if (k <= 0) continue;
      const br = (15 + 9 * nr) * k, breathe = 0.5 + 0.5 * Math.sin(t * 0.9 + n * 1.7);
      ctx.strokeStyle = rgba(BLUE, (0.06 + 0.12 * breathe + 0.35 * g) * k);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p[0], p[1], br, 0, 6.2832); ctx.stroke();
      const r = (3.4 + 2.6 * nr) * (k < 1 ? 1 + 0.25 * Math.sin(k * Math.PI) : 1) * (1 + 0.35 * g);
      const col = g > 0.02 ? INK.map((v, c) => v + (WARM[c] - v) * g * 0.55) : INK;
      ctx.fillStyle = rgba(col, (0.5 + 0.5 * nr) * k);
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832); ctx.fill();
    }

    if (running) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || still.matches || document.hidden) return;
    running = true; last = performance.now(); raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  // drag to turn; vertical drag tilts a little, then settles back
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY; vaz = 0; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
    az += dx * 0.008; el = Math.max(0.05, Math.min(1.1, el + dy * 0.005)); vaz = dx * 0.25;
    if (!running) frame(performance.now());
  });
  const release = () => { dragging = false; vaz = Math.max(-2, Math.min(2, vaz)); };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  still.addEventListener?.("change", () => { stop(); t0 = performance.now() - 99000; frame(performance.now()); start(); });
  new ResizeObserver(resize).observe(canvas);
  resize();
  requestAnimationFrame(() => canvas.classList.add("ready"));
  start();

  // ---- the ticker of the nine results ---------------------------------------
  const items = [...document.querySelectorAll(".ticker li")], bar = document.querySelector(".progress");
  if (!items.length) return;
  const TICK = 3600;
  let idx = 0, timer = 0, paused = false;
  function show(i) {
    items.forEach((li, n) => { li.classList.toggle("on", n === i); li.classList.toggle("off", n === idx && n !== i);
      li.querySelector("a").tabIndex = n === i ? 0 : -1; li.setAttribute("aria-hidden", n === i ? "false" : "true"); });
    idx = i;
    if (bar) { bar.style.setProperty("--tick", TICK / 1000 + "s"); bar.classList.remove("run"); void bar.offsetWidth; bar.classList.add("run"); }
  }
  function next() { if (!paused && !document.hidden) show((idx + 1) % items.length); timer = setTimeout(next, TICK); }
  const list = document.querySelector(".ticker");
  list.addEventListener("pointerenter", () => (paused = true));
  list.addEventListener("pointerleave", () => (paused = false));
  list.addEventListener("focusin", () => (paused = true));
  list.addEventListener("focusout", () => (paused = false));
  show(0);
  if (!still.matches) timer = setTimeout(next, TICK);
})();
