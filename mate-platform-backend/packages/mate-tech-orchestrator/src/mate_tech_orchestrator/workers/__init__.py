"""mate_tech_orchestrator.workers — worker adapters.

Each worker adapts a service-center surface into a uniform
``invoke(tenant_id, ref, arguments)`` so the dispatcher can route a
task step without caring which protocol the role's capability speaks.
"""
