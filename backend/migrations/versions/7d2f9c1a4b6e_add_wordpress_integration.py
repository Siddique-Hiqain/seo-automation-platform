"""add WordPress integration tables

Revision ID: 7d2f9c1a4b6e
Revises: 93f7d7928bca
Create Date: 2026-09-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7d2f9c1a4b6e"
down_revision: Union[str, Sequence[str], None] = "93f7d7928bca"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("articles", sa.Column("wp_post_id", sa.Integer(), nullable=True))
    op.add_column("articles", sa.Column("wp_link", sa.String(length=512), nullable=True))

    op.create_table(
        "wordpress_integrations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("website_id", sa.Integer(), nullable=False),
        sa.Column("base_url", sa.String(length=512), nullable=False),
        sa.Column("admin_url", sa.String(length=512), nullable=False),
        sa.Column("rest_url", sa.String(length=512), nullable=False),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("application_password_encrypted", sa.Text(), nullable=True),
        sa.Column("shared_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("seo_plugin", sa.String(length=20), nullable=False),
        sa.Column("permalink_structure", sa.String(length=255), nullable=False),
        sa.Column("plugin_version", sa.String(length=20), nullable=False),
        sa.Column("capabilities", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("connected_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("disconnected_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["website_id"], ["websites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("website_id"),
    )

    op.create_table(
        "wordpress_connect_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64, collation="ascii_bin"), nullable=False),
        sa.Column("site_url", sa.String(length=512), nullable=False),
        sa.Column("return_url", sa.String(length=1024), nullable=False),
        sa.Column("correlation_id", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_wordpress_connect_states_expires_at"),
        "wordpress_connect_states",
        ["expires_at"],
        unique=False,
    )

    op.create_table(
        "wordpress_request_nonces",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("integration_id", sa.Integer(), nullable=False),
        sa.Column("nonce_hash", sa.String(length=64, collation="ascii_bin"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["integration_id"], ["wordpress_integrations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("integration_id", "nonce_hash", name="uq_wordpress_request_nonce"),
    )
    op.create_index(
        op.f("ix_wordpress_request_nonces_integration_id"),
        "wordpress_request_nonces",
        ["integration_id"],
        unique=False,
    )

    op.create_table(
        "wordpress_status_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("integration_id", sa.Integer(), nullable=False),
        sa.Column("article_id", sa.Integer(), nullable=True),
        sa.Column("event_id", sa.String(length=64, collation="ascii_bin"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("blocked", sa.Boolean(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["integration_id"], ["wordpress_integrations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id"),
    )
    op.create_index(
        op.f("ix_wordpress_status_events_article_id"),
        "wordpress_status_events",
        ["article_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_wordpress_status_events_integration_id"),
        "wordpress_status_events",
        ["integration_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_wordpress_status_events_integration_id"), table_name="wordpress_status_events")
    op.drop_index(op.f("ix_wordpress_status_events_article_id"), table_name="wordpress_status_events")
    op.drop_table("wordpress_status_events")
    op.drop_index(op.f("ix_wordpress_request_nonces_integration_id"), table_name="wordpress_request_nonces")
    op.drop_table("wordpress_request_nonces")
    op.drop_index(op.f("ix_wordpress_connect_states_expires_at"), table_name="wordpress_connect_states")
    op.drop_table("wordpress_connect_states")
    op.drop_table("wordpress_integrations")
    op.drop_column("articles", "wp_link")
    op.drop_column("articles", "wp_post_id")
