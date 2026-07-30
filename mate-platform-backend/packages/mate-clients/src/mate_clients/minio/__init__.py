"""MinIO ACL client. All access goes through buckets.py for tenant scoping."""
from .buckets import (
    MinioBucketError,
    bucket_for,
    object_key,
)

__all__ = ["MinioBucketError", "bucket_for", "object_key"]
