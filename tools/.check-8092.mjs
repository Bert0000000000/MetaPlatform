// v1.0.2 debug: check 8092 /api/apps response
const fs = require("node:fs");
const path = "D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\tools\\.check-8092-result.txt";

async function check(url) {
  try {
    const res = await fetch(url, { headers: { Authorization: "Bearer dev" } });
    const ct = res.headers.get("content-type");
    const text = await res.text();
    const preview = text.slice(0, 500);
    return `URL=${url}\nSTATUS=${res.status}\nCT=${ct}\nLEN=${text.length}\nBODY=${preview}\n---\n`;
  } catch (err) {
    return `URL=${url}\nERROR=${err.message}\n---\n`;
  }
}

(async () => {
  let out = "";
  out += await check("http://127.0.0.1:8092/api/apps");
  out += await check("http://127.0.0.1:3001/api/apps");
  out += await check("http://127.0.0.1:5173/api/apps");
  fs.writeFileSync(path, out, "utf8");
  console.log("WROTE");
})();