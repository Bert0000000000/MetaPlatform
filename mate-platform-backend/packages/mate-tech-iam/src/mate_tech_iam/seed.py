"""Seed data for TECH-IAM. Idempotent: re-running won't duplicate rows."""
from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .domain.audit import AuditAction, AuditLog
from .domain.login_log import LoginLog, LoginResult
from .domain.org import EmployeePosition, Org, OrgType, Position
from .domain.permission import Permission, RolePermission
from .domain.role import Role, UserRole
from .domain.system_config import ConfigCategory, SystemConfig
from .domain.user import User, UserStatus
from .services.security import hash_password

logger = structlog.get_logger(__name__)


PERMISSION_SEED: list[dict[str, object]] = [
    # user
    {"code": "user:view", "name": "查看用户", "resource_type": "user", "actions": "read"},
    {"code": "user:create", "name": "创建用户", "resource_type": "user", "actions": "create"},
    {"code": "user:update", "name": "更新用户", "resource_type": "user", "actions": "update"},
    {"code": "user:delete", "name": "删除用户", "resource_type": "user", "actions": "delete"},
    {"code": "user:reset_password", "name": "重置密码", "resource_type": "user", "actions": "reset"},
    {"code": "user:enable", "name": "启停用户", "resource_type": "user", "actions": "enable"},
    {"code": "user:import", "name": "批量导入", "resource_type": "user", "actions": "import"},
    # role / permission
    {"code": "role:view", "name": "查看角色", "resource_type": "role", "actions": "read"},
    {"code": "role:create", "name": "创建角色", "resource_type": "role", "actions": "create"},
    {"code": "role:update", "name": "更新角色", "resource_type": "role", "actions": "update"},
    {"code": "role:delete", "name": "删除角色", "resource_type": "role", "actions": "delete"},
    {"code": "role:assign", "name": "分配角色/权限", "resource_type": "role", "actions": "assign"},
    # org
    {"code": "org:view", "name": "查看组织", "resource_type": "org", "actions": "read"},
    {"code": "org:create", "name": "创建组织", "resource_type": "org", "actions": "create"},
    {"code": "org:update", "name": "更新组织", "resource_type": "org", "actions": "update"},
    {"code": "org:delete", "name": "删除组织", "resource_type": "org", "actions": "delete"},
    {"code": "org:transfer", "name": "人员调岗", "resource_type": "org", "actions": "transfer"},
    # log
    {"code": "log:view", "name": "查看审计日志", "resource_type": "log", "actions": "read"},
    {"code": "log:export", "name": "导出审计日志", "resource_type": "log", "actions": "export"},
    # config
    {"code": "config:view", "name": "查看系统配置", "resource_type": "config", "actions": "read"},
    {"code": "config:update", "name": "修改系统配置", "resource_type": "config", "actions": "update"},
    # operations
    {"code": "ops:view", "name": "查看运维监控", "resource_type": "ops", "actions": "read"},
]


ROLE_SEED: list[dict[str, object]] = [
    {
        "code": "PLATFORM_SUPER_ADMIN",
        "name": "超级管理员",
        "description": "拥有全部后台管理权限",
        "data_scope": "ALL",
        "permission_codes": [p["code"] for p in PERMISSION_SEED],
    },
    {
        "code": "PLATFORM_ADMIN",
        "name": "平台管理员",
        "description": "日常运维管理（不含删除用户/角色）",
        "data_scope": "ALL",
        "permission_codes": [
            "user:view", "user:create", "user:update", "user:reset_password",
            "user:enable", "user:import",
            "role:view", "role:create", "role:update", "role:assign",
            "org:view", "org:create", "org:update", "org:transfer",
            "log:view", "log:export",
            "config:view", "config:update",
            "ops:view",
        ],
    },
    {
        "code": "PLATFORM_ADMIN_VIEWER",
        "name": "只读管理员",
        "description": "仅查看权限",
        "data_scope": "ALL",
        "permission_codes": [
            "user:view", "role:view", "org:view", "log:view", "config:view", "ops:view",
        ],
    },
]


