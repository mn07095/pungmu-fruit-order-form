(function () {
  const defaultSettings = {
    description: "풍무농산 과일 공동구매 주문서입니다.\n제철 과일과 신선 먹거리를 품목별 남은 수량 확인 후 바로 주문할 수 있으며, 결제는 현장에서 진행됩니다.",
    orderDeadline: "오늘 오후 6시 마감",
    deliverySchedule: "",
    contact: "문의 010-0000-0000",
    paymentTitle: "",
    notices: [
      "과일은 당일 입고 수량 기준으로 주문을 받으며, 입금 확인 순으로 최종 확정됩니다.",
      "품목별 재고 소진 시 조기 마감 또는 품절 처리될 수 있습니다.",
      "중량과 당도는 농산물 특성상 약간의 차이가 있을 수 있습니다.",
      "현장결제 기준으로 주문이 접수됩니다."
    ],
    paymentGuide: "",
    apartments: [
      "풍무푸르지오",
      "풍무센트럴푸르지오",
      "풍무자이",
      "풍무한화꿈에그린",
      "풍무동양파라곤",
      "기타 단지"
    ],
    products: [
      { id: "strawberry", emoji: "🍓", name: "설향 딸기 1박스", desc: "당도 좋은 특상품 / 750g 내외 / 당일입고", price: 15900, stock: 12, event: { enabled: true, label: "12:00 오픈 특가", openTime: "12:00", originalPrice: 12000, salePrice: 8900, limit: 20 } },
      { id: "shine-muscat", emoji: "🍇", name: "샤인머스캣 1수", desc: "달콤한 프리미엄 과일 / 선물용 가능", price: 18900, stock: 7, event: { enabled: false, label: "수량한정 특가", openTime: "12:00", originalPrice: 18900, salePrice: 15900, limit: 20 } },
      { id: "tomato", emoji: "🍅", name: "대추방울토마토 1팩", desc: "신선포장 / 간식용 인기 품목", price: 7900, stock: 20, event: { enabled: false, label: "", openTime: "12:00", originalPrice: 7900, salePrice: 6900, limit: 20 } },
      { id: "orange", emoji: "🍊", name: "오렌지 10과", desc: "과즙 가득 / 가족간식 추천", price: 13900, stock: 9, event: { enabled: false, label: "품절임박!!", openTime: "12:00", originalPrice: 13900, salePrice: 11900, limit: 20 } },
      { id: "apple", emoji: "🍎", name: "사과 1봉", desc: "가정용 알뜰 구성 / 아삭한 식감", price: 12900, stock: 10, event: { enabled: false, label: "", openTime: "12:00", originalPrice: 12900, salePrice: 10900, limit: 20 } },
      { id: "pear", emoji: "🍐", name: "배 3입", desc: "시원하고 달큰한 제철 배", price: 11900, stock: 8, event: { enabled: false, label: "", openTime: "12:00", originalPrice: 11900, salePrice: 9900, limit: 20 } }
    ]
  };

  const currency = new Intl.NumberFormat("ko-KR");
  const storage = window.OrderFormStorage;
  let settings = storage.clone(defaultSettings);
  let orders = [];

  const modeText = document.getElementById("modeText");
  const productAdminList = document.getElementById("productAdminList");
  const eventAdminList = document.getElementById("eventAdminList");
  const orderList = document.getElementById("orderList");
  const orderSearchInput = document.getElementById("orderSearchInput");
  const paidOrderList = document.getElementById("paidOrderList");
  const paidSearchInput = document.getElementById("paidSearchInput");
  const previousOrderList = document.getElementById("previousOrderList");
  const previousSearchInput = document.getElementById("previousSearchInput");
  const inventoryStatus = document.getElementById("inventoryStatus");
  const eventStatus = document.getElementById("eventStatus");
  const settingsStatus = document.getElementById("settingsStatus");
  const authBox = document.getElementById("authBox");
  const authStatus = document.getElementById("authStatus");
  const authDescription = document.getElementById("authDescription");
  const adminEmailInput = document.getElementById("adminEmailInput");
  const logoutBtn = document.getElementById("logoutBtn");
  let session = null;

  const descriptionInput = document.getElementById("descriptionInput");
  const deadlineInput = document.getElementById("deadlineInput");
  const contactInput = document.getElementById("contactInput");
  const noticeInput = document.getElementById("noticeInput");

  function createProductId(name, index) {
    return `${name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "") || "item"}-${index + 1}`;
  }

  function getDefaultEvent(product, index) {
    const matched = defaultSettings.products.find((item) => item.id === product.id) || defaultSettings.products[index];
    return matched && matched.event
      ? storage.clone(matched.event)
      : { enabled: false, label: "", openTime: "12:00", originalPrice: product.price || 0, salePrice: product.price || 0, limit: 20 };
  }

  function normalizeSettings(nextSettings) {
    return {
      ...defaultSettings,
      ...nextSettings,
      products: (nextSettings.products || defaultSettings.products).map((product, index) => ({
        ...product,
        event: product.event || getDefaultEvent(product, index)
      }))
    };
  }

  function getDiscountRate(originalPrice, salePrice) {
    const original = Number(originalPrice || 0);
    const sale = Number(salePrice || 0);
    if (original <= 0 || sale <= 0 || sale >= original) {
      return 0;
    }
    return Math.round(((original - sale) / original) * 100);
  }

  function setModeText() {
    modeText.textContent = storage.isCloudMode()
      ? "현재 모드: Supabase 실운영 모드"
      : "현재 모드: 데모 모드 (이 브라우저에서만 확인)";
  }

  function getSupabaseClient() {
    if (!storage.isCloudMode()) {
      return null;
    }
    const config = storage.getConfig();
    return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  function setAuthUi() {
    if (!storage.isCloudMode()) {
      authBox.classList.add("hidden");
      logoutBtn.classList.add("hidden");
      authDescription.textContent = "데모 모드에서는 로그인 없이 같은 브라우저 데이터만 확인합니다.";
      return;
    }

    const loggedIn = Boolean(session && session.user);
    authBox.classList.toggle("hidden", loggedIn);
    logoutBtn.classList.toggle("hidden", !loggedIn);
    if (loggedIn) {
      modeText.textContent = `현재 모드: Supabase 실운영 모드 / 로그인 ${session.user.email}`;
    }
  }

  function fillSettingsForm() {
    descriptionInput.value = settings.description;
    deadlineInput.value = settings.orderDeadline;
    contactInput.value = settings.contact;
    noticeInput.value = settings.notices.join("\n");
  }

  function renderProducts() {
    const emojiOptions = ["🍓", "🍇", "🍎", "🍐", "🍊", "🍅", "🍑", "🥝", "🍉", "🥭", "🍒", "🍏"];
    productAdminList.innerHTML = settings.products.map((product, index) => `
      <div class="product-admin-item" data-product-index="${index}">
        <div class="product-admin-head">
          <div>
            <strong>${product.emoji || "🍏"} ${product.name}</strong>
            <div class="muted">${product.desc}</div>
          </div>
          <div class="pill">${currency.format(product.price)}원</div>
        </div>
        <div class="product-admin-grid">
          <div>
            <label for="emoji-preset-${index}">이모지</label>
            <div class="emoji-picker">
              <select id="emoji-preset-${index}" data-emoji-preset="${index}">
                ${emojiOptions.map((emoji) => `<option value="${emoji}" ${emoji === product.emoji ? "selected" : ""}>${emoji}</option>`).join("")}
                <option value="custom" ${emojiOptions.includes(product.emoji) ? "" : "selected"}>기타</option>
              </select>
              <input id="emoji-${index}" data-field="emoji" data-product-index="${index}" type="text" maxlength="4" value="${product.emoji || "🍏"}" />
            </div>
          </div>
          <div>
            <label for="name-${index}">상품명</label>
            <input id="name-${index}" data-field="name" data-product-index="${index}" type="text" value="${product.name}" />
          </div>
          <div>
            <label for="desc-${index}">설명</label>
            <input id="desc-${index}" data-field="desc" data-product-index="${index}" type="text" value="${product.desc}" />
          </div>
          <div>
            <label for="price-${index}">가격</label>
            <input id="price-${index}" data-field="price" data-product-index="${index}" type="number" min="0" value="${product.price}" />
          </div>
          <div>
            <label for="stock-${product.id}">남은 수량</label>
            <input id="stock-${index}" data-field="stock" data-product-index="${index}" type="number" min="0" value="${product.stock}" />
          </div>
        </div>
        <div class="product-admin-foot">
          <button type="button" class="ghost" data-delete-product="${index}">삭제</button>
        </div>
      </div>
    `).join("");

    document.querySelectorAll("[data-delete-product]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.deleteProduct);
        settings.products = collectUpdatedProducts();
        settings.products.splice(index, 1);
        renderProducts();
        renderEvents();
      });
    });

    document.querySelectorAll("[data-emoji-preset]").forEach((select) => {
      select.addEventListener("change", () => {
        if (select.value === "custom") {
          return;
        }
        document.getElementById(`emoji-${select.dataset.emojiPreset}`).value = select.value;
      });
    });
  }

  function renderEvents() {
    eventAdminList.innerHTML = settings.products.map((product, index) => {
      const event = product.event || getDefaultEvent(product, index);
      const discount = getDiscountRate(event.originalPrice, event.salePrice);
      return `
        <div class="event-admin-item" data-event-index="${index}">
          <div class="product-admin-head">
            <div>
              <strong>${product.emoji || "🍏"} ${product.name}</strong>
              <div class="muted">${event.enabled ? "주문서 상단에 노출" : "이벤트 꺼짐"} · ${discount ? `${discount}% 할인` : "할인율 없음"}</div>
            </div>
            <label class="pill" for="event-enabled-${index}">
              <input id="event-enabled-${index}" type="checkbox" ${event.enabled ? "checked" : ""} style="width:auto;min-height:auto;" />
              사용
            </label>
          </div>
          <div class="event-admin-grid">
            <div>
              <label for="event-label-${index}">이벤트 문구</label>
              <input id="event-label-${index}" type="text" value="${event.label || ""}" placeholder="12:00 오픈 특가" />
            </div>
            <div>
              <label for="event-open-${index}">오픈 시간</label>
              <input id="event-open-${index}" type="time" value="${event.openTime || "12:00"}" />
            </div>
            <div>
              <label for="event-original-${index}">원래 가격</label>
              <input id="event-original-${index}" data-discount-source="${index}" type="number" min="0" value="${event.originalPrice || product.price || 0}" />
            </div>
            <div>
              <label for="event-sale-${index}">할인가</label>
              <input id="event-sale-${index}" data-discount-source="${index}" type="number" min="0" value="${event.salePrice || product.price || 0}" />
            </div>
            <div>
              <label for="event-limit-${index}">한정 수량</label>
              <input id="event-limit-${index}" type="number" min="0" value="${event.limit || 20}" />
            </div>
            <div>
              <label>자동 할인율</label>
              <div class="pill" id="event-discount-${index}">${discount ? `${discount}% 할인` : "0%"}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    document.querySelectorAll("[data-discount-source]").forEach((input) => {
      input.addEventListener("input", () => {
        const index = input.dataset.discountSource;
        const discount = getDiscountRate(
          document.getElementById(`event-original-${index}`).value,
          document.getElementById(`event-sale-${index}`).value
        );
        document.getElementById(`event-discount-${index}`).textContent = discount ? `${discount}% 할인` : "0%";
      });
    });
  }

  function renderSummary() {
    const total = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    const newCount = orders.filter((order) => order.status === "new").length;
    const paidCount = orders.filter((order) => order.status === "paid").length;

    document.getElementById("totalOrders").textContent = String(orders.length);
    document.getElementById("newOrders").textContent = String(newCount);
    document.getElementById("paidOrders").textContent = String(paidCount);
    document.getElementById("totalAmount").textContent = `${currency.format(total)}원`;
  }

  function getOrderDate(order) {
    return new Date(order.created_at || Date.now());
  }

  function isToday(date) {
    const now = new Date();
    return date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate();
  }

  function formatDateTime(value) {
    if (!value) {
      return "";
    }
    return new Date(value).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getStatusLabel(status) {
    if (status === "paid") {
      return { label: "결제 완료", className: "pill done" };
    }
    return { label: "신규 주문", className: "pill pending" };
  }

  function filterOrders(orderSet, keyword) {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return orderSet.filter((order) => {
      const itemsText = (order.items || []).map((item) => item.name).join(" ");
      const haystack = [
        order.customer_name,
        order.phone,
        itemsText,
        order.memo
      ].join(" ").toLowerCase();

      return !normalizedKeyword || haystack.includes(normalizedKeyword);
    });
  }

  function renderOrders() {
    const todayOrders = orders.filter((order) => isToday(getOrderDate(order)));
    const previousOrders = orders.filter((order) => !isToday(getOrderDate(order)));

    const activeOrders = todayOrders.filter((order) => order.status !== "paid");
    const filteredOrders = filterOrders(activeOrders, orderSearchInput.value);
    if (filteredOrders.length === 0) {
      orderList.innerHTML = '<div class="muted">검색 결과 또는 접수된 주문이 없습니다.</div>';
    } else {
      orderList.innerHTML = filteredOrders.map((order) => renderOrderCard(order, "active")).join("");
    }

    const paidOrders = todayOrders.filter((order) => order.status === "paid");
    const filteredPaidOrders = filterOrders(paidOrders, paidSearchInput.value);
    if (filteredPaidOrders.length === 0) {
      paidOrderList.innerHTML = '<div class="muted">결제완료 주문이 없습니다.</div>';
    } else {
      paidOrderList.innerHTML = filteredPaidOrders.map((order) => renderOrderCard(order, "paid")).join("");
    }

    const filteredPreviousOrders = filterOrders(previousOrders, previousSearchInput.value);
    if (filteredPreviousOrders.length === 0) {
      previousOrderList.innerHTML = '<div class="muted">이전 주문이 없습니다.</div>';
    } else {
      previousOrderList.innerHTML = filteredPreviousOrders.map((order) => renderOrderCard(order, "previous")).join("");
    }

    bindOrderStatusButtons();
  }

  function renderOrderCard(order, type) {
    const status = getStatusLabel(order.status);
    const itemsHtml = (order.items || [])
      .map((item) => `${item.name} ${item.qty}개`)
      .join(", ");
    const actionButton = order.status === "paid"
      ? '<button type="button" class="ghost" data-status-id="' + order.id + '" data-status="new">결제 취소</button>'
      : '<button type="button" class="primary" data-status-id="' + order.id + '" data-status="paid">결제완료</button>';
    const paidDateHtml = order.paid_at
      ? `<br />결제일: ${formatDateTime(order.paid_at)}`
      : "";

    return `
      <div class="order-card">
        <div class="order-head">
          <div>
            <strong>${order.customer_name}</strong>
            <div class="order-meta">
              접수일: ${formatDateTime(order.created_at)}${paidDateHtml}<br />
              연락처: ${order.phone}<br />
              상품: ${itemsHtml || "-"}<br />
              금액: ${currency.format(order.total_amount || 0)}원
            </div>
          </div>
          <div class="${status.className}">${status.label}</div>
        </div>
        <div class="order-actions">
          ${actionButton}
        </div>
      </div>
    `;
  }

  function bindOrderStatusButtons() {
    document.querySelectorAll("[data-status-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        const isPaid = button.dataset.status === "paid";
        const message = isPaid
          ? "이 주문을 결제완료로 이동할까요?"
          : "결제를 취소하고 주문 목록으로 되돌릴까요?";
        if (!confirm(message)) {
          return;
        }
        try {
          await storage.updateOrderStatus(button.dataset.statusId, button.dataset.status);
          await refreshOrders();
        } catch (error) {
          settingsStatus.textContent = `주문 상태 변경 실패: ${error.message}`;
        }
      });
    });
  }

  function collectUpdatedProducts() {
    return settings.products.map((product, index) => {
      const name = document.getElementById(`name-${index}`).value.trim() || product.name;
      return {
        ...product,
        id: product.id || createProductId(name, index),
        emoji: document.getElementById(`emoji-${index}`).value.trim() || "🍏",
        name,
        desc: document.getElementById(`desc-${index}`).value.trim() || "",
        stock: Number(document.getElementById(`stock-${index}`).value || 0),
        price: Number(document.getElementById(`price-${index}`).value || 0),
        event: product.event || getDefaultEvent(product, index)
      };
    });
  }

  function collectUpdatedEvents(products = settings.products) {
    return products.map((product, index) => ({
      ...product,
      event: {
        enabled: document.getElementById(`event-enabled-${index}`)?.checked || false,
        label: document.getElementById(`event-label-${index}`)?.value.trim() || "",
        openTime: document.getElementById(`event-open-${index}`)?.value || "12:00",
        originalPrice: Number(document.getElementById(`event-original-${index}`)?.value || product.price || 0),
        salePrice: Number(document.getElementById(`event-sale-${index}`)?.value || product.price || 0),
        limit: Number(document.getElementById(`event-limit-${index}`)?.value || 0)
      }
    }));
  }

  function addProduct() {
    settings.products = collectUpdatedProducts();
    const index = settings.products.length;
    settings.products.push({
      id: createProductId("새 상품", index),
      emoji: "🍏",
      name: "새 상품",
      desc: "상품 설명을 입력해주세요",
      price: 0,
      stock: 0,
      event: { enabled: false, label: "", openTime: "12:00", originalPrice: 0, salePrice: 0, limit: 20 }
    });
    renderProducts();
    renderEvents();
  }

  async function saveInventory() {
    if (storage.isCloudMode() && !session) {
      inventoryStatus.textContent = "먼저 관리자 로그인을 완료해주세요.";
      return;
    }
    try {
      settings.products = collectUpdatedProducts();
      await storage.saveSettings(settings);
      inventoryStatus.textContent = "재고와 가격을 저장했습니다.";
      renderProducts();
      renderEvents();
    } catch (error) {
      inventoryStatus.textContent = `재고 저장 실패: ${error.message}`;
    }
  }

  async function saveEvents() {
    if (storage.isCloudMode() && !session) {
      eventStatus.textContent = "먼저 관리자 로그인을 완료해주세요.";
      return;
    }
    try {
      settings.products = collectUpdatedEvents(collectUpdatedProducts());
      await storage.saveSettings(settings);
      eventStatus.textContent = "이벤트를 저장했습니다.";
      renderProducts();
      renderEvents();
    } catch (error) {
      eventStatus.textContent = `이벤트 저장 실패: ${error.message}`;
    }
  }

  async function savePageSettings() {
    if (storage.isCloudMode() && !session) {
      settingsStatus.textContent = "먼저 관리자 로그인을 완료해주세요.";
      return;
    }
    try {
      settings.description = descriptionInput.value.trim() || settings.description;
      settings.orderDeadline = deadlineInput.value.trim() || settings.orderDeadline;
      settings.deliverySchedule = "";
      settings.contact = contactInput.value.trim() || settings.contact;
      settings.paymentTitle = "";
      settings.notices = noticeInput.value.split("\n").map((line) => line.trim()).filter(Boolean);

      await storage.saveSettings(settings);
      settingsStatus.textContent = "운영 설정을 저장했습니다.";
    } catch (error) {
      settingsStatus.textContent = `설정 저장 실패: ${error.message}`;
    }
  }

  async function refreshOrders() {
    if (storage.isCloudMode() && !session) {
      orders = [];
      renderSummary();
      orderList.innerHTML = '<div class="muted">로그인 후 주문 목록을 불러올 수 있습니다.</div>';
      return;
    }
    orders = await storage.listOrders();
    renderSummary();
    renderOrders();
  }

  async function sendMagicLink() {
    if (!storage.isCloudMode()) {
      authStatus.textContent = "데모 모드에서는 로그인 없이 바로 사용 가능합니다.";
      return;
    }

    const email = adminEmailInput.value.trim();
    if (!email) {
      authStatus.textContent = "관리자 이메일을 입력해주세요.";
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const redirectTo = window.location.href.split("?")[0];
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo }
      });
      if (error) {
        throw error;
      }
      authStatus.textContent = "이메일로 로그인 링크를 보냈습니다. 메일에서 링크를 열어주세요.";
    } catch (error) {
      authStatus.textContent = `로그인 링크 발송 실패: ${error.message}`;
    }
  }

  async function checkSession() {
    if (!storage.isCloudMode()) {
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }
      session = data.session;
      setAuthUi();
      await refreshOrders();
    } catch (error) {
      authStatus.textContent = `세션 확인 실패: ${error.message}`;
    }
  }

  async function logout() {
    if (!storage.isCloudMode()) {
      return;
    }
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      session = null;
      setAuthUi();
      await refreshOrders();
    } catch (error) {
      authStatus.textContent = `로그아웃 실패: ${error.message}`;
    }
  }

  async function init() {
    setModeText();
    settings = normalizeSettings(await storage.loadSettings(defaultSettings));
    fillSettingsForm();
    renderProducts();
    renderEvents();
    await checkSession();
    setAuthUi();
    await refreshOrders();
  }

  document.getElementById("saveInventoryBtn").addEventListener("click", saveInventory);
  document.getElementById("addProductBtn").addEventListener("click", addProduct);
  document.getElementById("saveEventsBtn").addEventListener("click", saveEvents);
  document.getElementById("saveSettingsBtn").addEventListener("click", savePageSettings);
  document.getElementById("refreshBtn").addEventListener("click", init);
  orderSearchInput.addEventListener("input", renderOrders);
  paidSearchInput.addEventListener("input", renderOrders);
  previousSearchInput.addEventListener("input", renderOrders);
  document.getElementById("clearOrderSearchBtn").addEventListener("click", () => {
    orderSearchInput.value = "";
    renderOrders();
  });
  document.getElementById("clearPaidSearchBtn").addEventListener("click", () => {
    paidSearchInput.value = "";
    renderOrders();
  });
  document.getElementById("clearPreviousSearchBtn").addEventListener("click", () => {
    previousSearchInput.value = "";
    renderOrders();
  });
  document.getElementById("sendMagicLinkBtn").addEventListener("click", sendMagicLink);
  document.getElementById("checkSessionBtn").addEventListener("click", checkSession);
  logoutBtn.addEventListener("click", logout);

  init();
}());
