from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WordPressRequestNonce(Base):
    __tablename__ = "wordpress_request_nonces"
    __table_args__ = (UniqueConstraint("integration_id", "nonce_hash", name="uq_wordpress_request_nonce"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    integration_id: Mapped[int] = mapped_column(
        ForeignKey("wordpress_integrations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nonce_hash: Mapped[str] = mapped_column(
        String(64).with_variant(String(64, collation="ascii_bin"), "mysql"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