CONFIG_SEED: list[dict[str, object]] = [
    {
        "key": "sso.oidc.issuer",
        "value": "https://idp.example.com/realms/metaplatform",
        "value_type": "string",
        "category": ConfigCategory.SSO,
        "label": "OIDC Issuer",
        "description": "OIDC SSO 提供方 Issuer URL",
    },
    {
        "key": "sso.oidc.client_id",
        "value": "metaplatform-frontend",
        "value_type": "string",
        "category": ConfigCategory.SSO,
        "label": "OIDC Client ID",
    },
    {
        "key": "sso.oidc.enabled",
        "value": "true",
        "value_type": "bool",
        "category": ConfigCategory.SSO,
        "label": "启用 SSO",
    },
    {
        "key": "license.expire_at",
        "value": (datetime.now(UTC) + timedelta(days=365)).date().isoformat(),
        "value_type": "string",
        "category": ConfigCategory.LICENSE,
        "label": "License 到期时间",
    },
    {
        "key": "license.max_seats",
        "value": "500",
        "value_type": "int",
        "category": ConfigCategory.LICENSE,
        "label": "最大席位数",
    },
    {
        "key": "message.email.smtp_host",
        "value": "smtp.example.com",
        "value_type": "string",
        "category": ConfigCategory.MESSAGE,
        "label": "SMTP 主机",
    },
    {
        "key": "message.email.smtp_user",
        "value": "noreply@metaplatform.com",
        "value_type": "string",
        "category": ConfigCategory.MESSAGE,
        "label": "SMTP 用户名",
    },
    {
        "key": "message.email.smtp_password",
        "value": "********",
        "value_type": "string",
        "category": ConfigCategory.MESSAGE,
        "label": "SMTP 密码",
        "is_sensitive": True,
    },
    {
        "key": "message.sms.provider",
        "value": "aliyun",
        "value_type": "enum",
        "enum_options": "aliyun,tencent,disabled",
        "category": ConfigCategory.MESSAGE,
        "label": "短信服务",
    },
    {
        "key": "rate_limit.api_per_minute",
        "value": "600",
        "value_type": "int",
        "category": ConfigCategory.RATE_LIMIT,
        "label": "API 全局限流 (次/分钟)",
    },
    {
        "key": "rate_limit.login_max_per_hour",
        "value": "20",
        "value_type": "int",
        "category": ConfigCategory.RATE_LIMIT,
        "label": "登录失败上限 (次/小时)",
    },
    {
        "key": "security.password_min_length",
        "value": "8",
        "value_type": "int",
        "category": ConfigCategory.SECURITY,
        "label": "密码最小长度",
    },
    {
        "key": "security.session_timeout_minutes",
        "value": "60",
        "value_type": "int",
        "category": ConfigCategory.SECURITY,
        "label": "会话超时 (分钟)",
    },
    {
        "key": "security.mfa_required",
        "value": "false",
        "value_type": "bool",
        "category": ConfigCategory.SECURITY,
        "label": "强制 MFA",
    },
    {
        "key": "branding.platform_name",
        "value": "MetaPlatform",
        "value_type": "string",
        "category": ConfigCategory.BRANDING,
        "label": "平台名称",
    },
    {
        "key": "branding.copyright",
        "value": "© 2026 MetaPlatform",
        "value_type": "string",
        "category": ConfigCategory.BRANDING,
        "label": "页脚版权",
    },
]


