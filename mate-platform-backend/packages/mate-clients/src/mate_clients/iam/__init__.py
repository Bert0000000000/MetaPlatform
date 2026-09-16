"""mate_clients.iam — IAM 的机器取数通道。"""

from .service_read import IamServiceReadClient, ProviderConfigError

__all__ = ["IamServiceReadClient", "ProviderConfigError"]
