(() => {
  const $ = (id) => document.getElementById(id);
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const LOG2 = Math.log(2), BIT = 4 * LOG2;          // a² = 4 ℓ_P² log 2, the bit of area
  let torus = true;
  function setup(c) {
    const r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
    return [g, r.width, r.height];
  }
  function drawCut(dy, dz) {
    const [g, w, h] = setup($("ecut")), walls = torus ? 2 : 1;
    const gap = 26, cell = Math.min((w - 40 - gap * (walls - 1)) / (walls * dy), (h - 60) / dz);
    const W0 = (w - (walls * dy * cell + gap * (walls - 1))) / 2;
    g.font = "12px system-ui, sans-serif";
    for (let k = 0; k < walls; k++) {
      const x0 = W0 + k * (dy * cell + gap), y0 = 22;
      for (let i = 0; i < dy; i++) for (let j = 0; j < dz; j++) {
        g.fillStyle = `color-mix(in srgb, ${css("--blue")} ${18 + ((i + j) % 2) * 10}%, transparent)`;
        g.fillRect(x0 + i * cell + 1, y0 + j * cell + 1, cell - 2, cell - 2);
      }
      g.strokeStyle = css("--blue"); g.lineWidth = 1.2; g.strokeRect(x0, y0, dy * cell, dz * cell);
      g.fillStyle = css("--muted"); g.textAlign = "center";
      g.fillText(k === 0 ? "plane x = c | c + 1" : "seam x = dx − 1 | 0", x0 + dy * cell / 2, y0 + dz * cell + 18);
    }
    g.textAlign = "left";
  }
  function drawCoupling(a2) {
    const [g, w, h] = setup($("ecoup")), L = 44, R = w - 14, T = 14, B = h - 34;
    const xmax = 8, ymax = 2 * Math.PI * xmax / LOG2;
    const X = (x) => L + x / xmax * (R - L), Y = (y) => B - y / ymax * (B - T);
    g.strokeStyle = css("--grid"); g.lineWidth = 1; g.strokeRect(L, T, R - L, B - T);
    g.font = "11px system-ui, sans-serif"; g.fillStyle = css("--muted");
    for (const x of [0, 2, 4, 6, 8]) g.fillText(String(x), X(x) - 3, B + 14);
    g.fillText("a² / ℓ_P²", R - 50, B + 28);
    g.strokeStyle = css("--orange"); g.setLineDash([5, 4]);
    g.beginPath(); g.moveTo(L, Y(8 * Math.PI)); g.lineTo(R, Y(8 * Math.PI)); g.stroke();
    g.beginPath(); g.moveTo(X(BIT), T); g.lineTo(X(BIT), B); g.stroke(); g.setLineDash([]);
    g.fillStyle = css("--orange"); g.fillText("8π", L + 4, Y(8 * Math.PI) - 4); g.fillText("a² = 4ℓ_P² log 2", X(BIT) + 4, T + 12);
    g.strokeStyle = css("--blue"); g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 100; i++) { const x = i / 100 * xmax, y = 2 * Math.PI * x / LOG2; i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)); }
    g.stroke();
    g.fillStyle = css("--blue"); g.beginPath(); g.arc(X(a2), Y(2 * Math.PI * a2 / LOG2), 5, 0, 2 * Math.PI); g.fill();
  }
  function draw() {
    const dy = +$("ey").value, dz = +$("ez").value, raw = +$("ea").value, a2 = Math.abs(raw - BIT) < 0.01 ? BIT : raw;
    const n = (torus ? 2 : 1) * dy * dz, eta = LOG2 / a2, k = 2 * Math.PI / eta;
    $("vey").textContent = dy; $("vez").textContent = dz; $("vea").textContent = a2 === BIT ? "4 log 2" : a2.toFixed(2);
    $("en").textContent = `${n} = ${torus ? "2·" : ""}${dy}·${dz}`;
    $("eS").textContent = `${(n * LOG2).toFixed(3)}`;
    $("eeta").textContent = `${eta.toFixed(4)}${a2 === BIT ? " = 1/4" : ""}`;
    $("ek").textContent = `${k.toFixed(3)}${a2 === BIT ? " = 8π" : ` (8π = ${(8 * Math.PI).toFixed(3)})`}`;
    drawCut(dy, dz); drawCoupling(a2);
  }
  for (const id of ["ey", "ez", "ea"]) $(id).addEventListener("input", draw);
  $("topoT3").addEventListener("click", () => { torus = true; $("topoT3").setAttribute("aria-pressed", "true"); $("topoR3").setAttribute("aria-pressed", "false"); draw(); });
  $("topoR3").addEventListener("click", () => { torus = false; $("topoR3").setAttribute("aria-pressed", "true"); $("topoT3").setAttribute("aria-pressed", "false"); draw(); });
  $("theme").addEventListener("click", () => { const r = document.documentElement, dk = matchMedia("(prefers-color-scheme: dark)").matches;
    r.dataset.theme = (r.dataset.theme || (dk ? "dark" : "light")) === "dark" ? "light" : "dark"; setTimeout(draw, 0); });
  addEventListener("resize", draw);
  $("ea").value = BIT.toFixed(2);
  draw();
})();
