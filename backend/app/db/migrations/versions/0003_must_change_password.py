"""Add users.must_change_password

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-28
"""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Databases upgraded from before 1.3.0 already got the column from the
    # legacy schema step, which adds every column the models define.
    columns = {col["name"] for col in sa.inspect(op.get_bind()).get_columns("users")}
    if "must_change_password" not in columns:
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.add_column(sa.Column("must_change_password", sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("must_change_password")
