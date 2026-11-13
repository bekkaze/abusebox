"""Add hostnames.check_mail_server

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-13
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # False for every existing asset. The check connects to port 25, and an
    # upgrade must not start doing that to hosts nobody asked it to; only
    # assets added from 1.6 on get it by default.
    columns = {col["name"] for col in sa.inspect(op.get_bind()).get_columns("hostnames")}
    if "check_mail_server" not in columns:
        with op.batch_alter_table("hostnames", schema=None) as batch_op:
            batch_op.add_column(sa.Column("check_mail_server", sa.Boolean(), nullable=False,
                                          server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table("hostnames", schema=None) as batch_op:
        batch_op.drop_column("check_mail_server")
