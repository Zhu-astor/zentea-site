/*
 * 結帳頁：填寫訂購人／收件人資料，送到後端 /api/checkout/validate/ 檢查。
 * 付款與配送尚未開放，這一步只檢查資料，不會建立訂單。
 *
 * 填到一半的資料暫存在 sessionStorage（關閉分頁就清除），避免在共用電腦上留下個資。
 */
document.addEventListener("DOMContentLoaded", async () => {
  const cart = window.ZenteaCart;
  const $ = (sel) => document.querySelector(sel);
  const form = $("[data-checkout-form]");
  const status = $("[data-checkout-status]");
  const submit = $("[data-checkout-submit]");
  const success = $("[data-checkout-success]");
  const sameBox = $("[data-receiver-same]");
  const receiverFields = $("[data-receiver-fields]");
  const DRAFT_KEY = "zentea_checkout_draft";
  const FIELDS = ["customer_name", "customer_phone", "customer_email", "receiver_name", "receiver_phone", "note"];

  if (cart.count() === 0) {
    status.hidden = true;
    $("[data-checkout-empty]").hidden = false;
    return;
  }

  // ---------- 暫存草稿 ----------
  function readDraft() {
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function saveDraft() {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(collect()));
    } catch (e) {
      /* 無痕模式等情況：不暫存 */
    }
  }

  function collect() {
    const data = { receiver_same: sameBox.checked };
    FIELDS.forEach((name) => (data[name] = form.elements[name].value));
    return data;
  }

  const draft = readDraft();
  FIELDS.forEach((name) => {
    if (typeof draft[name] === "string") form.elements[name].value = draft[name];
  });
  if (typeof draft.receiver_same === "boolean") sameBox.checked = draft.receiver_same;

  function syncReceiver() {
    receiverFields.hidden = sameBox.checked;
  }
  sameBox.addEventListener("change", syncReceiver);
  syncReceiver();

  form.addEventListener("input", () => {
    success.hidden = true;
    saveDraft();
  });
  form.addEventListener("change", saveDraft);

  // ---------- 錯誤顯示 ----------
  function clearErrors() {
    document.querySelectorAll("[data-error]").forEach((el) => {
      el.hidden = true;
      el.textContent = "";
    });
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
  }

  function showErrors(errors) {
    let first;
    Object.entries(errors).forEach(([name, messages]) => {
      const el = document.querySelector(`[data-error="${name}"]`);
      if (!el) return;
      el.textContent = messages.join("、");
      el.hidden = false;
      const input = form.elements[name];
      if (input) {
        input.setAttribute("aria-invalid", "true");
        first = first || input;
      } else {
        first = first || el;
      }
    });
    if (first) {
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      if (first.focus) first.focus({ preventScroll: true });
    }
  }

  // ---------- 訂單內容 ----------
  function renderSummary(quote) {
    const list = $("[data-checkout-items]");
    list.replaceChildren(
      ...quote.items.map((item) => {
        const li = document.createElement("li");
        li.className = "co__item";
        const name = document.createElement("span");
        name.textContent = `${item.product_name || item.sku} × ${item.quantity}`;
        const price = document.createElement("span");
        price.textContent = item.problems.length ? item.problems.join("、") : cart.formatPrice(item.line_total);
        if (item.problems.length) li.classList.add("has-problem");
        li.append(name, price);
        return li;
      })
    );
    $("[data-checkout-subtotal]").textContent = cart.formatPrice(quote.subtotal);
  }

  async function validate() {
    const res = await fetch(`${cart.apiBase}/api/checkout/validate/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.items(), customer: collect() }),
    });
    if (!res.ok) throw new Error(res.status);
    return res.json();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submit.disabled = true;
    submit.textContent = "確認中…";
    clearErrors();
    success.hidden = true;
    try {
      const result = await validate();
      renderSummary(result.cart);
      if (result.ok) success.hidden = false;
      else showErrors(result.errors);
    } catch (err) {
      showErrors({ cart: ["暫時無法連線，請稍後再試一次"] });
    } finally {
      submit.disabled = false;
      submit.textContent = "確認資料";
    }
  });

  // ---------- 初始載入：先確認購物車 ----------
  try {
    const quote = await cart.quote();
    renderSummary(quote);
    if (quote.has_problems) {
      showErrors({ cart: ["部分商品目前無法購買，請回購物車調整"] });
    }
    status.hidden = true;
    form.hidden = false;
  } catch (e) {
    status.textContent = "暫時無法取得最新價格與庫存，請稍後再重新整理頁面。";
  }
});
