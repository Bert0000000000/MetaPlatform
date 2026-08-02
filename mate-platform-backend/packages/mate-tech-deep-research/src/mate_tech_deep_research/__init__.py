"""mate-tech-deep-research package.

A2A agent that delegates deep web research tasks to the DeerFlow Engine.
Implements the ADR-0014 5-step compliance pattern:
  1. install_auth(app) in main.py
  2. require_tenant(ctx) in every handler
  3. outbox event emitted in the same transaction
  4. DeerFlow Engine outbound calls go through BearerAuth
  5. cross-tenant negative tests
"""
from __future__ import annotations

__version__ = "0.1.0"
