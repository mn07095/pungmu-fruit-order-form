(function () {
  const DEFAULT_CONFIG = {
    mode: "demo",
    supabaseUrl: "",
    supabaseAnonKey: "",
    settingsRowId: "main"
  };

  const DEMO_SETTINGS_KEY = "pungmu-order-form-settings";
  const DEMO_ORDERS_KEY = "pungmu-order-form-orders";
  let supabaseClient = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getConfig() {
    return {
      ...DEFAULT_CONFIG,
      ...(window.ORDER_APP_CONFIG || {})
    };
  }

  function isCloudMode() {
    const config = getConfig();
    return config.mode === "supabase" && Boolean(config.supabaseUrl) && Boolean(config.supabaseAnonKey);
  }

  function getSupabaseClient() {
    if (!isCloudMode()) {
      return null;
    }
    if (supabaseClient) {
      return supabaseClient;
    }
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase 라이브러리를 불러오지 못했습니다.");
    }

    const config = getConfig();
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    return supabaseClient;
  }

  function readLocalJson(key, fallbackValue) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return clone(fallbackValue);
      }
      return JSON.parse(raw);
    } catch (error) {
      return clone(fallbackValue);
    }
  }

  function writeLocalJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async function loadSettings(defaultSettings) {
    if (!isCloudMode()) {
      return readLocalJson(DEMO_SETTINGS_KEY, defaultSettings);
    }

    try {
      const supabase = getSupabaseClient();
      const config = getConfig();
      const { data, error } = await supabase
        .from("store_settings")
        .select("settings")
        .eq("id", config.settingsRowId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data || !data.settings) {
        await saveSettings(defaultSettings);
        return clone(defaultSettings);
      }

      return {
        ...clone(defaultSettings),
        ...data.settings
      };
    } catch (error) {
      console.error(error);
      return readLocalJson(DEMO_SETTINGS_KEY, defaultSettings);
    }
  }

  async function saveSettings(settings) {
    if (!isCloudMode()) {
      writeLocalJson(DEMO_SETTINGS_KEY, settings);
      return { mode: "demo", savedAt: new Date().toISOString() };
    }

    const supabase = getSupabaseClient();
    const config = getConfig();
    const payload = {
      id: config.settingsRowId,
      settings,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("store_settings")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      throw error;
    }

    return { mode: "supabase", savedAt: payload.updated_at };
  }

  async function createOrder(order) {
    const payload = {
      ...order,
      created_at: new Date().toISOString(),
      status: order.status || "new"
    };

    if (!isCloudMode()) {
      const currentOrders = readLocalJson(DEMO_ORDERS_KEY, []);
      const record = {
        id: crypto.randomUUID(),
        ...payload
      };
      currentOrders.unshift(record);
      writeLocalJson(DEMO_ORDERS_KEY, currentOrders);
      return record;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("orders")
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async function listOrders() {
    if (!isCloudMode()) {
      return readLocalJson(DEMO_ORDERS_KEY, []);
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function updateOrderStatus(id, status) {
    if (!isCloudMode()) {
      const orders = readLocalJson(DEMO_ORDERS_KEY, []);
      const updatedOrders = orders.map((order) => (
        order.id === id
          ? { ...order, status }
          : order
      ));
      writeLocalJson(DEMO_ORDERS_KEY, updatedOrders);
      return updatedOrders.find((order) => order.id === id) || null;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  window.OrderFormStorage = {
    clone,
    getConfig,
    isCloudMode,
    loadSettings,
    saveSettings,
    createOrder,
    listOrders,
    updateOrderStatus
  };
}());
