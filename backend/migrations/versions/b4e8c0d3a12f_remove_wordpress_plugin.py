"""Remove plugin callbacks and use direct WordPress REST credentials.

Revision ID: b4e8c0d3a12f
Revises: 7d2f9c1a4b6e
"""

from typing import Sequence, Union

from alembic import op


revision: str = "b4e8c0d3a12f"
down_revision: Union[str, Sequence[str], None] = "7d2f9c1a4b6e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The plugin revokes its Application Password when deactivated; do not keep
    # showing its former connection as usable or retain its encrypted secret.
    op.execute(
        "UPDATE wordpress_integrations SET status = 'disconnected', "
        "application_password_encrypted = NULL, disconnected_at = CURRENT_TIMESTAMP"
    )
    # Dropping each child table also removes its indexes and foreign keys.
    # MySQL rejects dropping a foreign-key-supporting index while the table exists.
    op.drop_table("wordpress_status_events")
    op.drop_table("wordpress_request_nonces")
    op.drop_table("wordpress_connect_states")

    with op.batch_alter_table("wordpress_integrations") as batch_op:
        batch_op.drop_column("admin_url")
        batch_op.drop_column("shared_secret_encrypted")
        batch_op.drop_column("seo_plugin")
        batch_op.drop_column("permalink_structure")
        batch_op.drop_column("plugin_version")
        batch_op.drop_column("capabilities")


def downgrade() -> None:
    raise NotImplementedError("Plugin credentials and callback data cannot be restored after this migration.")
