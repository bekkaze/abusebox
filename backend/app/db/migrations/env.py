"""Alembic environment. Migrations run at startup through app.db.migrate."""

from alembic import context

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.db.session import Base

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
