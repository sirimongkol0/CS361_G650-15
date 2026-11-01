"""V4-6 (#99) schema migration: improvements recorded from feedback.

Run with the API stopped, after backing up the database:
    python migrate_v4_6.py
"""

import argparse

from sqlalchemy import create_engine

from database import Base
import models  # noqa: F401  (registers the tables on Base.metadata)
import migrate_v4_4


V4_6_TABLES = ("improvements", "feedback_improvements")


def migrate(engine):
    # Ensures the V4 schema up to V4-4 exists first.
    migrate_v4_4.migrate(engine)
    with engine.begin() as connection:
        for name in V4_6_TABLES:
            Base.metadata.tables[name].create(connection, checkfirst=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", help="Defaults to configured DATABASE_URL")
    args = parser.parse_args()
    from config import settings

    engine = create_engine(args.database_url or settings.DATABASE_URL)
    try:
        migrate(engine)
    finally:
        engine.dispose()
    print("V4-6 schema migration complete.")


if __name__ == "__main__":
    main()
