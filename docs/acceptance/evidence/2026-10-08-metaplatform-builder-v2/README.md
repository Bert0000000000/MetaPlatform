# Builder V2 安全证据

日期：2026-10-09（Asia/Shanghai）；稳定实施 source `f892895200d57312fbb753866271d82f4d52af83`，限定最终修复复审规格/质量 Approved、两 P2 关闭，控制器已确认。这里仅跟踪严格 allowlist 的结果/版本/截图，详细说明见 [验收文档](../../2026-10-08-metaplatform-builder-v2.md)。**当前未完成全部最终 gates。**

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
| `public-preflight.json` | 公共复现入口实际f892 preflight exit2：owned-container inspection不可用，guard拒绝；未到达DB或gate，先前PG绿色不替代此入口成功 |

当前 core9/migration2/Builder21 成功执行、52 个内容 ready 截图与窄屏工具条实际交互证据待控制器健康栈/最终运行后补入；当前登录504，未重复失败登录或生成旧图填充。不得复制 raw JUnit diagnostics、error-context、compose、private-config、environment、tokens、auth-state、HAR/trace/video 或完整原始日志。Failed attempts 在忽略私有区保留，公共投影仅包含 source、测试身份/数量、状态、指纹与已核实原因边界。证据提交与 implementation source 分离。
