"""外部执行面的子进程环境：**白名单构造**，不是继承宿主。

**为什么单独成模块**：外部 CLI（Claude Code 等）是宿主上起的**子进程**。此前
``claude_code.py`` 用的是 ``env={**os.environ, **self._env}`` ——那等于把宿主进程的
DB DSN、Service Secret、Keycloak 配置原样交给一个跑模型生成的指令的执行面。
ADR-0040 的"按代码来源分层"于是只在**逻辑**上成立：进程隔离根本没做。

本模块是唯一的构造入口，A-4（近端 subprocess）与 B-8（K8s Job）共用同一套白名单
与同一条断言——"子进程 env 里看不到任何宿主凭据"。

**两条规则**

1. **默认什么都不继承**：只有 :data:`SAFE_ENV_ALLOWLIST` 里的名字（外加运维经
   ``MATE_AGENT_TEAM_RUNTIME_ENV_ALLOWLIST`` 显式追加的非敏感名字）会下放。
   白名单进、其余全出——不是"黑名单剔除"（漏一个就是漏一个凭据）。
2. **敏感名硬否决**：:func:`is_sensitive_name` 命中的名字**不能**经任何途径下放。
   显式 ``env=`` 里出现敏感名直接 ``ValueError``（配置错误要响，不要静默丢弃）。
   运维追加的白名单里出现敏感名同样报错。

**白名单里为什么有这些名字**：它们只描述"子进程怎么起得来"（PATH / 临时目录 /
locale / Windows 下 cmd.exe 与 node shim 必需的 SystemRoot、COMSPEC、USERPROFILE…），
不含任何凭据。**CLI 的登录态走它自己的凭据文件**（``~/.claude``），
不靠继承宿主 env——这正是本条要立住的性质。
"""

from __future__ import annotations

import os
from collections.abc import Iterable, Mapping

#: 下放给子进程的基础白名单。**大小写不敏感地匹配**（Windows 上 ``os.environ``
#: 的键一律大写，POSIX 上保持原样），命中后按宿主里的**原始键名**写回。
SAFE_ENV_ALLOWLIST: frozenset[str] = frozenset(
    {
        # 跨平台：可执行文件查找 + 临时目录 + locale
        "PATH",
        "HOME",
        "SHELL",
        "USER",
        "LOGNAME",
        "TERM",
        "TZ",
        "LANG",
        "LANGUAGE",
        "LC_ALL",
        "LC_CTYPE",
        "LC_MESSAGES",
        "TMPDIR",
        "TMP",
        "TEMP",
        # 子进程 stdout 的编码提示（**不含凭据**）。父进程按 utf-8 解码 CLI 回执，
        # 而 Python 子进程在 Windows 上的默认 stdout 编码是 ANSI 代码页 —— 不透传
        # 这个变量，中文回执会在解码时被打碎。POSIX 上同理由 LANG/LC_ALL 承担。
        "PYTHONIOENCODING",
        # Windows：cmd.exe / node shim 起得来所必需，且都不含凭据
        "SYSTEMROOT",
        "WINDIR",
        "SYSTEMDRIVE",
        "COMSPEC",
        "PATHEXT",
        "USERPROFILE",
        "HOMEDRIVE",
        "HOMEPATH",
        "APPDATA",
        "LOCALAPPDATA",
        "PROGRAMDATA",
        "PROGRAMFILES",
        "PROGRAMFILES(X86)",
        "PROGRAMW6432",
        "NUMBER_OF_PROCESSORS",
        "PROCESSOR_ARCHITECTURE",
    }
)

#: 敏感名的特征片段（按大写子串匹配）。命中即**硬否决**，任何白名单都救不回来。
SENSITIVE_MARKERS: tuple[str, ...] = (
    "DSN",
    "SECRET",
    "PASSWORD",
    "PASSWD",
    "TOKEN",
    "CREDENTIAL",
    "APIKEY",
    "API_KEY",
    "PRIVATE_KEY",
    "ACCESS_KEY",
    "KEYCLOAK",
)

