"""Fake Cognito and token signer shared by tests (no AWS access needed).

Use the ``cognito`` and ``auth_headers`` fixtures from ``conftest.py`` in tests;
import from here only when a test needs a hand-made token (expired, forged, ...).
"""

import time
import uuid

import jwt
from botocore.exceptions import ClientError
from cryptography.hazmat.primitives.asymmetric import rsa

POOL_ID = "ap-southeast-1_TESTPOOL"
CLIENT_ID = "test-app-client"
ISSUER = f"https://cognito-idp.ap-southeast-1.amazonaws.com/{POOL_ID}"
SIGNING_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PASSWORD = "Fictional-Passw0rd"


def make_token(sub, groups=(), token_use="access", *, email=None, lifetime=3600,
               client_id=CLIENT_ID, issuer=ISSUER, key=SIGNING_KEY):
    now = int(time.time())
    claims = {"sub": sub, "iss": issuer, "token_use": token_use, "iat": now,
              "exp": now + lifetime, "jti": str(uuid.uuid4())}
    if groups:
        claims["cognito:groups"] = list(groups)
    if token_use == "access":
        claims["client_id"] = client_id
    else:
        claims["aud"] = client_id
        claims["email"] = email
    return jwt.encode(claims, key, algorithm="RS256")


class FakeCognito:
    """Stands in for the boto3 ``cognito-idp`` client used by ``auth.sign_in``."""

    def __init__(self):
        self.users = {}
        self.challenge = False

    def add(self, email, groups):
        self.users[email] = {"sub": str(uuid.uuid4()), "groups": list(groups)}
        return self.users[email]

    def initiate_auth(self, ClientId, AuthFlow, AuthParameters):
        assert (ClientId, AuthFlow) == (CLIENT_ID, "USER_PASSWORD_AUTH")
        user = self.users.get(AuthParameters["USERNAME"])
        if user is None or AuthParameters["PASSWORD"] != PASSWORD:
            raise ClientError({"Error": {"Code": "NotAuthorizedException",
                                         "Message": "Incorrect username or password."}},
                              "InitiateAuth")
        if self.challenge:
            return {"ChallengeName": "NEW_PASSWORD_REQUIRED", "Session": "s"}
        email = AuthParameters["USERNAME"]
        return {"AuthenticationResult": {
            "AccessToken": make_token(user["sub"], user["groups"]),
            "IdToken": make_token(user["sub"], user["groups"], "id", email=email),
            "ExpiresIn": 3600,
            "TokenType": "Bearer",
        }}
