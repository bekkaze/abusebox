"""Add removal_requests

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-13
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Requests made before 1.6 lived only as a "requested" flag on one check's
    # result. They are not copied in: without the verdict at the time and the
    # checks since, a row would claim more than is known.
    if "removal_requests" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "removal_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hostname_id", sa.Integer(), sa.ForeignKey("hostnames.id", ondelete="CASCADE"), nullable=False),
        sa.Column("check_id", sa.Integer(), nullable=True),
        sa.Column("provider", sa.String(length=255), nullable=False),
        sa.Column("codes", sa.JSON(), nullable=True),
        sa.Column("causes", sa.JSON(), nullable=True),
        sa.Column("readiness", sa.String(length=20), nullable=False),
        sa.Column("fixed", sa.Boolean(), nullable=True),
        sa.Column("evidence", sa.String(length=500), nullable=True),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("override_reason", sa.String(length=500), nullable=True),
        sa.Column("requested_at", sa.DateTime(), nullable=False),
        sa.Column("cleared_at", sa.DateTime(), nullable=True),
        sa.Column("relisted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_removal_requests_id", "removal_requests", ["id"])
    op.create_index("ix_removal_requests_hostname_id", "removal_requests", ["hostname_id"])


def downgrade() -> None:
    op.drop_index("ix_removal_requests_hostname_id", table_name="removal_requests")
    op.drop_index("ix_removal_requests_id", table_name="removal_requests")
    op.drop_table("removal_requests")
