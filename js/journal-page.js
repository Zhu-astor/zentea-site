/*
 * 蟬吃誌精選輪播：三組文章（最新／人氣／最多點閱），每組六張卡片，
 * 用左右箭頭、上方分頁、鍵盤左右鍵或手機左右滑切換。
 * 資料來自後端 /api/articles/?sort=…&page_size=6（只有已發布的文章）。
 * 後端連不上或還沒有文章時，保留 HTML 裡手工排版的卡片、不顯示箭頭。
 */
document.addEventListener("DOMContentLoaded", () => {
  const api = window.ZenteaCart ? window.ZenteaCart.apiBase : "";
  const $ = (sel) => document.querySelector(sel);
  const columns = $("[data-feature-columns]");
  const title = $("[data-feature-title]");
  const sub = $("[data-feature-sub]");
  const tabs = $("[data-feature-tabs]");
  const prev = $("[data-feature-prev]");
  const next = $("[data-feature-next]");

  const SLIDES = [
    { sort: "latest", title: "最新文章", sub: "剛從茶山與茶桌帶回來的新篇章。" },
    { sort: "popular", title: "人氣文章", sub: "最近三十天，大家最常讀的幾篇。" },
    { sort: "views", title: "最多點閱", sub: "上線以來，被打開最多次的文章。" },
  ];
  const PER_SLIDE = 6;
  let slides = [];
  let current = 0;
  let busy = false;

  const EYE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
    '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // 卡片：沿用原本 .j-card 的版型（文字左、圖片右；中間大卡上文下圖）
  function card(a, rank, variant, showViews) {
    const link = el("a", `j-card j-card--photo ${variant}`.trim());
    link.href = `article.html?slug=${encodeURIComponent(a.slug)}`;
    const body = el("div", "j-card__body");
    const eyebrow = el("p", "j-card__eyebrow");
    if (showViews) eyebrow.append(el("span", "j-card__rank", `No.${rank}`));
    eyebrow.append(a.category || "蟬吃誌");
    body.append(eyebrow, el("h2", "j-card__title", a.title));
    if (variant === "j-card--hero" && a.summary) body.append(el("p", "j-card__desc", a.summary));
    const foot = el("div", "j-card__foot");
    foot.append(el("span", "j-card__arrow", "閱讀全文 →"));
    if (showViews) {
      const views = el("span", "j-card__views");
      views.innerHTML = EYE;
      views.append(String(a.view_count));
      views.title = `點閱 ${a.view_count} 次`;
      foot.append(views);
    }
    body.append(foot);
    link.append(body);
    const media = el("div", "j-card__media");
    const src = a.cover_thumb || a.cover;
    if (src) {
      const img = el("img");
      img.src = src;
      img.alt = "";
      img.loading = "lazy";
      media.append(img);
    }
    link.append(media);
    return link;
  }

  // 六張卡片排進三欄：左 2 張、中間 1 張大卡（第一名）、右 3 張
  function renderSlide(index) {
    const slide = slides[index];
    const showViews = slide.sort !== "latest";
    const [hero, ...rest] = slide.articles;
    const left = el("div", "j-col");
    const middle = el("div", "j-col j-col--hero");
    const right = el("div", "j-col");
    middle.append(card(hero, 1, "j-card--hero", showViews));
    rest.slice(0, 2).forEach((a, i) => left.append(card(a, i + 2, "", showViews)));
    const rightVariants = ["j-card--fade-a", "j-card--fade-b", ""];
    rest.slice(2, 5).forEach((a, i) => right.append(card(a, i + 4, rightVariants[i], showViews)));
    const cols = [left, middle, right].filter((c) => c.childElementCount);
    columns.replaceChildren(...cols);
    columns.dataset.count = slide.articles.length;

    title.textContent = slide.title;
    sub.textContent = slide.sub;
    tabs.querySelectorAll("button").forEach((b, i) => {
      b.classList.toggle("is-active", i === index);
      b.setAttribute("aria-selected", String(i === index));
    });
  }

  function go(index, direction) {
    if (busy || slides.length < 2) return;
    const target = (index + slides.length) % slides.length;
    if (target === current) return;
    busy = true;
    const dir = direction || (target > current ? 1 : -1);
    columns.style.setProperty("--shift", `${-dir * 28}px`);
    columns.classList.add("is-leaving");
    setTimeout(() => {
      current = target;
      renderSlide(current);
      columns.style.setProperty("--shift", `${dir * 28}px`);
      columns.classList.remove("is-leaving");
      columns.classList.add("is-entering");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          columns.classList.remove("is-entering");
          setTimeout(() => (busy = false), 380);
        })
      );
    }, 260);
  }

  function setup() {
    tabs.replaceChildren(
      ...slides.map((s, i) => {
        const b = el("button", "j-feature__tab", s.title);
        b.type = "button";
        b.setAttribute("role", "tab");
        b.addEventListener("click", () => go(i));
        return b;
      })
    );
    const multi = slides.length > 1;
    tabs.hidden = prev.hidden = next.hidden = !multi;
    prev.addEventListener("click", () => go(current - 1, -1));
    next.addEventListener("click", () => go(current + 1, 1));

    const stage = columns.parentElement;
    stage.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") go(current - 1, -1);
      if (e.key === "ArrowRight") go(current + 1, 1);
    });
    // 手機左右滑
    let startX = null;
    let startY = 0;
    stage.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener("touchend", (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      startX = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }, { passive: true });

    renderSlide(0);
  }

  async function fetchSlide(s) {
    const res = await fetch(`${api}/api/articles/?sort=${s.sort}&page_size=${PER_SLIDE}`);
    if (!res.ok) throw new Error(res.status);
    return res.json();
  }

  async function load() {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000));
    try {
      const results = await Promise.race([Promise.all(SLIDES.map(fetchSlide)), timeout]);
      slides = SLIDES.map((s, i) => ({ ...s, articles: results[i].articles })).filter((s) => s.articles.length);
      if (!slides.length) return;
      setup();
      const total = results[0].facets ? results[0].facets.total : 0;
      if (total > PER_SLIDE) {
        $("[data-more-desc]").textContent = `一共 ${total} 篇文章，依分類、日期找到想讀的那一篇，還能看到大家最常讀哪些。`;
      }
    } catch (e) {
      /* 後端連不上：保留手工排版的卡片 */
    } finally {
      columns.classList.remove("is-pending");
    }
  }

  load();
});
