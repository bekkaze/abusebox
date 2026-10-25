"""Drop the unused blacklisted_hostnames table

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-26
"""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nothing ever wrote to it; databases created by 1.x all have it.
    if sa.inspect(op.get_bind()).has_table("blacklisted_hostnames"):
        op.drop_table("blacklisted_hostnames")


def downgrade() -> None:
    op.create_table(
        "blacklisted_hostnames",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("hostname", sa.String(length=255), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created", sa.DateTime(), nullable=False),
        sa.Column("updated", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
