/*
 * 滾動視差邏輯：每個 .scroll-session 內，標了 data-drift="left" 的元素
 * （文字）永遠往左飄移＋淡出淡入；標了 data-drift="right" 的元素（插畫/素材）
 * 永遠往右飄移＋淡出淡入——不管這個段落實際排版是素材在左還是在右，
 * 飄移方向都是固定的，這樣整頁滾動時才會有「文字往左流、畫面往右流」
 * 貫穿全頁的一致感，而不是每段方向都不一樣。
 */

const DRIFT_PX = 480;   // 飄移最大距離（px）——原本 160 在寬螢幕上幾乎看不出移動，
                         // 只感覺得到「變透明」，加大讓飄移本身也是明顯可見的動作
const FADE_START = 0.3; // |progress| 超過這個值開始淡出
const FADE_END = 1.0;   // |progress| 到這個值時完全透明

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// 三次方緩動：中段（接近置中可見）變化慢、趨近邊緣時變化快，
// 讓飄移+淡出感覺像是被「甩」出去，而不是等速度的線性位移。
function easeInCubic(t) {
  return t * t * t;
}

function updateSessions() {
  const viewportHeight = window.innerHeight;
  const viewportCenter = viewportHeight / 2;

  document.querySelectorAll(".scroll-session").forEach((session) => {
    const rect = session.getBoundingClientRect();
    const sectionCenter = rect.top + rect.height / 2;

    // progress < 0：段落還在視窗下方（尚未進場）
    // progress = 0：段落置中（完全可見）
    // progress > 0：段落已經滾到視窗上方（出場）
    let progress = (viewportCenter - sectionCenter) / viewportHeight;
    progress = clamp(progress, -1, 1);
    const absProgress = Math.abs(progress);

    let opacity = 1;
    if (absProgress > FADE_START) {
      opacity = 1 - (absProgress - FADE_START) / (FADE_END - FADE_START);
      opacity = clamp(opacity, 0, 1);
    }

    const easedMagnitude = easeInCubic(absProgress);
    const easedProgress = Math.sign(progress) * easedMagnitude;

    session.querySelectorAll("[data-drift]").forEach((el) => {
      const direction = el.dataset.drift === "left" ? -1 : 1;
      const translateX = easedProgress * DRIFT_PX * direction;
      // data-base-transform（例如垂直置中用的 translateY(-50%)）只在桌面版排版
      // 生效，手機版斷點下該元素已改用 top:auto/bottom 定位，不需要這段，
      // 否則會被疊加成錯誤的位移。斷點數字要跟 CSS 的 860px 保持一致。
      const isDesktopLayout = window.innerWidth > 860;
      const base = isDesktopLayout ? (el.dataset.baseTransform || "") : "";
      el.style.transform = `${base} translateX(${translateX.toFixed(1)}px)`.trim();
      el.style.opacity = opacity.toFixed(3);
    });
  });
}

let ticking = false;
function onScroll() {
  if (!ticking) {
    requestAnimationFrame(() => {
      updateSessions();
      ticking = false;
    });
    ticking = true;
  }
}

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", updateSessions);
document.addEventListener("DOMContentLoaded", updateSessions);
