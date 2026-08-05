"""Ontology installer — [blocked-on: MP-ONT-REGISTER-01]。"""
from __future__ import annotations

from ._base import BaseInstaller


class OntologyInstaller(BaseInstaller):
    kind = "ontology"
    register_method = "register_ontology"