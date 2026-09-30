/*
 * 商品頁：product.html?slug=honey-black，內容全部來自後端 /api/products/<slug>/。
 */
document.addEventListener("DOMContentLoaded", async () => {
  const cart = window.ZenteaCart;
  const $ = (sel) => document.querySelector(sel);
  const field = (name) => document.querySelector(`[data-field="${name}"]`);
  const status = $("[data-product-status]");
  const article = $("[data-product]");
  const missing = $("[data-product-missing]");
  const qtyInput = $("[data-qty]");
  const addBtn = $("[data-add]");

  const slug = new URLSearchParams(location.search).get("slug");
  let product;
  let selectedSku;

  function showMissing() {
    status.hidden = true;
    missing.hidden = false;
  }

  if (!slug) return showMissing();

  try {
    const res = await fetch(`${cart.apiBase}/api/products/${encodeURIComponent(slug)}/`);
    if (res.status === 404) return showMissing();
    if (!res.ok) throw new Error(res.status);
    product = await res.json();
  } catch (e) {
    status.textContent = "暫時無法載入茶品資料，請稍後再重新整理頁面。";
    return;
  }

  document.title = `${product.name} | 蟬吃茶 ZenEaTea`;
  const img = field("image");
  img.src = product.image;
  img.alt = product.name;
  field("name").textContent = product.name;
  field("summary").textContent = product.summary;

  const flavor = field("flavor");
  if (product.flavor) {
    flavor.textContent = product.flavor_label;
    flavor.classList.add(`p-card__tag--${product.flavor}`);
    flavor.hidden = false;
  }
  const category = field("category");
  if (product.category_label) {
    category.textContent = product.category_label;
    category.hidden = false;
  }

  // 風味筆記
  const notesList = $("[data-notes-list]");
  product.notes.forEach((note) => {
    const dt = document.createElement("dt");
    dt.textContent = note.label;
    const dd = document.createElement("dd");
    dd.textContent = note.values.join("・");
    notesList.append(dt, dd);
  });
  $("[data-notes]").hidden = product.notes.length === 0;

  // 商品說明：純文字，依換行分段（不用 innerHTML）
  if (product.description.trim()) {
    const body = field("description");
    product.description
      .split(/\n\s*\n/)
      .filter((para) => para.trim())
      .forEach((para) => {
        const p = document.createElement("p");
        p.textContent = para.trim();
        body.append(p);
      });
    $("[data-desc-section]").hidden = false;
  }

  // 規格選擇
  const variantsBox = $("[data-variants]");
  product.variants.forEach((v) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pd__variant";
    btn.setAttribute("role", "radio");
    btn.dataset.sku = v.sku;
    btn.textContent = v.in_stock ? v.name : `${v.name}（已售完）`;
    btn.disabled = !v.in_stock;
    btn.addEventListener("click", () => selectVariant(v.sku));
    variantsBox.append(btn);
  });

  function selectVariant(sku) {
    selectedSku = sku;
    const variant = product.variants.find((v) => v.sku === sku);
    variantsBox.querySelectorAll(".pd__variant").forEach((btn) => {
      const on = btn.dataset.sku === sku;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-checked", on);
    });
    field("price").textContent = variant ? cart.formatPrice(variant.price) : "";
    addBtn.disabled = !variant || !variant.in_stock;
  }

  const firstAvailable = product.variants.find((v) => v.in_stock);
  if (firstAvailable) {
    selectVariant(firstAvailable.sku);
  } else {
    field("price").textContent = product.min_price == null ? "" : cart.formatPrice(product.min_price);
    addBtn.disabled = true;
    addBtn.textContent = product.variants.length ? "已售完" : "暫不販售";
  }
  // 只有一種規格時不必讓顧客選
  $("[data-variant-field]").hidden = product.variants.length <= 1;

  // 數量
  function clampQty(value) {
    const n = Math.floor(Number(value));
    return Math.min(Math.max(Number.isFinite(n) ? n : 1, 1), cart.MAX_QTY);
  }
  document.querySelectorAll(".pd__field [data-step]").forEach((btn) =>
    btn.addEventListener("click", () => {
      qtyInput.value = clampQty(Number(qtyInput.value) + Number(btn.dataset.step));
    })
  );
  qtyInput.addEventListener("change", () => (qtyInput.value = clampQty(qtyInput.value)));

  addBtn.addEventListener("click", () => {
    if (!selectedSku || addBtn.disabled) return;
    const qty = clampQty(qtyInput.value);
    cart.add(selectedSku, qty);
    cart.toast(`已將 ${qty} 件「${product.name}」加入購物車`);
  });

  status.hidden = true;
  article.hidden = false;
});
