"""Marketplace error codes(SPEC §4.1)。"""

from __future__ import annotations


class MarketplaceError(Exception):
    """Base class;HTTP client / OCI puller 都抛这一族。"""

    code = "MP_INTERNAL"


class DigestMismatch(MarketplaceError):
    code = "MP_DIGEST_MISMATCH"


class ManifestInvalid(MarketplaceError):
    code = "MP_MANIFEST_INVALID"


class LicenseInvalid(MarketplaceError):
    code = "MP_LICENSE_INVALID"


class LicenseExpired(MarketplaceError):
    code = "MP_LICENSE_EXPIRED"


class LicenseQuotaExceeded(MarketplaceError):
    code = "MP_LICENSE_QUOTA_EXCEEDED"


class IncompatiblePlatform(MarketplaceError):
    code = "MP_INCOMPATIBLE_PLATFORM"


class KindNotAllowed(MarketplaceError):
    code = "MP_KIND_NOT_ALLOWED"


class SaaSUnreachable(MarketplaceError):
    code = "MP_SAAS_UNREACHABLE"