"""Runtime field binding — maps form fields to flow node variables.

APPHUB-RUNTIME-01 phase B.
"""
from __future__ import annotations


def resolve_field_binding(
    form_config: dict, flow_config: dict,
) -> dict:
    """Resolve form field → flow variable mappings.

    ``form_config`` shape::

        {"fields": [{"name": "title", "bind": "flow_title"}, ...]}

    ``flow_config`` shape::

        {"variables": {"flow_title": {"type": "string"}, ...}}

    Resolution rules (in priority order):
      1. If the field has an explicit ``bind`` and that key exists in
         ``flow_config["variables"]``, use the bind key.
      2. If the field name matches a flow variable key directly, use
         the field name.
      3. Otherwise, default the binding to the field name (identity).

    Returns ``{field_name: flow_variable}``.
    """
    flow_vars: dict = flow_config.get("variables", {}) if flow_config else {}
    form_fields: list = form_config.get("fields", []) if form_config else []

    mapping: dict[str, str] = {}
    for field in form_fields:
        if isinstance(field, dict):
            field_name = field.get("name", "")
            bind_target = field.get("bind")
        else:
            field_name = str(field)
            bind_target = None

        if bind_target and bind_target in flow_vars:
            mapping[field_name] = bind_target
        elif field_name in flow_vars:
            mapping[field_name] = field_name
        else:
            mapping[field_name] = field_name

    return mapping
