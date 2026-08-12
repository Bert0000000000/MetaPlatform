"""mate_tech_orchestrator.repositories — persistence for the orchestrator.

Roles (digital-employee registry) persist to SQL when ``MATE_DB_URL`` /
``DATABASE_URL`` is set (production); dev/test without a DSN stay
in-memory. Plan state persistence is deferred (aligned with SESSION-01).
"""
