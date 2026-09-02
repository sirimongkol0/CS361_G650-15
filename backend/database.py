from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from config import settings

DATABASE_URL = settings.DATABASE_URL

engine_options = {}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
    if DATABASE_URL in {"sqlite://", "sqlite:///:memory:"}:
        # Share one in-memory database across TestClient worker threads.
        engine_options["poolclass"] = StaticPool

engine = create_engine(DATABASE_URL, **engine_options)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
