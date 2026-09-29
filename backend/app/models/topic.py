from datetime import datetime
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base
from sqlalchemy.orm import relationship


class Topic(Base):

    __tablename__ = "topics"


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


    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )


    keyword_ideas: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
    )


    search_intent: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )


    business_value: Mapped[str] = mapped_column(
        String(100),
        nullable=True,
    )


    priority_score: Mapped[float] = mapped_column(
        Float,
        nullable=True
    )


    reasoning: Mapped[str] = mapped_column(
        String(1000),
        nullable=True,
    )


    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
    )


    priority_level: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )


    keyword_metrics = relationship(
        "KeywordMetric",
        back_populates="topic",
        cascade="all, delete",
    )


    articles = relationship(
        "Article",
        back_populates="topic",
        cascade="all, delete",
    )