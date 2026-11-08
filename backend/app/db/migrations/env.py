"""Alembic environment. Migrations run at startup through app.db.migrate."""

import importlib

from alembic import context

from app.db.session import Base

# Imported for the side effect, not for a name: this registers every table on
# Base.metadata before Alembic compares it against the database.
importlib.import_module("app.models")

config = context.config


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        # SQLite can't ALTER most things in place; batch mode copies the table.
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


run_migrations_online()
