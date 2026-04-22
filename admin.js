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
      { id: "strawberry", emoji: "🍓", name: "설향 딸기 1박스", desc: "당도 좋은 특상품 / 750g 내외 / 당일입고", price: 15900, stock: 12, promo: "12:00 오픈 특가" },
      { id: "shine-muscat", emoji: "🍇", name: "샤인머스캣 1수", desc: "달콤한 프리미엄 과일 / 선물용 가능", price: 18900, stock: 7, promo: "수량한정 20개" },
      { id: "tomato", emoji: "🍅", name: "대추방울토마토 1팩", desc: "신선포장 / 간식용 인기 품목", price: 7900, stock: 20, promo: "" },
      { id: "orange", emoji: "🍊", name: "오렌지 10과", desc: "과즙 가득 / 가족간식 추천", price: 13900, stock: 9, promo: "품절임박!!" },
      { id: "apple", emoji: "🍎", name: "사과 1봉", desc: "가정용 알뜰 구성 / 아삭한 식감", price: 12900, stock: 10, promo: "" },
      { id: "pear", emoji: "🍐", name: "배 3입", desc: "시원하고 달큰한 제철 배", price: 11900, stock: 8, promo: "" }
    ]
  };

  const currency = new Intl.NumberFormat("ko-KR");
  const storage = window.OrderFormStorage;
  let settings = storage.clone(defaultSettings);
  let orders = [];

  const modeText = document.getElementById("modeText");
  const productAdminList = document.getElementById("productAdminList");
  const orderList = document.getElementById("orderList");
  const orderSearchInput = document.getElementById("orderSearchInput");
  const paidOrderList = document.getElementById("paidOrderList");
  const paidSearchInput = document.getElementById("paidSearchInput");
  const inventoryStatus = document.getElementById("inventoryStatus");
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
            <label for="emoji-${index}">이모지</label>
            <input id="emoji-${index}" data-field="emoji" data-product-index="${index}" type="text" value="${product.emoji || "🍏"}" />
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
            <label for="promo-${index}">프로모션 문구</label>
            <input id="promo-${index}" data-field="promo" data-product-index="${index}" type="text" value="${product.promo || ""}" placeholder="12:00 오픈 특가" />
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
    const activeOrders = orders.filter((order) => order.status !== "paid");
    const filteredOrders = filterOrders(activeOrders, orderSearchInput.value);
    if (filteredOrders.length === 0) {
      orderList.innerHTML = '<div class="muted">검색 결과 또는 접수된 주문이 없습니다.</div>';
    } else {
      orderList.innerHTML = filteredOrders.map((order) => renderOrderCard(order, "active")).join("");
    }

    const paidOrders = orders.filter((order) => order.status === "paid");
    const filteredPaidOrders = filterOrders(paidOrders, paidSearchInput.value);
    if (filteredPaidOrders.length === 0) {
      paidOrderList.innerHTML = '<div class="muted">결제완료 주문이 없습니다.</div>';
    } else {
      paidOrderList.innerHTML = filteredPaidOrders.map((order) => renderOrderCard(order, "paid")).join("");
    }

    bindOrderStatusButtons();
  }

  function renderOrderCard(order, type) {
    const status = getStatusLabel(order.status);
    const itemsHtml = (order.items || [])
      .map((item) => `${item.name} ${item.qty}개`)
      .join(", ");
    const actionButton = type === "paid"
      ? '<button type="button" class="ghost" data-status-id="' + order.id + '" data-status="new">결제 취소</button>'
      : '<button type="button" class="primary" data-status-id="' + order.id + '" data-status="paid">결제완료</button>';

    return `
      <div class="order-card">
        <div class="order-head">
          <div>
            <strong>${order.customer_name}</strong>
            <div class="order-meta">
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
        promo: document.getElementById(`promo-${index}`).value.trim() || "",
        stock: Number(document.getElementById(`stock-${index}`).value || 0),
        price: Number(document.getElementById(`price-${index}`).value || 0)
      };
    });
  }

  function addProduct() {
    settings.products = collectUpdatedProducts();
    const index = settings.products.length;
    settings.products.push({
      id: createProductId("새 상품", index),
      emoji: "🍏",
      name: "새 상품",
      desc: "상품 설명을 입력해주세요",
      promo: "",
      price: 0,
      stock: 0
    });
    renderProducts();
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
    } catch (error) {
      inventoryStatus.textContent = `재고 저장 실패: ${error.message}`;
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
    settings = await storage.loadSettings(defaultSettings);
    fillSettingsForm();
    renderProducts();
    await checkSession();
    setAuthUi();
    await refreshOrders();
  }

  document.getElementById("saveInventoryBtn").addEventListener("click", saveInventory);
  document.getElementById("addProductBtn").addEventListener("click", addProduct);
  document.getElementById("saveSettingsBtn").addEventListener("click", savePageSettings);
  document.getElementById("refreshBtn").addEventListener("click", init);
  orderSearchInput.addEventListener("input", renderOrders);
  paidSearchInput.addEventListener("input", renderOrders);
  document.getElementById("clearOrderSearchBtn").addEventListener("click", () => {
    orderSearchInput.value = "";
    renderOrders();
  });
  document.getElementById("clearPaidSearchBtn").addEventListener("click", () => {
    paidSearchInput.value = "";
    renderOrders();
  });
  document.getElementById("sendMagicLinkBtn").addEventListener("click", sendMagicLink);
  document.getElementById("checkSessionBtn").addEventListener("click", checkSession);
  logoutBtn.addEventListener("click", logout);

  init();
}());
