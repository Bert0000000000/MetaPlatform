"""Ontology installer — registers an Ontology artifact with ``mate-tech-ont``.

The installer delegates to ``OntologyMarketplaceClient.register_ontology``
(MP-ONT-REGISTER-01) which lives in ``mate-clients.marketplace.ontology``.
"""
from __future__ import annotations

from ._base import BaseInstaller


class OntologyInstaller(BaseInstaller):
    kind = "ontology"
    register_method = "register_ontology"
