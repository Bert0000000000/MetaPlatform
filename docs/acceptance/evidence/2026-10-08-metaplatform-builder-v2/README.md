# Builder V2 安全证据

日期：2026-10-09（Asia/Shanghai）；最后审查的实施 source `8df5ba95b3b07bd2721a16ddbdc9f7b75681ff00`。这里仅跟踪严格 allowlist 的结果/版本/截图，详细说明见 [验收文档](../../2026-10-08-metaplatform-builder-v2.md)。**当前未完成全部最终 gates。**

| 文件 | 来源与含义 |
|---|---|
| `unit.json` | 控制器实际当前源 full-unit 回执；233/233、零 fail/error/skip、699 source hashes 前后一致 |
| `typecheck.json`、`build.json` | 控制器实际当前源检查，各 exit 0、699 source hashes 前后一致 |
| `toolchain.json` | 2026-10-09 在当前 implementation source 重新采集版本/工作区锁 SHA256；不代表 test pass |
| `postgres-latest-failed.json` | 控制器最近失败尝试的严格安全投影，source `eb2eeacd`，123/122/1 setup error/0skip；不替代最终运行 |

其余 gate、52 个内容 ready 截图与窄屏工具条实际交互证据待控制器健康栈/最终运行后补入。不得复制 raw JUnit diagnostics、error-context、compose、private-config、environment、tokens、auth-state、HAR/trace/video 或完整原始日志。Failed attempts 在忽略私有区保留，公共投影仅包含 source、测试身份/数量、状态、指纹与已核实原因边界。证据提交与 implementation source 分离。
