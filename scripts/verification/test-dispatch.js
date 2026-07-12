// test-dispatch.js — 测试新的 agent 建应用逻辑 (登录 + 测试)
async function getToken() {
  const r = await fetch("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@metaplatform.com", password: "admin123" }),
  });
  const d = await r.json();
  return d.data.token;
}

const messages = [
  "帮我建一个请假审批应用",
  "创建一个采购管理表单应用",
  "建一个销售业绩报表",
  "新建客户拜访记录流程",
  "创建一个差旅报销列表",
];

async function test(token, message) {
  console.log("============================================================");
  console.log("USER:", message);
  console.log("============================================================");

  const r = await fetch("http://localhost:3001/api/dispatch/dispatch", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ message }),
  });

  const resp = await r.json();
  console.log("Status:", r.status);
  console.log("Type:", resp.data.type);
  console.log("Agents:", resp.data.agents?.map(a => a.id).join(", ") || "(none)");
  console.log("\nResponse:");
  console.log(resp.data.response || resp.data.data?.response || JSON.stringify(resp.data));

  const r0 = resp.data.data?.results?.[0];
  if (r0?.layout === "module-by-category") {
    console.log("\n📦 Modules created (" + r0.modulesCount + "):");
    r0.modules.forEach(m => console.log("   - " + m));
    console.log("\n🎯 Primary page:", r0.primaryPage.pageName, "→", r0.primaryPage.moduleLabel);
    r0.extraPages?.forEach(p => console.log("   + " + p.pageName, "→", p.moduleLabel));
  }
  console.log();
}

(async () => {
  const token = await getToken();
  console.log("Token:", token.substring(0, 30) + "...\n");
  for (const msg of messages) {
    await test(token, msg);
  }
})();