async def seed(session: AsyncSession, tenant_id: str = "tenant-default") -> None:
    """Seed minimal demo data. Idempotent."""
    # --- permissions ---
    existing_perms = {
        p.code: p for p in (
            await session.execute(select(Permission).where(Permission.tenant_id == tenant_id))
        ).scalars().all()
    }
    perm_by_code: dict[str, Permission] = {}
    for spec in PERMISSION_SEED:
        code = spec["code"]
        if code in existing_perms:
            perm_by_code[code] = existing_perms[code]
            continue
        p = Permission(
            tenant_id=tenant_id,
            code=code,
            name=spec["name"],
            resource_type=spec["resource_type"],
            actions=spec["actions"],
            description=spec.get("description"),
        )
        session.add(p)
        await session.flush()
        perm_by_code[code] = p

    # --- roles ---
    existing_roles = {
        r.code: r for r in (
            await session.execute(select(Role).where(Role.tenant_id == tenant_id))
        ).scalars().all()
    }
    for spec in ROLE_SEED:
        code = spec["code"]
        role = existing_roles.get(code)
        if not role:
            role = Role(
                tenant_id=tenant_id,
                code=code,
                name=spec["name"],
                description=spec.get("description"),
                data_scope=spec["data_scope"],
                is_builtin=True,
            )
            session.add(role)
            await session.flush()
            existing_roles[code] = role
        # rebind permissions
        await session.execute(
            RolePermission.__table__.delete().where(RolePermission.role_id == role.id)
        )
        for pcode in spec.get("permission_codes", []):
            perm = perm_by_code.get(pcode)
            if perm and perm.id is not None:
                session.add(RolePermission(role_id=role.id, permission_id=perm.id, effect="ALLOW"))

    # --- demo users ---
    existing_users = {
        u.username: u for u in (
            await session.execute(select(User).where(User.tenant_id == tenant_id))
        ).scalars().all()
    }
    demo_users = [
        {
            "username": "admin",
            "real_name": "系统管理员",
            "email": "admin@meta.com",
            "phone": "13800000000",
            "department": "平台工程部",
            "position": "高级工程师",
            "is_super_admin": True,
            "status": UserStatus.ACTIVE,
            "password": "admin123",
            "roles": ["PLATFORM_SUPER_ADMIN"],
        },
        {
            "username": "operator",
            "real_name": "运营管理员",
            "email": "operator@meta.com",
            "phone": "13800000001",
            "department": "运营部",
            "position": "运营经理",
            "is_super_admin": False,
            "status": UserStatus.ACTIVE,
            "password": "operator123",
            "roles": ["PLATFORM_ADMIN"],
        },
        {
            "username": "auditor",
            "real_name": "审计员",
            "email": "auditor@meta.com",
            "phone": "13800000002",
            "department": "审计部",
            "position": "审计专员",
            "is_super_admin": False,
            "status": UserStatus.ACTIVE,
            "password": "auditor123",
            "roles": ["PLATFORM_ADMIN_VIEWER"],
        },
        {
            "username": "zhangsan",
            "real_name": "张三",
            "email": "zhangsan@meta.com",
            "phone": "13800000003",
            "department": "技术部",
            "position": "高级工程师",
            "is_super_admin": False,
            "status": UserStatus.ACTIVE,
            "password": "demo1234",
            "roles": ["PLATFORM_ADMIN"],
        },
        {
            "username": "lisi",
            "real_name": "李四",
            "email": "lisi@meta.com",
            "phone": "13800000004",
            "department": "产品部",
            "position": "产品经理",
            "is_super_admin": False,
            "status": UserStatus.ACTIVE,
            "password": "demo1234",
            "roles": ["PLATFORM_ADMIN_VIEWER"],
        },
        {
            "username": "wangwu",
            "real_name": "王五",
            "email": "wangwu@meta.com",
            "phone": "13800000005",
            "department": "技术部",
            "position": "工程师",
            "is_super_admin": False,
            "status": UserStatus.INACTIVE,
            "password": "demo1234",
            "roles": ["PLATFORM_ADMIN_VIEWER"],
        },
        {
            "username": "zhaoliu",
            "real_name": "赵六",
            "email": "zhaoliu@meta.com",
            "phone": "13800000006",
            "department": "财务部",
            "position": "财务总监",
            "is_super_admin": False,
            "status": UserStatus.LOCKED,
            "password": "demo1234",
            "roles": ["PLATFORM_ADMIN_VIEWER"],
        },
        {
            "username": "sunqi",
            "real_name": "孙七",
            "email": "sunqi@meta.com",
            "phone": "13800000007",
            "department": "技术部",
            "position": "架构师",
            "is_super_admin": False,
            "status": UserStatus.ACTIVE,
            "password": "demo1234",
            "roles": ["PLATFORM_ADMIN"],
        },
        {
            "username": "zhouba",
            "real_name": "周八",
            "email": "zhouba@meta.com",
            "phone": "13800000008",
            "department": "技术部",
            "position": "前端工程师",
            "is_super_admin": False,
            "status": UserStatus.ACTIVE,
            "password": "demo1234",
            "roles": ["PLATFORM_ADMIN_VIEWER"],
        },
        {
            "username": "wujiu",
            "real_name": "吴九",
            "email": "wujiu@meta.com",
            "phone": "13800000009",
            "department": "人事部",
            "position": "HR 经理",
            "is_super_admin": False,
            "status": UserStatus.ACTIVE,
            "password": "demo1234",
            "roles": ["PLATFORM_ADMIN_VIEWER"],
        },
    ]

    role_by_code = existing_roles
    for spec in demo_users:
        user = existing_users.get(spec["username"])
        if not user:
            user = User(
                tenant_id=tenant_id,
                username=spec["username"],
                real_name=spec["real_name"],
                email=spec["email"],
                phone=spec["phone"],
                department=spec["department"],
                position=spec["position"],
                is_super_admin=spec["is_super_admin"],
                status=spec["status"],
                password_hash=hash_password(spec["password"]),
            )
            session.add(user)
            await session.flush()
            existing_users[spec["username"]] = user

        # bind roles (idempotent: clear then add)
        await session.execute(
            UserRole.__table__.delete().where(UserRole.user_id == user.id)
        )
        for rcode in spec["roles"]:
            role = role_by_code.get(rcode)
            if role and role.id is not None:
                session.add(UserRole(user_id=user.id, role_id=role.id))

    # --- orgs ---
    existing_orgs = {
        o.code: o for o in (
            await session.execute(select(Org).where(Org.tenant_id == tenant_id))
        ).scalars().all()
    }
    org_specs = [
        {"code": "ROOT", "name": "MetaPlatform 总部", "type": OrgType.COMPANY, "parent_id": None, "sort_order": 0},
        {"code": "TECH", "name": "技术中心", "type": OrgType.DEPARTMENT, "parent_id": "ROOT", "sort_order": 1},
        {"code": "OPS", "name": "运营中心", "type": OrgType.DEPARTMENT, "parent_id": "ROOT", "sort_order": 2},
        {"code": "PRODUCT", "name": "产品部", "type": OrgType.DEPARTMENT, "parent_id": "ROOT", "sort_order": 3},
        {"code": "TECH_PLAT", "name": "平台工程部", "type": OrgType.TEAM, "parent_id": "TECH", "sort_order": 0},
        {"code": "TECH_AI", "name": "AI 算法部", "type": OrgType.TEAM, "parent_id": "TECH", "sort_order": 1},
        {"code": "TECH_FE", "name": "前端体验部", "type": OrgType.TEAM, "parent_id": "TECH", "sort_order": 2},
    ]
    org_by_code: dict[str, Org] = dict(existing_orgs)
    for spec in org_specs:
        code = spec["code"]
        if code in org_by_code:
            continue
        parent = None
        if isinstance(spec["parent_id"], str):
            parent = org_by_code.get(spec["parent_id"])
        org = Org(
            tenant_id=tenant_id,
            parent_id=parent.id if parent else None,
            code=code,
            name=spec["name"],
            type=spec["type"],
            sort_order=spec["sort_order"],
        )
        session.add(org)
        await session.flush()
        org_by_code[code] = org

    # --- positions ---
    existing_positions = {
        p.code: p for p in (
            await session.execute(select(Position).where(Position.tenant_id == tenant_id))
        ).scalars().all()
    }
    pos_specs = [
        {"code": "TECH_LEAD", "org_code": "TECH", "name": "技术总监", "level": "M3"},
        {"code": "TECH_PLAT_LEAD", "org_code": "TECH_PLAT", "name": "平台架构师", "level": "P9"},
        {"code": "TECH_PLAT_DEV", "org_code": "TECH_PLAT", "name": "高级工程师", "level": "P7"},
        {"code": "TECH_AI_LEAD", "org_code": "TECH_AI", "name": "AI 负责人", "level": "P9"},
        {"code": "TECH_FE_LEAD", "org_code": "TECH_FE", "name": "前端 Leader", "level": "P8"},
        {"code": "PRODUCT_MGR", "org_code": "PRODUCT", "name": "产品经理", "level": "P6"},
        {"code": "OPS_MGR", "org_code": "OPS", "name": "运营经理", "level": "M2"},
    ]
    pos_by_code: dict[str, Position] = dict(existing_positions)
    for spec in pos_specs:
        code = spec["code"]
        if code in pos_by_code:
            continue
        org = org_by_code.get(spec["org_code"])
        if not org or org.id is None:
            continue
        pos = Position(
            tenant_id=tenant_id,
            org_id=org.id,
            code=code,
            name=spec["name"],
            level=spec["level"],
        )
        session.add(pos)
        await session.flush()
        pos_by_code[code] = pos

    # --- demo employee-position bindings ---
    admin_user = existing_users.get("admin")
    operator_user = existing_users.get("operator")
    tech_lead = pos_by_code.get("TECH_LEAD")
    ops_mgr = pos_by_code.get("OPS_MGR")
    plat_dev = pos_by_code.get("TECH_PLAT_DEV")
    if admin_user and admin_user.id is not None and tech_lead and tech_lead.id is not None:
        existing_ep = (
            await session.execute(
                select(EmployeePosition).where(EmployeePosition.user_id == admin_user.id)
            )
        ).scalars().all()
        if not existing_ep:
            session.add(EmployeePosition(
                tenant_id=tenant_id,
                user_id=admin_user.id,
                position_id=tech_lead.id,
                reports_to=None,
                is_primary=True,
            ))
    if operator_user and operator_user.id is not None and ops_mgr and ops_mgr.id is not None:
        existing_ep = (
            await session.execute(
                select(EmployeePosition).where(EmployeePosition.user_id == operator_user.id)
            )
        ).scalars().all()
        if not existing_ep:
            session.add(EmployeePosition(
                tenant_id=tenant_id,
                user_id=operator_user.id,
                position_id=ops_mgr.id,
                reports_to=admin_user.id if admin_user else None,
                is_primary=True,
            ))
    zhangsan = existing_users.get("zhangsan")
    if zhangsan and zhangsan.id is not None and plat_dev and plat_dev.id is not None:
        existing_ep = (
            await session.execute(
                select(EmployeePosition).where(EmployeePosition.user_id == zhangsan.id)
            )
        ).scalars().all()
        if not existing_ep:
            session.add(EmployeePosition(
                tenant_id=tenant_id,
                user_id=zhangsan.id,
                position_id=plat_dev.id,
                reports_to=admin_user.id if admin_user else None,
                is_primary=True,
            ))

    # --- system configs ---
    existing_cfg = {
        c.key: c for c in (
            await session.execute(select(SystemConfig).where(SystemConfig.tenant_id == tenant_id))
        ).scalars().all()
    }
    for spec in CONFIG_SEED:
        key = spec["key"]
        if key in existing_cfg:
            continue
        cfg = SystemConfig(
            tenant_id=tenant_id,
            key=key,
            value=str(spec["value"]),
            value_type=spec["value_type"],
            category=spec["category"],
            label=spec.get("label"),
            description=spec.get("description"),
            enum_options=spec.get("enum_options"),
            is_sensitive=spec.get("is_sensitive", False),
        )
        session.add(cfg)

    # --- demo audit logs (only if empty) ---
    audit_count = (
        await session.execute(
            select(AuditLog).where(AuditLog.tenant_id == tenant_id).limit(1)
        )
    ).scalars().first()
    if not audit_count:
        now = datetime.now(UTC)
        admin_actor = {"actor_id": admin_user.username if admin_user else "system",
                       "actor_name": admin_user.real_name if admin_user else "系统"}
        seed_logs = [
            ("user", AuditAction.CREATE, "user", "zhangsan", "张三", "新建用户 zhangsan"),
            ("user", AuditAction.RESET_PASSWORD, "user", "lisi", "李四", "重置用户 lisi 密码"),
            ("role", AuditAction.CREATE, "role", "PLATFORM_ADMIN", "平台管理员", "创建角色 PLATFORM_ADMIN"),
            ("role", AuditAction.ASSIGN, "user", "zhangsan", "张三", "分配角色给 zhangsan"),
            ("org", AuditAction.UPDATE, "org", "TECH", "技术中心", "更新组织 技术中心"),
            ("config", AuditAction.CONFIG_CHANGE, "config", "rate_limit.api_per_minute", "API 全局限流",
             "修改配置 rate_limit.api_per_minute"),
            ("user", AuditAction.DISABLE, "user", "wangwu", "王五", "停用用户 wangwu"),
            ("user", AuditAction.LOGIN, "user", "admin", "系统管理员", "登录系统"),
        ]
        for i, (module, action, rtype, rid, rname, summary) in enumerate(seed_logs):
            session.add(AuditLog(
                tenant_id=tenant_id,
                actor_id=admin_actor["actor_id"],
                actor_name=admin_actor["actor_name"],
                module=module,
                action=action,
                resource_type=rtype,
                resource_id=rid,
                resource_name=rname,
                summary=summary,
                ip="127.0.0.1",
                user_agent="seed-script",
                occurred_at=now - timedelta(minutes=i * 13),
            ))

    # --- demo login logs ---
        for i in range(20):
            session.add(LoginLog(
                tenant_id=tenant_id,
                username=admin_actor["actor_id"] if i % 3 == 0 else "zhangsan",
                user_id=admin_user.id if i % 3 == 0 and admin_user else None,
                result=LoginResult.SUCCESS if i % 7 != 0 else LoginResult.FAILED,
                ip="127.0.0.1" if i % 2 == 0 else f"10.0.0.{i}",
                device="Chrome / Windows" if i % 2 == 0 else "Safari / macOS",
                location="Shanghai",
                failure_reason=None if i % 7 != 0 else "密码错误",
                occurred_at=now - timedelta(hours=i),
            ))

    await session.commit()
    logger.info("iam.seed.complete", tenant_id=tenant_id)
