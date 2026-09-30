/*
 * 全部茶品頁：加入購物車，並用後端資料同步價格與售完狀態。
 * 後端連不上時保留頁面上原本寫死的價格，加入購物車仍可使用（到購物車頁時再由後端確認）。
 */
document.addEventListener("DOMContentLoaded", () => {
  const cart = window.ZenteaCart;

  // 卡片本身是連到商品頁的 <a>，按鈕要擋掉連結跳轉
  document.querySelectorAll("[data-add-to-cart]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled) return;
      const card = btn.closest("[data-sku]");
      cart.add(card.dataset.sku, 1);
      const name = card.querySelector(".p-card__name");
      cart.toast(`已將「${name ? name.textContent : "商品"}」加入購物車`);
    });
  });

  cart
    .fetchProducts()
    .then(({ products }) => {
      const bySku = {};
      products.forEach((p) => p.variants.forEach((v) => (bySku[v.sku] = v)));

      document.querySelectorAll(".p-card[data-sku]").forEach((card) => {
        const variant = bySku[card.dataset.sku];
        const btn = card.querySelector("[data-add-to-cart]");
        const price = card.querySelector(".p-card__price");
        if (!variant || !variant.in_stock) {
          btn.disabled = true;
          btn.textContent = variant ? "已售完" : "暫不販售";
          return;
        }
        if (price) price.textContent = cart.formatPrice(variant.price);
      });
    })
    .catch(() => {
      /* 後端沒開：維持頁面原本的價格 */
    });
});
