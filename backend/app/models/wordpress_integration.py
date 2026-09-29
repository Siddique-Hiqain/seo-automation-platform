from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WordPressIntegration(Base):
    __tablename__ = "wordpress_integrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    website_id: Mapped[int] = mapped_column(
        ForeignKey("websites.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    base_url: Mapped[str] = mapped_column(String(512), nullable=False)
    rest_url: Mapped[str] = mapped_column(String(512), nullable=False)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    application_password_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="connected")
    connected_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    disconnected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
