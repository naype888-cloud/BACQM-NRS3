// The closed axis of T³: the pair (T°_d, P_d) on the ring of d positions, and its uncertainty four-vector.
// T°_d = ring adjacency / 2 (spectral radius 1), P_d = centred position; with d = 3 these are
// ClosedThree.Tc = (J − I)/2 and P₃ = diag(−1, 0, 1) of Lean (nrs3-hopf).
(() => {
  function jacobi(M) {
    const n = M.length, A = M.map((r) => r.slice()), V = A.map((r, i) => r.map((_, j) => (i === j ? 1 : 0)));
    for (let sw = 0; sw < 60; sw++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
      if (off < 1e-24) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const x = A[k][p], y = A[k][q]; A[k][p] = c * x - s * y; A[k][q] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = A[p][k], y = A[q][k]; A[p][k] = c * x - s * y; A[q][k] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
      }
    }
    return { vals: A.map((r, i) => r[i]), V };
  }
  const pos = (d) => Array.from({ length: d }, (_, j) => (2 * (j + 1) - (d + 1)) / (d - 1));
  // the maximal current state: top eigenvector of K = i[T°, P] in its real form [[0, −B], [B, 0]]
  function maxCurrent(d) {
    const p = pos(d), M = Array.from({ length: 2 * d }, () => new Array(2 * d).fill(0));
    for (let j = 0; j < d; j++) for (const k of [(j + 1) % d, (j + d - 1) % d]) {
      const b = 0.5 * (p[k] - p[j]); M[j][k + d] -= b; M[j + d][k] += b;
    }
    const { vals, V } = jacobi(M);
    let top = 0; vals.forEach((v, i) => { if (v > vals[top]) top = i; });
    const re = [], im = [];
    for (let j = 0; j < d; j++) { re.push(V[j][top]); im.push(V[j + d][top]); }
    const nn = Math.hypot(...re, ...im);
    return { re: re.map((x) => x / nn), im: im.map((x) => x / nn) };
  }
  // the saturating state of the closed axis d = 3 (ClosedThreeBand.satState), tension 1, null
  function satState() {
    const k = 1 / (2 * Math.SQRT2);
    return { re: [k, 2 * k, k], im: [k, 0, -k] };
  }
  // Gram of the centred pair: a = ‖δT‖², b = ‖δP‖², ⟨δT, δP⟩ = ir + i·ii; v = (v0, v1, v2, v3) as in Cone.analyse
  function ringVector(d, s) {
    const p = pos(d), Tr = new Float64Array(d), Ti = new Float64Array(d);
    for (let j = 0; j < d; j++) {
      Tr[j] = (s.re[(j + d - 1) % d] + s.re[(j + 1) % d]) / 2;
      Ti[j] = (s.im[(j + d - 1) % d] + s.im[(j + 1) % d]) / 2;
    }
    let mT = 0, mP = 0;
    for (let j = 0; j < d; j++) { mT += s.re[j] * Tr[j] + s.im[j] * Ti[j]; mP += p[j] * (s.re[j] ** 2 + s.im[j] ** 2); }
    let a = 0, b = 0, ir = 0, ii = 0;
    for (let j = 0; j < d; j++) {
      const xr = Tr[j] - mT * s.re[j], xi = Ti[j] - mT * s.im[j], yr = (p[j] - mP) * s.re[j], yi = (p[j] - mP) * s.im[j];
      a += xr * xr + xi * xi; b += yr * yr + yi * yi; ir += xr * yr + xi * yi; ii += xr * yi - xi * yr;
    }
    return [(a + b) / 2, ir, ii, (a - b) / 2];
  }
  // eps < 0: the saturating state of d = 3; otherwise the maximal current state of the ring of d positions
  window.Cone.ringStart = (d, eps) => ringVector(d, eps < 0 ? satState() : maxCurrent(d));
  window.Cone.ringStart.raw = (d) => { const m = maxCurrent(d); return { re: Float64Array.from(m.re), im: Float64Array.from(m.im) }; };
})();

