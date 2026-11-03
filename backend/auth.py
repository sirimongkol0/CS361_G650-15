"""Authentication and server-side role checks (V3).

Amazon Cognito owns passwords and role groups; this module verifies the
tokens Cognito signs and maps them to a local ``models.User``.

Protect an endpoint by depending on ``require_role``::

    @router.post("/partners")
    def create_partner(..., user: models.User = Depends(require_role("staff", "admin"))):
        ...

The listed roles are the only ones allowed (``admin`` is not implied).
No/invalid token -> 401, valid token without an allowed role -> 403.
"""

from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

import boto3
import jwt
from botocore import UNSIGNED
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import database
import local_auth
import models
from config import settings

ROLES = models.ROLES
_BEARER = {"WWW-Authenticate": "Bearer"}
_bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=401, detail=detail, headers=_BEARER)


def _require_configured() -> None:
    if settings.AUTH_BACKEND == "local":
        if not settings.LOCAL_AUTH_SECRET:
            raise HTTPException(status_code=503, detail="Authentication is not configured")
        return
    if not (settings.COGNITO_USER_POOL_ID and settings.COGNITO_APP_CLIENT_ID):
        raise HTTPException(status_code=503, detail="Authentication is not configured")


def cognito_issuer() -> str:
    return (f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/"
            f"{settings.COGNITO_USER_POOL_ID}")


@lru_cache(maxsize=4)
def _jwks_client(issuer: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{issuer}/.well-known/jwks.json", cache_keys=True, timeout=5)


def get_signing_key(token: str):
    """Return the Cognito public key that signed ``token`` (tests replace this)."""
    return _jwks_client(cognito_issuer()).get_signing_key_from_jwt(token).key


def cognito_client():
    """Cognito client for the user-facing API; sign-in needs no AWS credentials."""
    return boto3.client(
        "cognito-idp",
        region_name=settings.COGNITO_REGION,
        config=Config(signature_version=UNSIGNED, connect_timeout=5, read_timeout=10,
                      retries={"max_attempts": 2}),
    )


def decode_token(token: str, token_use: str = "access") -> dict:
    """Verify a Cognito ``access`` or ``id`` token and return its claims."""
    if settings.AUTH_BACKEND == "local":
        return _decode_local_token(token, token_use)
    _require_configured()
    client_id = settings.COGNITO_APP_CLIENT_ID
    try:
        claims = jwt.decode(
            token,
            get_signing_key(token),
            algorithms=["RS256"],
            issuer=cognito_issuer(),
            # Only ID tokens carry ``aud``; access tokens name the client in ``client_id``.
            audience=client_id if token_use == "id" else None,
            options={"require": ["exp", "iat", "sub", "token_use"],
                     "verify_aud": token_use == "id"},
        )
    except jwt.PyJWKClientConnectionError as exc:
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc
    except jwt.PyJWTError as exc:
        raise _unauthorized("Invalid or expired token") from exc
    if claims.get("token_use") != token_use:
        raise _unauthorized("Invalid or expired token")
    if token_use == "access" and (claims.get("client_id") != client_id or not claims.get("jti")):
        raise _unauthorized("Invalid or expired token")
    return claims


def _decode_local_token(token: str, token_use: str = "access") -> dict:
    """Verify an HS256 token issued by the local auth backend."""
    _require_configured()
    try:
        claims = jwt.decode(
            token,
            settings.LOCAL_AUTH_SECRET,
            algorithms=["HS256"],
            issuer=local_auth.ISSUER,
            options={"require": ["exp", "iat", "sub", "token_use", "jti"]},
        )
    except jwt.PyJWTError as exc:
        raise _unauthorized("Invalid or expired token") from exc
    if claims.get("token_use") != token_use:
        raise _unauthorized("Invalid or expired token")
    return claims


def local_sign_in(db: Session, email: str, password: str) -> models.User:
    """Check a local password and return the matching active user."""
    _require_configured()
    user = db.query(models.User).filter(models.User.email == email.lower()).first()
    credential = db.get(models.LocalCredential, user.id) if user is not None else None
    if credential is None or not local_auth.verify_password(password, credential.password_hash):
        raise _unauthorized("Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return user


def local_token(user: models.User) -> tuple[str, int]:
    return local_auth.create_access_token(user, settings.LOCAL_AUTH_TOKEN_MINUTES * 60)


def local_change_password(db: Session, user: models.User, current: str, new: str) -> None:
    """Change a local password after checking the current one."""
    credential = db.get(models.LocalCredential, user.id)
    if credential is None or not local_auth.verify_password(current, credential.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    policy_error = local_auth.password_policy_error(new)
    if policy_error:
        raise HTTPException(status_code=422, detail=policy_error)
    credential.password_hash = local_auth.hash_password(new)
    credential.updated_at = utcnow()


def role_from_groups(groups) -> str:
    """Highest-privilege known role among the Cognito groups; ``public`` if none."""
    held = set(groups or ())
    return next((role for role in reversed(ROLES) if role in held), "public")


def sign_in(email: str, password: str) -> dict:
    """Check the password with Cognito and return its ``AuthenticationResult``."""
    _require_configured()
    try:
        response = cognito_client().initiate_auth(
            ClientId=settings.COGNITO_APP_CLIENT_ID,
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={"USERNAME": email, "PASSWORD": password},
        )
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code in {"NotAuthorizedException", "UserNotFoundException",
                    "UserNotConfirmedException", "PasswordResetRequiredException"}:
            raise _unauthorized("Invalid email or password") from exc
        if code == "TooManyRequestsException":
            raise HTTPException(status_code=429, detail="Too many login attempts") from exc
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc
    except BotoCoreError as exc:
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc
    if "AuthenticationResult" not in response:
        # e.g. NEW_PASSWORD_REQUIRED for an account an admin has just created.
        raise _unauthorized("Password change required")
    return response["AuthenticationResult"]


def change_password(access_token: str, current_password: str, new_password: str) -> None:
    """Change the caller's own password in Cognito, authorised by their access token.

    A wrong current password is 400, not 401: the web signs the user out on 401.
    """
    _require_configured()
    try:
        cognito_client().change_password(
            PreviousPassword=current_password,
            ProposedPassword=new_password,
            AccessToken=access_token,
        )
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code == "NotAuthorizedException":
            raise HTTPException(status_code=400, detail="Current password is incorrect") from exc
        if code in {"InvalidPasswordException", "InvalidParameterException"}:
            raise HTTPException(status_code=422, detail="New password does not meet the password policy") from exc
        if code in {"LimitExceededException", "TooManyRequestsException"}:
            raise HTTPException(status_code=429, detail="Too many password change attempts") from exc
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc
    except BotoCoreError as exc:
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc


def _claims_for(token: str, db: Session) -> dict:
    claims = decode_token(token, "access")
    if db.get(models.RevokedToken, claims["jti"]) is not None:
        raise _unauthorized("Invalid or expired token")
    return claims


def _user_for(claims: dict, db: Session) -> models.User:
    """The active user behind verified claims; the stored role follows the token's Cognito group."""
    user = db.query(models.User).filter(models.User.cognito_sub == claims["sub"]).first()
    if user is None:
        # Rows are created by POST /auth/login, the only way this API issues tokens.
        raise _unauthorized("Invalid or expired token")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    role = role_from_groups(claims.get("cognito:groups"))
    if user.role != role:
        user.role = role
        db.commit()
    return user


def get_token_claims(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(database.get_db),
) -> dict:
    """Verified access-token claims of the caller; 401 if missing, invalid or logged out."""
    if credentials is None:
        raise _unauthorized("Not authenticated")
    return _claims_for(credentials.credentials, db)


def get_current_user(
    claims: dict = Depends(get_token_claims),
    db: Session = Depends(database.get_db),
) -> models.User:
    """The signed-in, active user; the stored role follows the token's Cognito group."""
    return _user_for(claims, db)


def optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: Session = Depends(database.get_db),
) -> Optional[models.User]:
    """For public reads: ``None`` without a token, otherwise the same checks as
    ``get_current_user`` (a supplied token that fails is 401/403, never public)."""
    if credentials is None:
        return None
    return _user_for(_claims_for(credentials.credentials, db), db)


def require_role(*roles: str):
    """Dependency factory: allow only users whose role is one of ``roles``."""
    unknown = set(roles) - set(ROLES)
    if not roles or unknown:
        raise ValueError(f"require_role needs roles from {ROLES}, got {roles}")
    allowed = frozenset(roles)

    def dependency(user: models.User = Depends(get_current_user)) -> models.User:
        if user.role not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return dependency


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
