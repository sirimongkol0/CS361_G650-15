"""Local email/password authentication for demo and lab deployments.

This is an alternative to Cognito for environments where Cognito cannot be
created (for example an AWS Academy lab). It is **off by default**; enable it
with ``AUTH_BACKEND=local`` and a non-empty ``LOCAL_AUTH_SECRET``.

Passwords are salted PBKDF2-HMAC-SHA256 hashes stored in ``local_credentials``;
the ``users`` table still contains no password column. Tokens use the same
claims shape as Cognito access tokens, so role checks and logout revocation
work unchanged.
"""

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

import jwt

from config import settings

ISSUER = "pcsms-local"
_SCHEME = "pbkdf2_sha256"
_ITERATIONS = 600_000


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def hash_password(password: str) -> str:
    """Return a salted, self-describing PBKDF2 hash suitable for storage."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS)
    return f"{_SCHEME}${_ITERATIONS}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    """Constant-time check of a password against a stored hash."""
    try:
        scheme, iterations, salt_b64, hash_b64 = encoded.split("$")
        if scheme != _SCHEME:
            return False
        iterations = int(iterations)
        if iterations < 100_000 or iterations > 5_000_000:
            return False
        salt = base64.b64decode(salt_b64, validate=True)
        expected = base64.b64decode(hash_b64, validate=True)
    except (ValueError, TypeError):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def password_policy_error(password: str) -> Optional[str]:
    """Return an English policy error, or None when the password is acceptable."""
    if len(password) < 8:
        return "New password must be at least 8 characters"
    if not any(c.isupper() for c in password):
        return "New password must include an uppercase letter"
    if not any(c.islower() for c in password):
        return "New password must include a lowercase letter"
    if not any(c.isdigit() for c in password):
        return "New password must include a number"
    return None


def generate_password() -> str:
    """A 16-character password that satisfies ``password_policy_error``."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    chars = [
        secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ"),
        secrets.choice("abcdefghijkmnopqrstuvwxyz"),
        secrets.choice("23456789"),
    ]
    chars += [secrets.choice(alphabet) for _ in range(13)]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def create_access_token(user, expires_in: int) -> tuple[str, int]:
    """Issue an HS256 access token carrying the claims the app already checks."""
    if not settings.LOCAL_AUTH_SECRET:
        raise RuntimeError("LOCAL_AUTH_SECRET is not configured")
    expires_in = int(expires_in or 3600)
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": user.cognito_sub,
            "email": user.email,
            "cognito:groups": [user.role],
            "role": user.role,
            "token_use": "access",
            "iss": ISSUER,
            "iat": int(now.timestamp()),
            "exp": int(now.timestamp()) + expires_in,
            "jti": uuid4().hex,
        },
        settings.LOCAL_AUTH_SECRET,
        algorithm="HS256",
    )
    return token, expires_in
