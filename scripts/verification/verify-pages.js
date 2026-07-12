async function getToken() {
  const r = await fetch("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@metaplatform.com", password: "admin123" }),
  });
  return (await r.json()).data.token;
}

(async () => {
  const token = await getToken();
  const headers = { "Authorization": `Bearer ${token}` };

  const appsResp = await fetch("http://localhost:3001/api/apps?limit=10", { headers });
  const appsJson = await appsResp.json();
  const apps = Array.isArray(appsJson.data) ? appsJson.data : (appsJson.data?.apps || []);

  // 跳过 Demo, 看新创建的 4 个
  const newApps = apps.filter(a => a.description === "由 SuperAI 创建").slice(0, 4);

  for (const app of newApps) {
    console.log(`\n📦 ${app.name} (id=${app.id})`);
    const modResp = await fetch(`http://localhost:3001/api/apps/${app.id}/modules`, { headers });
    const modData = await modResp.json();
    const modules = modData.data || [];

    // 查询所有 page
    const pagesResp = await fetch(`http://localhost:3001/api/apps/${app.id}/pages`, { headers });
    const allPages = (await pagesResp.json()).data || [];

    for (const m of modules) {
      const pageIds = m.pageIds || [];
      if (pageIds.length > 0) {
        const pages = pageIds.map(pid => allPages.find(p => p.id === pid)).filter(Boolean);
        console.log(`  📁 ${m.label}: ${pageIds.length} 个页面`);
        for (const p of pages) {
          console.log(`     ✓ ${p.name} (type=${p.type})`);
        }
      } else {
        console.log(`  📁 ${m.label}: (空)`);
      }
    }
  }
})();