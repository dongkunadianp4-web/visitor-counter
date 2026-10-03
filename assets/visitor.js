(() => {
  const api = (window.APP_CONFIG?.API_BASE || "").replace(/\/$/, "");
  const KEY = "visitor_id_v1";

  if (!api || api.includes("YOUR-WORKER")) {
    console.warn("API_BASEを設定してください。");
    return;
  }

  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }

  fetch(`${api}/api/visit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId: id }),
    credentials: "include"
  }).catch(() => {});
})();
