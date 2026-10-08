# Builder V2 安全证据

日期：2026-10-09（Asia/Shanghai）；稳定实施 source `f892895200d57312fbb753866271d82f4d52af83`，限定最终修复复审规格/质量 Approved、两 P2 关闭，控制器已确认。这里仅跟踪严格 allowlist 的结果/版本/截图，详细说明见 [验收文档](../../2026-10-08-metaplatform-builder-v2.md)。**当前本地 gates/视觉交互、最终限定复审与运行交接均已完成。**

| 文件 | 来源与含义 |
|---|---|
| `unit.json` | 控制器实际 f892 full-unit 回执；240/240、零 fail/error/skip、701 source hashes 前后一致 |
| `typecheck.json`、`build.json` | 控制器实际 f892 检查，各 exit 0、701 source hashes 前后一致 |
| `unit-8df5ba95.json`、`typecheck-8df5ba95.json`、`build-8df5ba95.json` | 保留先前 233/233 与旧源检查，仅历史证据 |
| `toolchain.json` | 2026-10-09 在当前 implementation source 重新采集版本/工作区锁 SHA256；不代表 test pass |
| `postgres-latest-failed.json`、`postgres-failed-01.json`、`postgres-failed-02.json`、`postgres-failed-03.json` | 保留控制器绿色之前的失败安全投影（含122/123与setup/legacy断言失败）；不替代最终运行 |
| `postgres.json` | 控制器实际158完整原六组回执；123/123、零fail/error/skip；同一独立DB/非特权角色，无过滤/历史替代 |
| `contracts.json` | 控制器实际158 JUnit7/7安全投影与其确认的validate exit0；未被本证据Agent重跑 |
| `source-applicability.json` | 只读 `158..f892` backend/gate/contract 不变与当前1419文件hash证明；PG/contract记录保留真正执行源，不伪称f892重跑 |
| `core-latest-failed.json` | 实际158 beforeAll登录504后1failure/8未运行的安全投影；不是通过或当前f892实际运行 |
| `core-collection.json`、`migration-collection.json`、`builder-collection.json` | 实际f892安全采集9/2/21身份，exit0/701sourcehash不变；仅采集，不是成功执行 |
| `review.json` | 整分支首审+唯一最终限定复审的安全摘要；两P2关闭，规格/质量Approved；运行条件仍保留 |
| `public-preflight.json`、`public-preflight-failed-01.json` | 当前实际 preflight exit0、owned PG16/四非特权标志；旧ownership inspect不可用exit2失败另保留 |

当前原core9/原migration2/完整Builder21均真实通过，52个named-ready只读视图均已像素检查；后续第6次完整窄屏原生交互1/1 exit0；前五次失败/分项proof保留。不得复制 raw JUnit diagnostics、error-context、compose、private-config、environment、tokens、auth-state、HAR/trace/video 或完整原始日志。Failed attempts 在忽略私有区保留，公共投影仅包含 source、测试身份/数量、状态、指纹与已核实原因边界。证据提交与 implementation source 分离。

| 新增文件 | 来源与含义 |
|---|---|
| `public-core.json`、`public-migration.json` | 实际公共入口9/2 exit0，2220源hash不变；严格原身份/零skip |
| `public-migration-failed-01.json` | 原2/2成功但旧public parser漏suite导致exit1；保留失败，不冒称公共成功 |
| `builder.json` | 当前原runner21/21与canonical精确21身份audit0；701源hash不变 |
| `parser-red.json`、`parser-green.json`、`plan-guard.json` | actual已执行9/2的只读解析验证及唯一accepted plan checkbox-only守卫；不等于重跑gate |
| `ont-viewports.json`、`platform-viewports.json` | 真UserInfo/签名tenant、每帧settings/theme/named-ready/error/API/overflow/no-write metadata；平台替身明确 |
| `screenshot-manifest.json`、`screenshots/` | 52最终只读图、原Builder32（height1000）、失败8图，SHA256逐文件；原32无制造的逐帧metadata |
| `builder-gate-image-inventory.json` | 原32PNG的实际尺寸/指纹，原路径与来源 |
| `visual-inspection.json` | 实际52像素检视，逐页/尺寸观察与窄屏局部裁切限制 |
| `narrow-interaction.json` | 六次探针事实；第5次整次exit1/真实partial和第6次完整1/1 exit0分开，不把probe时序当产品bug |

只复制明确PNG/安全JSON allowlist。原private helpers/日志/失败XML保持ignored。证据包已提交 `b3456cd8`、`f9b52bb6`；Task6本地门禁、视觉交互、限定复审及控制器运行保留/交接已完成。临时SDD删除被自动审批审查以 `blocked by policy` 拒绝，原目录与固定目录副本保留；未重试删除，不影响本地原型完成，不声明CI/部署/业务验收。

| 补证文件 | 来源与含义 |
|---|---|
| `narrow-interaction-pre-attempt6.json` | b345时未完成交互原快照，保留历史 |
| `narrow-attempt-05.json`、`narrow-*-attempt-05.json` | 整次真实exit1及已完成分项；gov过渡前宽度测量失败，不改判 |
| `narrow-attempt-06.json`、`narrow-*-attempt-06.json`、`narrow-completion.json` | 当前完整native1/1 exit0，实际模式/按钮恢复、type尾Tab/trial、query/explore/gov折叠与控件trial/恢复 |
| `narrow-source-verification.json` | probe后生产diff为空、当前2220源hash匹配实际core回执；不是重跑heavygate |
| `current-ui-login.json` | 控制器独立CUA真实UIlogin/settings匹配和继承reload/profile/copilot边界；无token/个人ID/roleclaim |
| `screenshots/narrow-attempt-05/`、`screenshots/narrow-attempt-06/` | 原failed05四图、成功06五图（四种view，query/explore同实际路径各留）；原52/32/failed8均不替换 |
| `task6-final-review.json` | b345..f9唯一限定证据复审，规格/质量Approved、0Critical/Important/Minor，原P3关闭 |
| `runtime-retention.json` | 543份运行资料复制与回读、15助手路径/语法检查、原四服务保留；临时目录删除被policy拒绝，原目录和固定目录副本均保留 |
