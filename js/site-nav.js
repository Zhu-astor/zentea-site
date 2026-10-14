/*
 * 固定功能列：切換樣式（?nav=clear 全透明／?nav=frost 80% 白底）、捲動後加陰影、手機版選單開關。
 */
document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector("[data-site-nav]");
  if (!nav) return;

  const variant = new URLSearchParams(location.search).get("nav") || nav.dataset.variant || "clear";
  nav.classList.add(variant === "frost" ? "site-nav--frost" : "site-nav--clear");

  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const button = nav.querySelector("[data-nav-toggle]");
  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
  };
  button.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  nav.querySelectorAll(".site-nav__links a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));
});
