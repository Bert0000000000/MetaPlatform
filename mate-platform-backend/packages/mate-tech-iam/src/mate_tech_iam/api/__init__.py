"""HTTP API routers for IAM (auth + admin)."""
from .auth import router as auth_router
from .configs import router as configs_router
from .logs import router as logs_router
from .orgs import router as orgs_router
from .permissions import router as permissions_router
from .users import router as users_router

__all__ = [
    "auth_router",
    "configs_router",
    "logs_router",
    "orgs_router",
    "permissions_router",
    "users_router",
]
