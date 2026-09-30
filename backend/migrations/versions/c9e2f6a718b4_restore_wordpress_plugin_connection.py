"""Restore the Hiqain WordPress plugin connection contract.

Revision ID: c9e2f6a718b4
Revises: b4e8c0d3a12f
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9e2f6a718b4"
down_revision: Union[str, Sequence[str], None] = "b4e8c0d3a12f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("wordpress_integrations") as batch_op:
        batch_op.add_column(sa.Column("admin_url", sa.String(length=512), nullable=True))
        batch_op.add_column(sa.Column("shared_secret_encrypted", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("seo_plugin", sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column("permalink_structure", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("plugin_version", sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column("capabilities", sa.JSON(), nullable=True))

    op.create_table(
        "wordpress_connect_states",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_hash", sa.String(length=64, collation="ascii_bin"), nullable=False, unique=True),
        sa.Column("site_url", sa.String(length=512), nullable=False),
        sa.Column("return_url", sa.String(length=1024), nullable=False),
        sa.Column("correlation_id", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_wordpress_connect_states_expires_at", "wordpress_connect_states", ["expires_at"])

    op.create_table(
        "wordpress_request_nonces",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("integration_id", sa.Integer(), sa.ForeignKey("wordpress_integrations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nonce_hash", sa.String(length=64, collation="ascii_bin"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("integration_id", "nonce_hash", name="uq_wordpress_request_nonce"),
    )
    op.create_index("ix_wordpress_request_nonces_integration_id", "wordpress_request_nonces", ["integration_id"])

    op.create_table(
        "wordpress_status_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("integration_id", sa.Integer(), sa.ForeignKey("wordpress_integrations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("article_id", sa.Integer(), sa.ForeignKey("articles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_id", sa.String(length=64, collation="ascii_bin"), nullable=False, unique=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("blocked", sa.Boolean(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_wordpress_status_events_integration_id", "wordpress_status_events", ["integration_id"])
    op.create_index("ix_wordpress_status_events_article_id", "wordpress_status_events", ["article_id"])


def downgrade() -> None:
    op.drop_table("wordpress_status_events")
    op.drop_table("wordpress_request_nonces")
    op.drop_table("wordpress_connect_states")
    with op.batch_alter_table("wordpress_integrations") as batch_op:
        batch_op.drop_column("capabilities")
        batch_op.drop_column("plugin_version")
        batch_op.drop_column("permalink_structure")
        batch_op.drop_column("seo_plugin")
        batch_op.drop_column("shared_secret_encrypted")
        batch_op.drop_column("admin_url")
