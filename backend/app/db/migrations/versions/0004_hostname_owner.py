"""Add hostnames.owner

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-08
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A label, not a relation. Who is accountable for an asset is a human fact
    # ("the mail team", a customer's name) and assets are private to the
    # account that added them, so there is nobody on this install to point a
    # foreign key at. Sharing assets between accounts is a 2.0 question.
    columns = {col["name"] for col in sa.inspect(op.get_bind()).get_columns("hostnames")}
    if "owner" not in columns:
        with op.batch_alter_table("hostnames", schema=None) as batch_op:
            batch_op.add_column(sa.Column("owner", sa.String(length=100), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("hostnames", schema=None) as batch_op:
        batch_op.drop_column("owner")
