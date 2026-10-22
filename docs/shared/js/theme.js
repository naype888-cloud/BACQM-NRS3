// Theme: one choice for the whole site, remembered per viewer when storage is available.
// The figures keep their own toggles; this file applies the saved choice before the first paint,
// labels the button by the mode it switches to, and saves the choice after a click.
// Pages without a toggle of their own load it with `data-toggle`.
(function () {
  const KEY = "nrs3-theme", root = document.documentElement;
  const own = document.currentScript && document.currentScript.hasAttribute("data-toggle");
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  } catch (e) {}
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  const label = () => {
    const b = document.getElementById("theme");
    if (!b) return;
    b.textContent = isDark() ? "☀ Light" : "☾ Dark";
    b.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode");
  };
  new MutationObserver(label).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  document.addEventListener("DOMContentLoaded", () => {
    label();
    const b = document.getElementById("theme");
    if (!b) return;
    if (own) b.addEventListener("click", () => { root.dataset.theme = isDark() ? "light" : "dark"; });
    b.addEventListener("click", () => setTimeout(() => {
      try { localStorage.setItem(KEY, isDark() ? "dark" : "light"); } catch (e) {}
    }, 0));
  });
})();
