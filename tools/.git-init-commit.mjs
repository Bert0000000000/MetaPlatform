// git init + initial commit (Trae sandbox: write logs to .git-init.log)
import { execSync } from "node:child_process";
import { writeFileSync, appendFileSync, existsSync } from "node:fs";

const cwd = "D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform";
const log = "D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\tools\\.git-init.log";

const lines = [];
const run = (cmd) => {
  try {
    const out = execSync(cmd, { encoding: "utf8", cwd, stdio: "pipe" });
    lines.push(`$ ${cmd}\n${out}`);
  } catch (e) {
    lines.push(`$ ${cmd}\nERR: ${e.message}\n${e.stdout || ""}\n${e.stderr || ""}`);
  }
};

run("git --version");
run("git rev-parse --is-inside-work-tree");
run("git rev-parse --show-toplevel");

if (!existsSync(`${cwd}\\.git`)) {
  run("git init -b main");
  run("git config user.email claude@metaplatform.local");
  run("git config user.name \"Claude (Trae IDE)\"");
}

writeFileSync(log, lines.join("\n\n") + "\n", "utf8");
