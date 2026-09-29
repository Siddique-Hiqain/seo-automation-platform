from datetime import datetime
from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class Website(Base):
    __tablename__ = "websites"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    url: Mapped[str] = mapped_column(
        String(512),
        unique=True,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="pending",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )