(() => {
  const api = (window.APP_CONFIG?.API_BASE || "").replace(/\/$/, "");
  const tokenKey = "admin_token_v1";

  const loginBox = document.getElementById("loginBox");
  const dashboard = document.getElementById("dashboard");
  const loginForm = document.getElementById("loginForm");
  const loginMessage = document.getElementById("loginMessage");
  const dashboardMessage = document.getElementById("dashboardMessage");
  const currentCount = document.getElementById("currentCount");
  const totalCount = document.getElementById("totalCount");

  function token() { return sessionStorage.getItem(tokenKey); }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const res = await fetch(`${api}${path}`, { ...options, headers, credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function loadStats() {
    dashboardMessage.textContent = "";
    try {
      const data = await request("/api/stats");
      currentCount.textContent = data.current;
      totalCount.textContent = data.total;
    } catch (e) {
      dashboardMessage.textContent = e.message;
      if (/401|403/.test(e.message)) showLogin();
    }
  }

  function showLogin() {
    loginBox.classList.remove("hidden");
    dashboard.classList.add("hidden");
    sessionStorage.removeItem(tokenKey);
  }

  function showDashboard() {
    loginBox.classList.add("hidden");
    dashboard.classList.remove("hidden");
    loadStats();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginMessage.textContent = "";
    try {
      const data = await request("/api/login", {
        method: "POST",
        body: JSON.stringify({ password: document.getElementById("password").value })
      });
      sessionStorage.setItem(tokenKey, data.token);
      document.getElementById("password").value = "";
      showDashboard();
    } catch (e) {
      loginMessage.textContent = "ログインできませんでした。";
    }
  });

  document.getElementById("refresh").addEventListener("click", loadStats);

  document.getElementById("manualIn").addEventListener("click", async () => {
    try { await request("/api/manual", { method: "POST", body: JSON.stringify({ delta: 1 }) }); await loadStats(); }
    catch (e) { dashboardMessage.textContent = e.message; }
  });

  document.getElementById("manualOut").addEventListener("click", async () => {
    try { await request("/api/manual", { method: "POST", body: JSON.stringify({ delta: -1 }) }); await loadStats(); }
    catch (e) { dashboardMessage.textContent = e.message; }
  });

  document.getElementById("logout").addEventListener("click", showLogin);

  if (api && !api.includes("YOUR-WORKER") && token()) showDashboard();
  else showLogin();
})();
