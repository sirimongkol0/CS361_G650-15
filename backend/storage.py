"""Storage backend for document files.

Design decision: file bytes live in object storage (S3) or local disk --
NEVER inside the database. The `documents` table stores only metadata
plus a storage key, so the DB stays small and dumps/replication stay fast.

Two backends:
- "s3"   : real S3 via boto3 (needs credentials + bucket)
- "local": filesystem under LOCAL_STORAGE_DIR (default: for dev/tests/CI,
           no AWS needed -- same interface as s3)

Switch with STORAGE_BACKEND env var ("local" | "s3").
"""
import os
import uuid

import config


class StorageError(Exception):
    pass


def _get_backend_name() -> str:
    return getattr(config.settings, "STORAGE_BACKEND", "local")


def build_storage_key(original_filename: str) -> str:
    """Return a unique object key like 'documents/<uuid>/report.pdf'.

    The original filename is preserved as the last path segment so the
    download can suggest a good filename; a UUID prefix prevents collisions.
    """
    safe_name = os.path.basename(original_filename or "file.pdf")
    return f"documents/{uuid.uuid4().hex}/{safe_name}"


# ---------------------------------------------------------------- local disk


def _local_dir() -> str:
    d = getattr(config.settings, "LOCAL_STORAGE_DIR", "./storage")
    os.makedirs(d, exist_ok=True)
    return d


def _local_path(key: str) -> str:
    # Prevent path traversal: resolve and require the result to stay inside the storage dir.
    base = os.path.abspath(_local_dir())
    path = os.path.abspath(os.path.join(base, key))
    if not path.startswith(base + os.sep):
        raise StorageError("Invalid storage key")
    return path


def _local_put(key: str, data: bytes):
    path = _local_path(key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def _local_get(key: str) -> bytes:
    try:
        with open(_local_path(key), "rb") as f:
            return f.read()
    except FileNotFoundError:
        raise StorageError(f"File not found in local storage: {key}")


def _local_delete(key: str):
    try:
        os.remove(_local_path(key))
    except FileNotFoundError:
        pass


# ---------------------------------------------------------------------- s3


def _s3_client():
    import boto3  # imported lazily so CI without AWS deps still works

    kwargs = {"region_name": getattr(config.settings, "AWS_REGION", None)}
    # Static credentials from settings (.env / container env). When empty,
    # boto3 falls back to its standard credential chain (env, ~/.aws, IAM role).
    access_key = getattr(config.settings, "AWS_ACCESS_KEY_ID", "")
    secret_key = getattr(config.settings, "AWS_SECRET_ACCESS_KEY", "")
    if access_key and secret_key:
        kwargs["aws_access_key_id"] = access_key
        kwargs["aws_secret_access_key"] = secret_key
    return boto3.client("s3", **kwargs)


def _s3_bucket() -> str:
    bucket = getattr(config.settings, "S3_BUCKET", "")
    if not bucket:
        raise StorageError("S3_BUCKET is not configured")
    return bucket


def _s3_put(key: str, data: bytes):
    _s3_client().put_object(Bucket=_s3_bucket(), Key=key, Body=data)


def _s3_get(key: str) -> bytes:
    from botocore.exceptions import ClientError

    try:
        resp = _s3_client().get_object(Bucket=_s3_bucket(), Key=key)
        return resp["Body"].read()
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("NoSuchKey", "404"):
            raise StorageError(f"S3 object not found: {key}")
        raise


def _s3_delete(key: str):
    _s3_client().delete_object(Bucket=_s3_bucket(), Key=key)


# ------------------------------------------------------------- public API


def put_file(key: str, data: bytes):
    """Store bytes under `key`."""
    if _get_backend_name() == "s3":
        _s3_put(key, data)
    else:
        _local_put(key, data)


def get_file(key: str) -> bytes:
    """Read bytes stored under `key`. Raises StorageError if missing."""
    if _get_backend_name() == "s3":
        return _s3_get(key)
    return _local_get(key)


def delete_file(key: str):
    """Best-effort delete (missing objects are ignored)."""
    if _get_backend_name() == "s3":
        _s3_delete(key)
    else:
        _local_delete(key)
