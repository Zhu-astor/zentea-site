/*
 * 訂單完成頁：綠界付款後會轉到這裡（?no=訂單編號&t=查詢憑證）。
 *
 * 付款結果以後端收到的綠界背景通知為準，這裡只向後端查詢。背景通知有可能比顧客
 * 回到這頁還晚一點到，所以還在「待付款」時每幾秒重查一次，最多等一分鐘。
 * 確認已付款才清空購物車；沒付成功的話購物車還在，回購物車就能重新結帳。
 */
document.addEventListener("DOMContentLoaded", () => {
  const cart = window.ZenteaCart;
  const $ = (sel) => document.querySelector(sel);
  const status = $("[data-order-status]");
  const params = new URLSearchParams(location.search);
  const orderNo = params.get("no") || "";
  const token = params.get("t") || "";
  const POLL_MS = 3000;
  const MAX_POLLS = 20;

  // 查詢憑證不要留在網址列與瀏覽紀錄裡太久；重新整理時從 sessionStorage 拿回來
  const KEY = "zentea_last_order";
  let saved = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY) || "{}") || {};
    if (orderNo && token) sessionStorage.setItem(KEY, JSON.stringify({ no: orderNo, t: token }));
  } catch (e) {
    /* 無痕模式等情況：只用網址上的參數 */
  }
  const no = orderNo || saved.no;
  const t = token || saved.t;
  if (orderNo) history.replaceState(null, "", location.pathname);

  if (!no || !t) {
    status.textContent = "找不到訂單資訊。如果已經完成付款，訂單確認信會寄到您的信箱。";
    return;
  }

  function message(lines, actions) {
    const box = $("[data-order-message]");
    box.replaceChildren(
      ...lines.map((text) => {
        const p = document.createElement("p");
        p.textContent = text;
        return p;
      })
    );
    (actions || []).forEach(([label, href]) => {
      const a = document.createElement("a");
      a.className = "c-checkout oc__action";
      a.href = href;
      a.textContent = label;
      box.appendChild(a);
    });
  }

  function render(order) {
    $("[data-order-no]").textContent = order.order_no;
    $("[data-order-shipping-method]").textContent = order.shipping_method;
    $("[data-order-items]").replaceChildren(
      ...order.items.map((item) => {
        const li = document.createElement("li");
        li.className = "co__item";
        const name = document.createElement("span");
        name.textContent = `${item.product_name} ${item.variant_name} × ${item.quantity}`;
        const price = document.createElement("span");
        price.textContent = cart.formatPrice(item.line_total);
        li.append(name, price);
        return li;
      })
    );
    $("[data-order-subtotal]").textContent = cart.formatPrice(order.subtotal);
    $("[data-order-shipping]").textContent = order.shipping_fee === 0 ? "免運" : cart.formatPrice(order.shipping_fee);
    $("[data-order-total]").textContent = cart.formatPrice(order.total);

    const title = $("[data-order-title]");
    if (order.status === "pending_payment") {
      title.textContent = "付款確認中";
      message(["正在等候綠界回傳付款結果，請稍候，不要關閉這個頁面。"]);
    } else if (order.status === "payment_failed" || order.status === "cancelled") {
      title.textContent = "付款未完成";
      message(
        ["這筆訂單沒有付款成功，不會出貨。購物車內容都還在，可以回購物車重新結帳。"],
        [["回購物車", "cart.html"]]
      );
    } else {
      title.textContent = "訂購完成，謝謝您";
      message(["我們已收到您的付款，會盡快為您備貨出貨。"], [["繼續逛逛", "products.html"]]);
    }
    status.hidden = true;
    $("[data-order]").hidden = false;
  }

  function clearCartOnce() {
    cart.items().forEach((item) => cart.remove(item.sku));
    try {
      sessionStorage.removeItem("zentea_checkout_draft");
    } catch (e) {
      /* 略過 */
    }
  }

  let polls = 0;
  async function load() {
    try {
      const res = await fetch(`${cart.apiBase}/api/orders/${encodeURIComponent(no)}/?t=${encodeURIComponent(t)}`);
      if (res.status === 404) {
        status.textContent = "查不到這筆訂單。";
        return;
      }
      if (!res.ok) throw new Error(res.status);
      const order = await res.json();
      if (order.status !== "pending_payment" && order.status !== "payment_failed" && order.status !== "cancelled") {
        clearCartOnce();
      }
      render(order);
      if (order.status === "pending_payment") {
        polls += 1;
        if (polls < MAX_POLLS) setTimeout(load, POLL_MS);
        else message(["還沒收到付款結果。如果您已經完成付款，請稍後重新整理這個頁面，或聯絡我們並提供訂單編號。"]);
      }
    } catch (e) {
      status.textContent = "暫時無法查詢訂單，請稍後重新整理這個頁面。";
    }
  }

  load();
});
