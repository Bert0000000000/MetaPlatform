# Re-export router from parent module
# (routes.py does `from .router import chat as router_chat`)
from ..router import chat  # noqa: F401