(function () {
  const currency = new Intl.NumberFormat("ko-KR");
  const storage = window.OrderFormStorage;
  let orders = [];
  let session = null;

  const modeText = document.getElementById("modeText");
  const orderList = document.getElementById("orderList");
  const orderSearchInput = document.getElementById("orderSearchInput");
  const paidOrderList = document.getElementById("paidOrderList");
  const paidSearchInput = document.getElementById("paidSearchInput");
  const previousOrderList = document.getElementById("previousOrderList");
  const previousSearchInput = document.getElementById("previousSearchInput");
  const authBox = document.getElementById("authBox");
  const authStatus = document.getElementById("authStatus");
  const authDescription = document.getElementById("authDescription");
  const adminEmailInput = document.getElementById("adminEmailInput");
  const logoutBtn = document.getElementById("logoutBtn");

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
    return { label: "신규 주문", className: "pill" };
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
    orderList.innerHTML = filteredOrders.length
      ? filteredOrders.map((order) => renderOrderCard(order)).join("")
      : '<div class="muted">검색 결과 또는 접수된 주문이 없습니다.</div>';

    const paidOrders = todayOrders.filter((order) => order.status === "paid");
    const filteredPaidOrders = filterOrders(paidOrders, paidSearchInput.value);
    paidOrderList.innerHTML = filteredPaidOrders.length
      ? filteredPaidOrders.map((order) => renderOrderCard(order)).join("")
      : '<div class="muted">결제완료 주문이 없습니다.</div>';

    const filteredPreviousOrders = filterOrders(previousOrders, previousSearchInput.value);
    previousOrderList.innerHTML = filteredPreviousOrders.length
      ? filteredPreviousOrders.map((order) => renderOrderCard(order)).join("")
      : '<div class="muted">이전 주문이 없습니다.</div>';

    bindOrderStatusButtons();
  }

  function renderOrderCard(order) {
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
          authStatus.textContent = `주문 상태 변경 실패: ${error.message}`;
        }
      });
    });
  }

  async function refreshOrders() {
    if (storage.isCloudMode() && !session) {
      orders = [];
      renderSummary();
      orderList.innerHTML = '<div class="muted">로그인 후 주문 목록을 불러올 수 있습니다.</div>';
      paidOrderList.innerHTML = "";
      previousOrderList.innerHTML = "";
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
    await checkSession();
    setAuthUi();
    await refreshOrders();
  }

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
