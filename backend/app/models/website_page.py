from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WebsitePage(Base):
    __tablename__ = "website_pages"

    __table_args__ = (
        UniqueConstraint(
            "website_id",
            "url",
            name="uq_website_pages_website_url",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    website_id: Mapped[int] = mapped_column(
        ForeignKey("websites.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    url: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
    )

    title: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    status_code: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        LONGTEXT,
        nullable=False,
    )

    crawled_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )