// Theme toggle: light / dark, remembered per viewer when storage is available.
(function () {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem("bacqm-theme");
    if (saved) root.dataset.theme = saved;
  } catch (e) {}
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("theme");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const dark = root.dataset.theme
        ? root.dataset.theme === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      try { localStorage.setItem("bacqm-theme", root.dataset.theme); } catch (e) {}
    });
  });
})();
