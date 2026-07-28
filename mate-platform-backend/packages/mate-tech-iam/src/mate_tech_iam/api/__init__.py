"""HTTP API routers for IAM admin (users, permissions, orgs, logs, configs)."""
from .users import router as users_router
from .permissions import router as permissions_router
from .orgs import router as orgs_router
from .logs import router as logs_router
from .configs import router as configs_router

__all__ = [
    "users_router",
    "permissions_router",
    "orgs_router",
    "logs_router",
    "configs_router",
]
