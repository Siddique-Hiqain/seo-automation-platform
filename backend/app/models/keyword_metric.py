from datetime import datetime
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Float,
    JSON,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base
from sqlalchemy.orm import relationship


class KeywordMetric(Base):

    __tablename__ = "keyword_metrics"


    id: Mapped[int] = mapped_column(
        primary_key=True
    )


    topic_id: Mapped[int] = mapped_column(
        ForeignKey(
            "topics.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True,
    )


    keyword: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )


    search_volume: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )


    keyword_difficulty: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )


    cpc: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )


    competition: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )


    serp_data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )


    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
    )


    topic = relationship(
        "Topic",
        back_populates="keyword_metrics",
    )