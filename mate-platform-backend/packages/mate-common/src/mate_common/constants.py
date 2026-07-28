"""常量定义"""

from enum import StrEnum


class Environment(StrEnum):
    """运行环境"""

    DEV = "dev"
    TEST = "test"
    STAGING = "staging"
    PROD = "prod"


# HTTP Headers（来自 Traefik / AuthService）
HEADER_TENANT_ID = "X-Tenant-Id"
HEADER_USER_ID = "X-User-Id"
HEADER_TRACE_ID = "X-Trace-Id"
HEADER_REQUEST_ID = "X-Request-Id"

# 默认服务端口
DEFAULT_HTTP_PORT = 8080
DEFAULT_AUTH_PORT = 8000
