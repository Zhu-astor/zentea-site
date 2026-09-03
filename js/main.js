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

    // 進場（progress < 0，段落還在下方往上進來）與出場（progress > 0）可以有
    // 不同的門檻。區塊高度就是一個視窗高，所以預設的 1.0 代表「上一段還完全
    // 佔滿畫面時，下一段就已經開始浮現」。在 section 上加 data-enter-at="0.6"
    // 之類的值，就能讓它捲得更下面一點才開始出現。
    const enterAt = parseFloat(session.dataset.enterAt) || FADE_END;
    const fadeEnd = progress < 0 ? enterAt : FADE_END;
    // 進場時「完全不透明」的位置預設拉到接近置中（enterAt 的 12%），
    // 讓 0 → 1 的漸變距離盡量拉長；若只用 fadeEnd*0.5，區間會只剩一半，
    // 捲一點點就衝到全亮。可用 data-enter-full-at 個別覆寫。
    const enterFullAt = parseFloat(session.dataset.enterFullAt);
    const fadeStart =
      progress < 0
        ? (isNaN(enterFullAt) ? fadeEnd * 0.12 : enterFullAt)
        : Math.min(FADE_START, fadeEnd * 0.5);

    let opacity = 1;
    if (absProgress > fadeStart) {
      opacity = 1 - (absProgress - fadeStart) / (fadeEnd - fadeStart);
      opacity = clamp(opacity, 0, 1);
    }

    const easedMagnitude = easeInCubic(absProgress);
    const easedProgress = Math.sign(progress) * easedMagnitude;

    // 同一個區塊內要依序浮現時，用 data-stagger-count 宣告總項數，
    // 各元素用 data-stagger="0..n-1" 指定順序。進場時把整段的漸變區間切成
    // 互相重疊的小段，序號越後面的越晚開始亮，形成「一個接一個」的節奏。
    const staggerCount = parseInt(session.dataset.staggerCount, 10) || 0;
    // 進場行程 0（剛要開始出現）→ 1（完全置中）
    const enterTravel = fadeEnd === fadeStart
      ? 1
      : clamp((fadeEnd - absProgress) / (fadeEnd - fadeStart), 0, 1);

    session.querySelectorAll("[data-drift]").forEach((el) => {
      // data-drift="none"：不做左右飄移，只隨捲動做透明度的淡入淡出
      const mode = el.dataset.drift;
      const direction = mode === "left" ? -1 : mode === "none" ? 0 : 1;
      const translateX = easedProgress * DRIFT_PX * direction;
      // data-base-transform（例如垂直置中用的 translateY(-50%)）只在桌面版排版
      // 生效，手機版斷點下該元素已改用 top:auto/bottom 定位，不需要這段，
      // 否則會被疊加成錯誤的位移。斷點數字要跟 CSS 的 860px 保持一致。
      const isDesktopLayout = window.innerWidth > 860;
      const base = isDesktopLayout ? (el.dataset.baseTransform || "") : "";
      el.style.transform = `${base} translateX(${translateX.toFixed(1)}px)`.trim();

      let finalOpacity = opacity;
      const staggerIndex = parseInt(el.dataset.stagger, 10);
      if (staggerCount > 0 && !isNaN(staggerIndex) && progress < 0) {
        // 每一項佔 slot 寬的行程，彼此重疊一半，銜接才不會一格一格跳
        const slot = 1 / (staggerCount + 1);
        const itemStart = staggerIndex * slot;
        const itemEnd = itemStart + slot * 2;
        finalOpacity = clamp((enterTravel - itemStart) / (itemEnd - itemStart), 0, 1);
      }
      el.style.opacity = finalOpacity.toFixed(3);
    });
  });
}

// 用 rAF 節流，但一定要在 finally 裡把旗標放掉。
// 先前寫成「呼叫完才 ticking = false」，只要那次 rAF 沒被執行（分頁切到背景時
// 瀏覽器會暫停 rAF）或中途拋錯，旗標就永遠卡在 true，之後每一次捲動都被擋掉，
// 畫面停在最後一次算出來的透明度不再更新。
let pendingFrame = 0;
function onScroll() {
  if (pendingFrame) return;
  pendingFrame = requestAnimationFrame(() => {
    try {
      updateSessions();
    } finally {
      pendingFrame = 0;
    }
  });
}

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", updateSessions);
document.addEventListener("DOMContentLoaded", updateSessions);
// 分頁重新可見時強制補算一次，避免背景期間累積的捲動沒有反映出來
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    if (pendingFrame) {
      cancelAnimationFrame(pendingFrame);
      pendingFrame = 0;
    }
    updateSessions();
  }
});
window.addEventListener("pageshow", updateSessions);
