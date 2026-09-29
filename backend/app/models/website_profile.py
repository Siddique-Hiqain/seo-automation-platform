from datetime import datetime
from sqlalchemy import (
    DateTime,
    ForeignKey,
    JSON,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class WebsiteProfile(Base):

    __tablename__ = "website_profiles"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    website_id: Mapped[int] = mapped_column(
        ForeignKey(
            "websites.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        unique=True,
        index=True,
    )

    profile_data: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )