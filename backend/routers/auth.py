from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

import auth
import database
import models
import schemas

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.LoginResponse)
def login(body: schemas.LoginRequest, db: Session = Depends(database.get_db)):
    """Exchange email + password (checked by Cognito) for a bearer access token."""
    result = auth.sign_in(body.email.lower(), body.password)
    identity = auth.decode_token(result["IdToken"], "id")
    access = auth.decode_token(result["AccessToken"], "access")
    if identity["sub"] != access["sub"]:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    role = auth.role_from_groups(access.get("cognito:groups"))
    now = auth.utcnow()

    user = db.query(models.User).filter(models.User.cognito_sub == identity["sub"]).first()
    if user is None:
        user = models.User(cognito_sub=identity["sub"], created_at=now)
        db.add(user)
    elif not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    user.email = identity.get("email", body.email).lower()
    user.role = role
    user.last_login_at = now
    db.commit()
    return schemas.LoginResponse(
        access_token=result["AccessToken"],
        expires_in=result.get("ExpiresIn", 3600),
        role=role,
    )


@router.get("/me", response_model=schemas.CurrentUserResponse)
def me(user: models.User = Depends(auth.get_current_user)):
    return user


@router.post("/logout", status_code=204)
def logout(
    claims: dict = Depends(auth.get_token_claims),
    _user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    """Revoke the caller's access token for the rest of its lifetime."""
    now = auth.utcnow()
    db.query(models.RevokedToken).filter(models.RevokedToken.expires_at < now).delete()
    db.add(models.RevokedToken(
        jti=claims["jti"],
        expires_at=datetime.fromtimestamp(claims["exp"], tz=timezone.utc),
    ))
    db.commit()
    return Response(status_code=204)
