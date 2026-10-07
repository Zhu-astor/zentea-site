/*
 * 結帳頁：填寫訂購人／收件人／配送資料，送到後端 /api/orders/ 建立訂單（待付款），
 * 再把後端回傳的已簽章欄位組成表單，導到綠界付款頁刷卡。
 *
 * 運費、總額這裡只是預覽，實際金額以後端計算為準。
 * 購物車在付款成功（訂單完成頁確認已付款）之前不清空，付款沒完成可以直接重新下單。
 *
 * 填到一半的資料暫存在 sessionStorage（關閉分頁就清除），避免在共用電腦上留下個資。
 */
document.addEventListener("DOMContentLoaded", async () => {
  const cart = window.ZenteaCart;
  const $ = (sel) => document.querySelector(sel);
  const form = $("[data-checkout-form]");
  const status = $("[data-checkout-status]");
  const submit = $("[data-checkout-submit]");
  const sameBox = $("[data-receiver-same]");
  const receiverFields = $("[data-receiver-fields]");
  const addressField = $("[data-address-field]");
  const DRAFT_KEY = "zentea_checkout_draft";
  const FIELDS = ["customer_name", "customer_phone", "customer_email", "receiver_name", "receiver_phone", "address", "note"];
  const SUBMIT_LABEL = "前往付款";

  let subtotal = 0;
  let shipping = { free_shipping_threshold: Infinity, methods: [] };

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

  function selectedMethod() {
    const checked = form.querySelector('input[name="shipping_method"]:checked');
    return checked ? checked.value : "";
  }

  function collect() {
    const data = { receiver_same: sameBox.checked, shipping_method: selectedMethod() };
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

  form.addEventListener("input", saveDraft);
  form.addEventListener("change", saveDraft);

  // ---------- 配送方式與金額 ----------
  function feeFor(method) {
    if (!method) return null;
    return subtotal >= shipping.free_shipping_threshold ? 0 : method.fee;
  }

  function renderTotals() {
    const method = shipping.methods.find((m) => m.code === selectedMethod());
    const fee = feeFor(method);
    $("[data-checkout-subtotal]").textContent = cart.formatPrice(subtotal);
    $("[data-checkout-shipping]").textContent =
      fee === null ? "選擇配送方式後計算" : fee === 0 ? "免運" : cart.formatPrice(fee);
    $("[data-checkout-total]").textContent = fee === null ? "—" : cart.formatPrice(subtotal + fee);
    addressField.hidden = !method || method.code !== "home";

    const note = $("[data-free-shipping-note]");
    const gap = shipping.free_shipping_threshold - subtotal;
    note.textContent = Number.isFinite(gap) && gap > 0 ? `再買 ${cart.formatPrice(gap)} 即可免運` : "";
  }

  function renderShippingOptions() {
    const box = $("[data-shipping-options]");
    const enabled = shipping.methods.filter((m) => m.enabled);
    const preferred = enabled.find((m) => m.code === draft.shipping_method) || (enabled.length === 1 ? enabled[0] : null);
    box.replaceChildren(
      ...shipping.methods.map((m) => {
        const label = document.createElement("label");
        label.className = "co__option" + (m.enabled ? "" : " is-disabled");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "shipping_method";
        input.value = m.code;
        input.disabled = !m.enabled;
        input.checked = preferred ? preferred.code === m.code : false;
        const name = document.createElement("span");
        name.textContent = m.label;
        const fee = document.createElement("span");
        fee.className = "co__option-fee";
        fee.textContent = m.enabled ? cart.formatPrice(m.fee) : "即將開放";
        label.append(input, name, fee);
        return label;
      })
    );
    box.addEventListener("change", renderTotals);
  }

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
      if (input && input.setAttribute) {
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
    subtotal = quote.subtotal;
    renderTotals();
  }

  // ---------- 建立訂單並前往付款 ----------
  function csrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  async function createOrder() {
    if (!csrfToken()) await fetch(`${cart.apiBase}/api/csrf/`, { credentials: "include" });
    const res = await fetch(`${cart.apiBase}/api/orders/`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() },
      body: JSON.stringify({ items: cart.items(), customer: collect() }),
    });
    if (res.status !== 201 && res.status !== 400 && res.status !== 503) throw new Error(res.status);
    return res.json();
  }

  function goToPayment(payment) {
    const payForm = document.createElement("form");
    payForm.method = "POST";
    payForm.action = payment.action;
    payForm.acceptCharset = "UTF-8";
    payForm.hidden = true;
    Object.entries(payment.fields).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      payForm.appendChild(input);
    });
    document.body.appendChild(payForm);
    payForm.submit();
  }

  function resetSubmit() {
    submit.disabled = false;
    submit.textContent = SUBMIT_LABEL;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submit.disabled = true;
    submit.textContent = "建立訂單中…";
    clearErrors();
    try {
      const result = await createOrder();
      if (result.cart) renderSummary(result.cart);
      if (!result.ok) {
        showErrors(result.errors || { cart: [result.error || "資料有誤，請檢查後再試一次"] });
        resetSubmit();
        return;
      }
      submit.textContent = "前往綠界付款頁…";
      goToPayment(result.payment);
    } catch (err) {
      showErrors({ cart: ["暫時無法連線，請稍後再試一次"] });
      resetSubmit();
    }
  });

  // 從綠界付款頁按「上一頁」回來時，頁面可能是瀏覽器快取的舊狀態，按鈕要恢復可按
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) resetSubmit();
  });

  // ---------- 初始載入：先確認購物車與配送方式 ----------
  try {
    const [quote, options] = await Promise.all([
      cart.quote(),
      fetch(`${cart.apiBase}/api/shipping/options/`).then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      }),
    ]);
    shipping = options;
    renderShippingOptions();
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
