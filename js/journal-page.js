/*
 * 蟬吃誌「最新文章」：從後端 /api/articles/ 讀取已發布的文章（每日內容排程上傳、後台發布）。
 * 後端連不上或還沒有文章時整區隱藏，不影響上方手工排版的卡片。
 */
document.addEventListener("DOMContentLoaded", () => {
  const api = window.ZenteaCart ? window.ZenteaCart.apiBase : "";
  const $ = (sel) => document.querySelector(sel);
  const section = $("[data-articles]");
  const grid = $("[data-article-grid]");
  const more = $("[data-article-more]");
  let page = 1;
  let category = "";

  function card(a) {
    const link = document.createElement("a");
    link.className = "j-post";
    link.href = `article.html?slug=${encodeURIComponent(a.slug)}`;
    const img = document.createElement("div");
    img.className = "j-post__img";
    if (a.cover) {
      const el = document.createElement("img");
      el.src = a.cover;
      el.alt = "";
      el.loading = "lazy";
      img.appendChild(el);
    }
    const body = document.createElement("div");
    body.className = "j-post__body";
    if (a.category) {
      const eyebrow = document.createElement("p");
      eyebrow.className = "j-card__eyebrow";
      eyebrow.textContent = a.category;
      body.appendChild(eyebrow);
    }
    const title = document.createElement("h3");
    title.className = "j-post__title";
    title.textContent = a.title;
    const summary = document.createElement("p");
    summary.className = "j-post__summary";
    summary.textContent = a.summary;
    const date = document.createElement("span");
    date.className = "j-post__date";
    date.textContent = a.published_at ? a.published_at.slice(0, 10).replaceAll("-", ".") : "";
    body.append(title, summary, date);
    link.append(img, body);
    return link;
  }

  function renderFilters(categories) {
    const box = $("[data-article-filters]");
    if (categories.length < 2) return;
    const all = [["", "全部"], ...categories.map((c) => [c, c])];
    box.replaceChildren(
      ...all.map(([value, label]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "j-latest__filter" + (value === category ? " is-active" : "");
        b.textContent = label;
        b.addEventListener("click", () => {
          category = value;
          page = 1;
          grid.replaceChildren();
          load();
          box.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b));
        });
        return b;
      })
    );
  }

  async function load() {
    more.disabled = true;
    try {
      const qs = new URLSearchParams({ page });
      if (category) qs.set("category", category);
      const res = await fetch(`${api}/api/articles/?${qs}`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      if (page === 1 && !category) {
        if (!data.articles.length) return;
        renderFilters(data.categories);
      }
      grid.append(...data.articles.map(card));
      more.hidden = !data.has_next;
      section.hidden = false;
    } catch (e) {
      /* 後端連不上：維持隱藏 */
    } finally {
      more.disabled = false;
    }
  }

  more.addEventListener("click", () => {
    page += 1;
    load();
  });
  load();
});
