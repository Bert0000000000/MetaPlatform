// verify-db.js — 通过 API 验证最新创建的应用
async function getToken() {
  const r = await fetch("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@metaplatform.com", password: "admin123" }),
  });
  const d = await r.json();
  return d.data.token;
}

(async () => {
  const token = await getToken();
  const headers = { "Authorization": `Bearer ${token}` };

  // 1. 列出最新应用
  const appsResp = await fetch("http://localhost:3001/api/apps?limit=5", { headers });
  const appsData = await appsResp.json();
  const apps = appsData.data?.apps || appsData.data || [];
  const latest5 = apps.slice(0, 5);

  console.log("📱 最新 5 个应用:\n");
  for (const app of latest5) {
    console.log(`  📦 ${app.name} (${app.id})`);
    console.log(`     创建时间: ${app.created_at}`);
    console.log(`     描述: ${app.description}`);

    // 2. 该应用下的模块
    const modResp = await fetch(`http://localhost:3001/api/apps/${app.id}/modules`, { headers });
    const modData = await modResp.json();
    const modules = modData.data || [];

    console.log(`     📦 模块 (${modules.length} 个):`);
    for (const m of modules) {
      const pageIds = m.page_ids ? JSON.parse(m.page_ids) : [];
      console.log(`        ${m.label} [${pageIds.length} 个页面]`);
      for (const pid of pageIds) {
        const pResp = await fetch(`http://localhost:3001/api/apps/${app.id}/pages/${pid}`, { headers });
        const pData = await pResp.json();
        const p = pData.data;
        if (p) console.log(`           - ${p.name} (${p.type})`);
      }
    }
    console.log("");
  }
})();