"""mate_clients.marketplace — Anti-Corruption Layer for SaaS marketplace + OCI.

控制面:SaaS HTTP API(MarketplaceClient)
数据面:OCI Distribution Spec v2(OCIPuller)
本地缓存:Redis(短效 OCI token)
"""
from __future__ import annotations

__version__ = "0.1.0"