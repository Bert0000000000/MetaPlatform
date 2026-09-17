"""迁移入口：把"建 schema / 策略 / 权限"从运行 Pod 里挪出来（B-4）。

**为什么必须有这一步**：``bootstrap`` 要动的是 DDL 与授权（建表、开 RLS、
建策略、GRANT），它**必须**用一个能建表、能授权的角色——也就是 admin。而在
B-4 之前，那个 admin DSN 是**运行 Pod 的环境变量**：任何能读这个 Pod 环境的人
（一次 SSRF、一次 `/proc/self/environ`、一次误配的日志）就拿到了整库的钥匙，
RLS 那道墙在它面前等于不存在。

所以拆成两个身份、两个进程：

```
迁移 Job（一次性，admin）      运行 Pod（长期，app 角色）
  CREATE SCHEMA / 表 / 策略      MATE_AGENT_TEAM_DSN        ← 受 RLS 约束
  GRANT mate_app …               MATE_AGENT_TEAM_CONTROL_DSN ← 只读检查点的控制面
  GRANT mate_control …（只读）    **没有** MATE_AGENT_TEAM_ADMIN_DSN
```

用法::

    python -m mate_tech_agent_team.migrate          # 幂等，可重复跑

它与 ``bootstrap`` 是同一个实现（没有第二套 DDL），所以**不会**出现
"Job 建的库"与"服务以为的库"不一致。
"""

from __future__ import annotations

import logging
import os
import sys

from .checkpoint import SCHEMA, bootstrap

logger = logging.getLogger("metaplatform.agent_team.migrate")

ADMIN_DSN_ENV = "MATE_AGENT_TEAM_ADMIN_DSN"
CONTROL_ROLE_ENV = "MATE_AGENT_TEAM_CONTROL_ROLE"
CONTROL_PASSWORD_ENV = "MATE_AGENT_TEAM_CONTROL_PASSWORD"
APP_ROLE_ENV = "MATE_AGENT_TEAM_APP_ROLE"

DEFAULT_APP_ROLE = "mate_app"
DEFAULT_CONTROL_ROLE = "mate_control"


def run_migration() -> None:
    """建 schema / 表 / RLS 策略 / 授权（幂等）。**必须**用 admin DSN。"""
    admin_dsn = os.getenv(ADMIN_DSN_ENV, "").strip()
    if not admin_dsn:
        raise SystemExit(
            f"{ADMIN_DSN_ENV} 未设置：迁移必须用能建表、能授权的角色。"
            "运行 Pod **不该**有它——见 mate_tech_agent_team.migrate 的模块注释。"
        )
    app_role = os.getenv(APP_ROLE_ENV, DEFAULT_APP_ROLE)
    control_role = os.getenv(CONTROL_ROLE_ENV, DEFAULT_CONTROL_ROLE)
    control_password = os.getenv(CONTROL_PASSWORD_ENV, "")
    bootstrap(
        admin_dsn,
        app_role=app_role,
        control_role=control_role,
        control_password=control_password,
    )
    logger.info(
        "migration.complete schema=%s app_role=%s control_role=%s",
        SCHEMA,
        app_role,
        control_role,
    )
    print(f"migration complete: schema={SCHEMA} app_role={app_role} control_role={control_role}")


if __name__ == "__main__":  # pragma: no cover - 入口脚本
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    try:
        run_migration()
    except Exception as exc:  # 迁移失败要**非零退出**，Job 才会红
        print(f"migration failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
