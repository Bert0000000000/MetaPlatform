"""Mate Platform - Analytics service.

Provides platform-wide analytics (overview / usage / users / services /
trends) backed by an in-memory seeded store. Wired with the 3 integration
hooks per ADR-0014:
  1. install_auth(app) from mate_platform.auth (SEC-IAM-01).
  2. require_tenant(ctx) at every handler (SEC-TENANT-01, hard rule 3).
"""
__version__ = "0.1.0"
