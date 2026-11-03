"""Create or reset the local demo accounts used when AUTH_BACKEND=local.

Run inside the backend container after the database schema exists:

    python local_auth_setup.py

Passwords are generated, stored only as salted PBKDF2 hashes, and written to a
private file (default ``/app/storage/local-auth-users.txt``) for the demo
operator. Re-running rotates every demo password.
"""

import argparse
import os
from datetime import datetime, timezone
from pathlib import Path

import models
from database import Base, SessionLocal, engine
from local_auth import generate_password, hash_password

ROLES = ("public", "student", "coordinator", "staff", "admin")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--password-file",
        default=os.environ.get("LOCAL_AUTH_USERS_FILE", "/app/storage/local-auth-users.txt"),
        help="where to write role/email/password lines (mode 0600)",
    )
    parser.add_argument(
        "--role", action="append", choices=ROLES,
        help="only create/reset these roles (repeatable); default: all",
    )
    args = parser.parse_args()

    roles = tuple(args.role) if args.role else ROLES
    Base.metadata.create_all(engine)
    now = datetime.now(timezone.utc)
    lines: list[str] = []

    with SessionLocal() as db:
        for role in roles:
            email = f"{role}@example.test"
            password = generate_password()
            user = db.query(models.User).filter(models.User.email == email).first()
            if user is None:
                user = models.User(
                    cognito_sub=f"local:{email}",
                    email=email,
                    role=role,
                    is_active=True,
                    created_at=now,
                )
                db.add(user)
                db.flush()
            else:
                user.role = role
                user.is_active = True
            credential = db.get(models.LocalCredential, user.id)
            if credential is None:
                credential = models.LocalCredential(user_id=user.id)
                db.add(credential)
            credential.password_hash = hash_password(password)
            credential.updated_at = now
            lines.append(f"{role}\t{email}\t{password}")
        db.commit()

    path = Path(args.password_file)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write("# local demo accounts for AUTH_BACKEND=local\n")
        handle.writelines(line + "\n" for line in lines)
    os.chmod(path, 0o600)

    print("Local demo accounts ready:")
    for role in roles:
        print(f"  {role:12} {role}@example.test")
    print(f"Passwords written to {path} (mode 0600).")


if __name__ == "__main__":
    main()
