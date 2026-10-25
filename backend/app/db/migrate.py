"""Bring the database schema up to date at startup, with Alembic.

Databases created before 1.3.0 have no Alembic history. They are first brought
up to the 1.3.0 baseline the way older releases did it (create missing tables,
add missing columns), then stamped at the baseline and upgraded from there.
"""

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.db.session import Base

logger = logging.getLogger(__name__)

BASELINE_REVISION = "0001"
_MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def _alembic_config(connection) -> Config:
    config = Config()
    config.set_main_option("script_location", str(_MIGRATIONS_DIR))
    config.attributes["connection"] = connection
    return config


def _upgrade_legacy_schema(engine: Engine) -> None:
    """Pre-1.3.0 behaviour: create missing tables and add missing columns.

    SQLAlchemy's create_all() creates missing tables but won't alter existing
    ones, so columns added in later 1.x releases are added here. SQLite can
    only add a NOT NULL column when it has a default to fill existing rows.
    """
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table_name, table in Base.metadata.tables.items():
            if not inspector.has_table(table_name):
                continue
            existing = {col["name"] for col in inspector.get_columns(table_name)}
            for col in table.columns:
                if col.name in existing:
                    continue
                col_type = col.type.compile(dialect=engine.dialect)
                default = ""
                if col.default is not None and col.default.is_scalar:
                    arg = col.default.arg
                    literal = int(arg) if isinstance(arg, bool) else arg
                    default = f" DEFAULT {literal!r}"
                nullable = " NOT NULL" if not col.nullable and default else ""
                stmt = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}{default}{nullable}"
                logger.info("Schema migration: %s", stmt)
                conn.execute(text(stmt))


def run_migrations(engine: Engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "alembic_version" not in tables and "users" in tables:
        logger.info("Upgrading a pre-1.3.0 database to the migration baseline")
        _upgrade_legacy_schema(engine)
        with engine.begin() as connection:
            command.stamp(_alembic_config(connection), BASELINE_REVISION)

    with engine.begin() as connection:
        command.upgrade(_alembic_config(connection), "head")