// The ring API used by index-t3.html: same shape as Cone.analyse, for the closed axis of T³.
(() => {
  const C = window.Cone, SQ2 = Math.SQRT2;
  const pos = (d) => Array.from({ length: d }, (_, j) => (2 * (j + 1) - (d + 1)) / (d - 1));
  const mc = {};
  const maxCur = (d) => { if (!mc[d]) { const v = window.Cone.ringStart.raw(d); mc[d] = v; } return mc[d]; };
  const norm = (s) => { let n = 0; for (let j = 0; j < s.re.length; j++) n += s.re[j] ** 2 + s.im[j] ** 2; n = Math.sqrt(n);
    for (let j = 0; j < s.re.length; j++) { s.re[j] /= n; s.im[j] /= n; } return s; };
  const copy = (s) => ({ re: Float64Array.from(s.re), im: Float64Array.from(s.im) });
  function state(d, eps, seed, real) {
    if (eps < 0 && d === 3) { const k = 1 / (2 * SQ2); return { re: Float64Array.from([k, 2 * k, k]), im: Float64Array.from([k, 0, -k]) }; }
    const r = C.rng(seed * 7919 + d), m = maxCur(d), s = copy(m);
    for (let j = 0; j < d; j++) { s.re[j] += Math.max(eps, 0) * C.gauss(r); s.im[j] += Math.max(eps, 0) * C.gauss(r); }
    if (real) s.im.fill(0);
    return norm(s);
  }
  // one step of the random walk of the state on the unit sphere of ℂ^d
  function step(s, sigma, r) {
    const t = copy(s);
    for (let j = 0; j < t.re.length; j++) { t.re[j] += sigma * C.gauss(r); t.im[j] += sigma * C.gauss(r); }
    return norm(t);
  }
  function analyse(d, s, lam = 1) {
    const p = pos(d), Tr = new Float64Array(d), Ti = new Float64Array(d);
    for (let j = 0; j < d; j++) { Tr[j] = (s.re[(j + d - 1) % d] + s.re[(j + 1) % d]) / 2; Ti[j] = (s.im[(j + d - 1) % d] + s.im[(j + 1) % d]) / 2; }
    let mT = 0, mP = 0;
    for (let j = 0; j < d; j++) { mT += s.re[j] * Tr[j] + s.im[j] * Ti[j]; mP += p[j] * (s.re[j] ** 2 + s.im[j] ** 2); }
    const x = { re: new Float64Array(d), im: new Float64Array(d) }, y = { re: new Float64Array(d), im: new Float64Array(d) };
    let a = 0, b = 0, ir = 0, ii = 0;
    for (let j = 0; j < d; j++) {
      x.re[j] = Tr[j] - mT * s.re[j]; x.im[j] = Ti[j] - mT * s.im[j]; y.re[j] = (p[j] - mP) * s.re[j]; y.im[j] = (p[j] - mP) * s.im[j];
      a += x.re[j] ** 2 + x.im[j] ** 2; b += y.re[j] ** 2 + y.im[j] ** 2;
      ir += x.re[j] * y.re[j] + x.im[j] * y.im[j]; ii += x.re[j] * y.im[j] - x.im[j] * y.re[j];
    }
    const A = a * lam * lam, B = b / (lam * lam), v = [(A + B) / 2, ir, ii, (A - B) / 2];
    const interval = v[0] ** 2 - v[1] ** 2 - v[2] ** 2 - v[3] ** 2, rest = Math.sqrt(A * B);
    const beta = rest > 0 ? Math.hypot(ir, ii) / rest : 0, tension = -2 * ii;
    return { x, y, a: A, b: B, v, interval, rest, beta, tension, band: Math.abs(tension) > 1, light: beta * beta, dark: 1 - beta * beta };
  }
  const cache = {};
  const CNava = (d) => { if (!cache[d]) { const r = analyse(d, copy(maxCur(d))); cache[d] = r.beta > 0 ? 1 / r.beta : Infinity; } return cache[d]; };
  C.ring = { state, step, analyse, CNava, C_INF: SQ2, copy };
})();