#: 前缀命中的敏感族（密钥/口令类配置常以这些前缀成组出现）。
SENSITIVE_PREFIXES: tuple[str, ...] = ("SSH_",)

#: 运维显式追加白名单用的环境变量（逗号分隔）。**只能追加非敏感名**——
#: 例如 CLI 需要 ``ANTHROPIC_BASE_URL`` 时加它；``ANTHROPIC_API_KEY`` 一律不许。
ALLOWLIST_ENV = "MATE_AGENT_TEAM_RUNTIME_ENV_ALLOWLIST"


def is_sensitive_name(name: str) -> bool:
    """这个名字是不是凭据类？是则**不许**下放给任何外部执行面。"""
    upper = (name or "").strip().upper()
    if not upper:
        return False
    if any(upper.startswith(prefix) for prefix in SENSITIVE_PREFIXES):
        return True
    return any(marker in upper for marker in SENSITIVE_MARKERS)


def configured_allowlist(raw: str | None = None) -> frozenset[str]:
    """读运维追加的白名单（默认读 ``MATE_AGENT_TEAM_RUNTIME_ENV_ALLOWLIST``）。

    写进来的名字若命中 :func:`is_sensitive_name` → ``ValueError``。这是**启动期
    就该响的配置错误**，不是"看不懂就当没配"——后者会让一次凭据下放悄无声息。
    """
    text = os.getenv(ALLOWLIST_ENV, "") if raw is None else raw
    names: set[str] = set()
    for token in (text or "").split(","):
        name = token.strip()
        if not name:
            continue
        if is_sensitive_name(name):
            raise ValueError(
                f"外部执行面环境变量白名单里不许出现凭据类名字：{name!r}"
                f"（{ALLOWLIST_ENV} 只能追加非敏感名；凭据一律不下放）"
            )
        names.add(name.upper())
    return frozenset(names)


def build_child_env(
    *,
    explicit: Mapping[str, str] | None = None,
    allow: Iterable[str] = (),
    environ: Mapping[str, str] | None = None,
) -> dict[str, str]:
    """构造下放给子进程的环境。

    :param explicit: 调用方显式注入的值（进程内已知的少量配置）。**敏感名报错**。
    :param allow: 运维追加的非敏感白名单（大小写不敏感）。**敏感名报错**。
    :param environ: 宿主环境（默认 ``os.environ``；测试可注入）。

    返回的字典**只含**白名单命中的宿主变量，外加 ``explicit``。没有任何一条
    宿主变量是"因为没被拦"而下放的——全是"因为在名单里"。
    """
    host: Mapping[str, str] = os.environ if environ is None else environ

    allowed = set(SAFE_ENV_ALLOWLIST)
    for name in allow:
        candidate = (name or "").strip()
        if not candidate:
            continue
        if is_sensitive_name(candidate):
            raise ValueError(
                f"外部执行面环境变量白名单里不许出现凭据类名字：{candidate!r}"
                "（凭据一律不下放给外部进程）"
            )
        allowed.add(candidate.upper())

    child: dict[str, str] = {}
    for key, value in host.items():
        if key.upper() in allowed:
            child[key] = value

    for key, value in (explicit or {}).items():
        if is_sensitive_name(key):
            raise ValueError(
                f"不许把凭据类环境变量下放给外部执行面：{key!r}"
                "（CLI 的登录态走它自己的凭据文件，不靠继承宿主 env）"
            )
        child[key] = value

    return child


__all__ = [
    "ALLOWLIST_ENV",
    "SAFE_ENV_ALLOWLIST",
    "SENSITIVE_MARKERS",
    "SENSITIVE_PREFIXES",
    "build_child_env",
    "configured_allowlist",
    "is_sensitive_name",
]
