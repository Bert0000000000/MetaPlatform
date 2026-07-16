// git status / diff / log helper - writes output to .git-*.txt files
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const cwd = "D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform";
const out = "D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\tools\\.git-status.txt";

try {
  const status = execSync("git status --porcelain", { encoding: "utf8", cwd });
  writeFileSync(out, "=== git status --porcelain ===\n" + status, "utf8");
} catch (e) {
  writeFileSync(out, "ERR status: " + e.message, "utf8");
}
