from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WordPressConnectState(Base):
    __tablename__ = "wordpress_connect_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(
        String(64).with_variant(String(64, collation="ascii_bin"), "mysql"), unique=True
    )
    site_url: Mapped[str] = mapped_column(String(512), nullable=False)
    return_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    correlation_id: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
