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
    events: [
      { id: "event-strawberry", emoji: "🍓", name: "제철 딸기 오픈 특가", desc: "12시 오픈 한정 특가 상품", label: "12:00 오픈 특가", openTime: "12:00", originalPrice: 12000, salePrice: 8900, stock: 20, enabled: true }
    ],
    products: [
      { id: "strawberry", emoji: "🍓", name: "설향 딸기 1박스", desc: "당도 좋은 특상품 / 750g 내외 / 당일입고", price: 15900, stock: 12 },
      { id: "shine-muscat", emoji: "🍇", name: "샤인머스캣 1수", desc: "달콤한 프리미엄 과일 / 선물용 가능", price: 18900, stock: 7 },
      { id: "orange", emoji: "🍊", name: "오렌지 10과", desc: "과즙 가득 / 가족간식 추천", price: 13900, stock: 9 },
      { id: "apple", emoji: "🍎", name: "사과 1봉", desc: "가정용 알뜰 구성 / 아삭한 식감", price: 12900, stock: 10 },
      { id: "pear", emoji: "🍐", name: "배 3입", desc: "시원하고 달큰한 제철 배", price: 11900, stock: 8 }
    ],
    vegetables: [
      { id: "tomato", emoji: "🍅", name: "대추방울토마토 1팩", desc: "신선포장 / 간식용 인기 품목", price: 7900, stock: 20 },
      { id: "cucumber", emoji: "🥒", name: "오이 3입", desc: "아삭한 당일 입고 채소", price: 3900, stock: 15 },
      { id: "lettuce", emoji: "🥬", name: "상추 1봉", desc: "쌈채소 / 신선 포장", price: 2900, stock: 18 }
    ]
  };

  const currency = new Intl.NumberFormat("ko-KR");
  const storage = window.OrderFormStorage;
  let settings = storage.clone(defaultSettings);
  let orders = [];

  const modeText = document.getElementById("modeText");
  const fruitAdminList = document.getElementById("fruitAdminList");
  const vegetableAdminList = document.getElementById("vegetableAdminList");
  const eventAdminList = document.getElementById("eventAdminList");
  const orderList = document.getElementById("orderList");
  const orderSearchInput = document.getElementById("orderSearchInput");
  const paidOrderList = document.getElementById("paidOrderList");
  const paidSearchInput = document.getElementById("paidSearchInput");
  const previousOrderList = document.getElementById("previousOrderList");
  const previousSearchInput = document.getElementById("previousSearchInput");
  const fruitStatus = document.getElementById("fruitStatus");
  const vegetableStatus = document.getElementById("vegetableStatus");
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

  function normalizeSettings(nextSettings) {
    const vegetableIds = new Set(["tomato", "cucumber", "lettuce", "carrot", "corn", "potato", "sweet-potato", "onion", "garlic", "broccoli", "pepper", "eggplant"]);
    const sourceProducts = nextSettings.products || defaultSettings.products;
    const migratedVegetables = sourceProducts.filter((product) => vegetableIds.has(product.id)).map(({ event, ...product }) => product);
    const legacyEvents = (nextSettings.products || [])
      .filter((product) => product.event && product.event.enabled)
      .map((product) => ({
        id: `event-${product.id}`,
        emoji: product.emoji || "🍏",
        name: product.name,
        desc: product.desc || "",
        label: product.event.label || "오늘의 특가",
        openTime: product.event.openTime || "12:00",
        originalPrice: Number(product.event.originalPrice || product.price || 0),
        salePrice: Number(product.event.salePrice || product.price || 0),
        stock: Number(product.event.limit || product.stock || 0),
        enabled: true
      }));

    return {
      ...defaultSettings,
      ...nextSettings,
      events: (nextSettings.events || legacyEvents.length) ? (nextSettings.events || legacyEvents) : defaultSettings.events,
      products: sourceProducts.filter((product) => !vegetableIds.has(product.id)).map(({ event, ...product }) => product),
      vegetables: nextSettings.vegetables || (migratedVegetables.length ? migratedVegetables : defaultSettings.vegetables)
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

  const fruitEmojiOptions = ["🍓", "🍇", "🍎", "🍐", "🍊", "🍑", "🥝", "🍉", "🥭", "🍒", "🍋", "🍏"];
  const vegetableEmojiOptions = ["🍅", "🥒", "🥬", "🥕", "🌽", "🥔", "🍠", "🧅", "🧄", "🥦", "🫑", "🍆"];
  const eventEmojiOptions = [...fruitEmojiOptions, ...vegetableEmojiOptions, "🔥", "⏰", "⭐"];

  function renderInventoryList(listEl, items, type, emojiOptions) {
    listEl.innerHTML = items.map((product, index) => `
      <div class="product-admin-item" data-${type}-index="${index}">
        <div class="product-admin-head">
          <div>
            <strong>${product.emoji || "🍏"} ${product.name}</strong>
            <div class="muted">${product.desc}</div>
          </div>
          <div class="pill">${currency.format(product.price)}원</div>
        </div>
        <div class="product-admin-grid">
          <div>
            <label for="${type}-emoji-preset-${index}">이모지</label>
            <div class="emoji-picker">
              <select id="${type}-emoji-preset-${index}" data-emoji-preset="${type}-${index}">
                ${emojiOptions.map((emoji) => `<option value="${emoji}" ${emoji === product.emoji ? "selected" : ""}>${emoji}</option>`).join("")}
                <option value="custom" ${emojiOptions.includes(product.emoji) ? "" : "selected"}>기타</option>
              </select>
              <input id="${type}-emoji-${index}" type="text" maxlength="4" value="${product.emoji || "🍏"}" />
            </div>
          </div>
          <div>
            <label for="${type}-name-${index}">상품명</label>
            <input id="${type}-name-${index}" type="text" value="${product.name}" />
          </div>
          <div>
            <label for="${type}-desc-${index}">설명</label>
            <input id="${type}-desc-${index}" type="text" value="${product.desc}" />
          </div>
          <div>
            <label for="${type}-price-${index}">가격</label>
            <input id="${type}-price-${index}" type="number" min="0" value="${product.price}" />
          </div>
          <div>
            <label for="${type}-stock-${index}">남은 수량</label>
            <input id="${type}-stock-${index}" type="number" min="0" value="${product.stock}" />
          </div>
        </div>
        <div class="product-admin-foot">
          <button type="button" class="ghost" data-delete-inventory="${type}-${index}">삭제</button>
        </div>
      </div>
    `).join("");
  }

  function bindEmojiPickers() {
    document.querySelectorAll("[data-emoji-preset]").forEach((select) => {
      select.addEventListener("change", () => {
        if (select.value === "custom") {
          return;
        }
        document.getElementById(`${select.dataset.emojiPreset.replace(/-\d+$/, "")}-emoji-${select.dataset.emojiPreset.split("-").pop()}`).value = select.value;
      });
    });
  }

  function renderProducts() {
    renderInventoryList(fruitAdminList, settings.products, "fruit", fruitEmojiOptions);
    renderInventoryList(vegetableAdminList, settings.vegetables, "vegetable", vegetableEmojiOptions);

    document.querySelectorAll("[data-delete-inventory]").forEach((button) => {
      button.addEventListener("click", () => {
        const [type, indexText] = button.dataset.deleteInventory.split("-");
        const index = Number(indexText);
        settings.products = collectUpdatedInventory("fruit", settings.products);
        settings.vegetables = collectUpdatedInventory("vegetable", settings.vegetables);
        if (type === "fruit") {
          settings.products.splice(index, 1);
        } else {
          settings.vegetables.splice(index, 1);
        }
        renderProducts();
      });
    });
    bindEmojiPickers();
  }

  function renderEvents() {
    eventAdminList.innerHTML = settings.events.map((event, index) => {
      const discount = getDiscountRate(event.originalPrice, event.salePrice);
      return `
        <div class="event-admin-item" data-event-index="${index}">
          <div class="product-admin-head">
            <div>
              <strong>${event.emoji || "🔥"} ${event.name}</strong>
              <div class="muted">${event.enabled ? "주문서 상단에 노출" : "이벤트 꺼짐"} · ${discount ? `${discount}% 할인` : "할인율 없음"}</div>
            </div>
            <label class="pill" for="event-enabled-${index}">
              <input id="event-enabled-${index}" type="checkbox" ${event.enabled ? "checked" : ""} style="width:auto;min-height:auto;" />
              사용
            </label>
          </div>
          <div class="event-admin-grid">
            <div>
              <label for="event-emoji-preset-${index}">이모지</label>
              <div class="emoji-picker">
                <select id="event-emoji-preset-${index}" data-emoji-preset="event-${index}">
                  ${eventEmojiOptions.map((emoji) => `<option value="${emoji}" ${emoji === event.emoji ? "selected" : ""}>${emoji}</option>`).join("")}
                  <option value="custom" ${eventEmojiOptions.includes(event.emoji) ? "" : "selected"}>기타</option>
                </select>
                <input id="event-emoji-${index}" type="text" maxlength="4" value="${event.emoji || "🔥"}" />
              </div>
            </div>
            <div>
              <label for="event-name-${index}">이벤트 상품명</label>
              <input id="event-name-${index}" type="text" value="${event.name || ""}" placeholder="제철 딸기 오픈 특가" />
            </div>
            <div>
              <label for="event-desc-${index}">설명</label>
              <input id="event-desc-${index}" type="text" value="${event.desc || ""}" placeholder="주문서 이벤트 영역에만 표시" />
            </div>
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
              <input id="event-original-${index}" data-discount-source="${index}" type="number" min="0" value="${event.originalPrice || 0}" />
            </div>
            <div>
              <label for="event-sale-${index}">할인가</label>
              <input id="event-sale-${index}" data-discount-source="${index}" type="number" min="0" value="${event.salePrice || 0}" />
            </div>
            <div>
              <label for="event-limit-${index}">한정 수량</label>
              <input id="event-limit-${index}" type="number" min="0" value="${event.stock || event.limit || 20}" />
            </div>
            <div>
              <label>할인율</label>
              <div class="pill" id="event-discount-${index}">${discount ? `${discount}% 할인` : "0%"}</div>
            </div>
          </div>
          <div class="product-admin-foot">
            <button type="button" class="ghost" data-delete-event="${index}">삭제</button>
          </div>
        </div>
      `;
    }).join("");
    bindEmojiPickers();

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

    document.querySelectorAll("[data-delete-event]").forEach((button) => {
      button.addEventListener("click", () => {
        settings.events = collectUpdatedEvents();
        settings.events.splice(Number(button.dataset.deleteEvent), 1);
        renderEvents();
      });
    });
  }

  function renderSummary() {
    if (!document.getElementById("totalOrders")) {
      return;
    }
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
    if (!orderList || !paidOrderList || !previousOrderList) {
      return;
    }
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

  function collectUpdatedInventory(type, items) {
    return items.map((product, index) => {
      const name = document.getElementById(`${type}-name-${index}`).value.trim() || product.name;
      return {
        ...product,
        id: product.id || createProductId(name, index),
        emoji: document.getElementById(`${type}-emoji-${index}`).value.trim() || "🍏",
        name,
        desc: document.getElementById(`${type}-desc-${index}`).value.trim() || "",
        stock: Number(document.getElementById(`${type}-stock-${index}`).value || 0),
        price: Number(document.getElementById(`${type}-price-${index}`).value || 0)
      };
    });
  }

  function collectUpdatedEvents() {
    return settings.events.map((event, index) => ({
      ...event,
      id: event.id || createProductId(document.getElementById(`event-name-${index}`)?.value || "event", index),
      emoji: document.getElementById(`event-emoji-${index}`)?.value.trim() || "🔥",
      name: document.getElementById(`event-name-${index}`)?.value.trim() || event.name || "새 이벤트",
      desc: document.getElementById(`event-desc-${index}`)?.value.trim() || "",
      enabled: document.getElementById(`event-enabled-${index}`)?.checked || false,
      label: document.getElementById(`event-label-${index}`)?.value.trim() || "",
      openTime: document.getElementById(`event-open-${index}`)?.value || "12:00",
      originalPrice: Number(document.getElementById(`event-original-${index}`)?.value || 0),
      salePrice: Number(document.getElementById(`event-sale-${index}`)?.value || 0),
      stock: Number(document.getElementById(`event-limit-${index}`)?.value || 0)
    }));
  }

  function addInventory(type) {
    settings.products = collectUpdatedInventory("fruit", settings.products);
    settings.vegetables = collectUpdatedInventory("vegetable", settings.vegetables);
    const target = type === "fruit" ? settings.products : settings.vegetables;
    const emoji = type === "fruit" ? "🍎" : "🥬";
    const label = type === "fruit" ? "새 과일" : "새 채소";
    const index = target.length;
    target.push({
      id: createProductId(label, index),
      emoji,
      name: label,
      desc: "상품 설명을 입력해주세요",
      price: 0,
      stock: 0
    });
    renderProducts();
  }

  function addEvent() {
    settings.events = collectUpdatedEvents();
    const index = settings.events.length;
    settings.events.push({
      id: createProductId("새 이벤트", index),
      emoji: "🔥",
      name: "새 이벤트",
      desc: "이벤트 설명을 입력해주세요",
      label: "오픈 특가",
      openTime: "12:00",
      originalPrice: 0,
      salePrice: 0,
      stock: 20,
      enabled: true
    });
    renderEvents();
  }

  async function saveInventory(type) {
    if (storage.isCloudMode() && !session) {
      const statusEl = type === "fruit" ? fruitStatus : vegetableStatus;
      statusEl.textContent = "먼저 관리자 로그인을 완료해주세요.";
      return;
    }
    const statusEl = type === "fruit" ? fruitStatus : vegetableStatus;
    try {
      settings.products = collectUpdatedInventory("fruit", settings.products);
      settings.vegetables = collectUpdatedInventory("vegetable", settings.vegetables);
      await storage.saveSettings(settings);
      statusEl.textContent = type === "fruit" ? "과일 재고를 저장했습니다." : "채소 재고를 저장했습니다.";
      renderProducts();
    } catch (error) {
      statusEl.textContent = `재고 저장 실패: ${error.message}`;
    }
  }

  async function saveEvents() {
    if (storage.isCloudMode() && !session) {
      eventStatus.textContent = "먼저 관리자 로그인을 완료해주세요.";
      return;
    }
    try {
      settings.events = collectUpdatedEvents();
      await storage.saveSettings(settings);
      eventStatus.textContent = "이벤트를 저장했습니다.";
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
    if (!orderList) {
      return;
    }
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

  document.getElementById("saveFruitBtn").addEventListener("click", () => saveInventory("fruit"));
  document.getElementById("addFruitBtn").addEventListener("click", () => addInventory("fruit"));
  document.getElementById("saveVegetableBtn").addEventListener("click", () => saveInventory("vegetable"));
  document.getElementById("addVegetableBtn").addEventListener("click", () => addInventory("vegetable"));
  document.getElementById("addEventBtn").addEventListener("click", addEvent);
  document.getElementById("saveEventsBtn").addEventListener("click", saveEvents);
  document.getElementById("saveSettingsBtn").addEventListener("click", savePageSettings);
  document.getElementById("refreshBtn").addEventListener("click", init);
  if (orderSearchInput) {
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
  }
  document.getElementById("sendMagicLinkBtn").addEventListener("click", sendMagicLink);
  document.getElementById("checkSessionBtn").addEventListener("click", checkSession);
  logoutBtn.addEventListener("click", logout);

  init();
}());
