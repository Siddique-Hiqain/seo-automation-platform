from datetime import datetime
from sqlalchemy import (
    DateTime,
    ForeignKey,
    String,
    Text,
    JSON,
    func,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)
from app.db.base import Base


class Article(Base):

    __tablename__ = "articles"


    id: Mapped[int] = mapped_column(
        primary_key=True
    )


    website_id: Mapped[int] = mapped_column(
        ForeignKey(
            "websites.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True,
    )


    topic_id: Mapped[int] = mapped_column(
        ForeignKey(
            "topics.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True,
    )


    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )


    slug: Mapped[str] = mapped_column(
        String(500),
        nullable=True,
    )


    meta_title: Mapped[str] = mapped_column(
        String(500),
        nullable=True,
    )


    meta_description: Mapped[str] = mapped_column(
        String(1000),
        nullable=True,
    )


    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )


    faq: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
    )


    status: Mapped[str] = mapped_column(
        String(50),
        default="draft",
    )


    wp_post_id: Mapped[int | None] = mapped_column(
        nullable=True,
    )


    wp_link: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )


    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
    )


    topic = relationship(
        "Topic",
        back_populates="articles"
    )
