// git log helper
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
try {
  const out = execSync(
    `git log --oneline -20 -- metaplatform-frontend/src/pages/apps/Pages.tsx`,
    { encoding: "utf8", cwd: "D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform" }
  );
  writeFileSync(
    "D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\tools\\.gitlog-out.txt",
    out,
    "utf8"
  );
  console.log("WROTE " + out.length);
} catch (e) {
  writeFileSync(
    "D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\tools\\.gitlog-out.txt",
    "ERR: " + e.message,
    "utf8"
  );
  console.log("ERR " + e.message.length);
}