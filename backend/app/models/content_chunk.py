from datetime import datetime
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ContentChunk(Base):
    __tablename__ = "content_chunks"

    __table_args__ = (
        UniqueConstraint(
            "page_id",
            "chunk_index",
            name="uq_content_chunks_page_chunk_index",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    page_id: Mapped[int] = mapped_column(
        ForeignKey(
            "website_pages.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        LONGTEXT,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )