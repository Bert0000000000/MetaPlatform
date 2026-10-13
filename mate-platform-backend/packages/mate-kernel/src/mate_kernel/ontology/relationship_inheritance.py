"""Declared parent_class inheritance for relationship endpoints (MP11-ONT-07)."""

from collections.abc import Callable


def relationship_ancestors(class_rid: str, parent_of: Callable[[str], str]) -> frozenset[str]:
    """Return a complete same-tenant chain; missing/cyclic/foreign chains fail closed.

    parent_of must raise KeyError for missing or archived types. Repositories
    decide how to read (and, for writes, lock) the authoritative type rows.
    """
    parts = class_rid.split(".")
    if len(parts) < 4 or parts[0] != "ont":
        return frozenset()
    prefix = f"ont.{parts[1]}.obj."
    seen: set[str] = set()
    current = class_rid
    while current:
        if not current.startswith(prefix) or current in seen:
            return frozenset()
        seen.add(current)
        try:
            current = parent_of(current)
        except KeyError:
            return frozenset()
    return frozenset(seen)
