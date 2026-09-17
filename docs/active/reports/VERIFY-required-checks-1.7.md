# 临时验证：只改文档的 PR 不该被 required check 卡死（1.7 任务 3）

这个文件是**一次性的验证夹具**，不属于任何交付。用途：证明 `main` 的 required
check 在没有 `paths:` 过滤之后，**只改文档的 PR 也会触发 `python-ci.yml`**，
四个 required check 都会上报并变绿，PR 因此可以合——而不是永远停在
"Expected — Waiting for status to be reported"。

验证完就关 PR、删分支，不合并。
