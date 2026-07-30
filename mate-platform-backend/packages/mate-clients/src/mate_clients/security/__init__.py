"""Security adapters for the mate-clients ACL layer.

The mate-clients package owns every outbound integration. The
security adapters here guarantee that:
  - Every outbound call carries a valid Bearer token
    (client_credentials grant).
  - Every outbound call carries the X-Tenant-Id header.
  - The token cache is refreshed in the background; callers never
    see an expired token mid-flight.

No business code may call Keycloak directly (hard rule 4); it must
go through `BearerAuth` and `OutgoingAuthMiddleware`.
"""
from .bearer import BearerAuth, BearerAuthError, CachedToken
from .outgoing import OutgoingAuthMiddleware

__all__ = [
    "BearerAuth",
    "BearerAuthError",
    "CachedToken",
    "OutgoingAuthMiddleware",
]