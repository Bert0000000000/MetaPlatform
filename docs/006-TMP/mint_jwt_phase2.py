"""Mint a JWT compatible with the TECH-* Python services.

The services share the default ``jwt_secret`` from app/config.py
("metaplatform-jwt-secret-key-2026", HS256).  This script mints a token
suitable for cross-service E2E acceptance without modifying any service
code.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone

import jwt

# Same secret as TECH-AGENT/TECH-RAG/TECH-LLMGW defaults.
SECRET = "metaplatform-jwt-secret-key-2026"

now = datetime.now(timezone.utc)
claims = {
    "sub": "phase2-acceptance",
    "username": "phase2-tester",
    "tenantId": "tenant-m2v01",
    "roles": ["PLATFORM_ADMIN", "AGENT_USER"],
    "type": "USER",
    "iat": now,
    "exp": now + timedelta(hours=2),
}

token = jwt.encode(claims, SECRET, algorithm="HS256")
print(token)