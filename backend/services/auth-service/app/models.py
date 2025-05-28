# services/auth-service/app/models.py
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

# Define a single Base class
class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, default=100, nullable=True)
    total_spent: Mapped[float] = mapped_column(Float, default=0, nullable=True)
    daily_limit: Mapped[int] = mapped_column(Integer, nullable=True)
    monthly_limit: Mapped[int] = mapped_column(Integer, nullable=True)
    provider_limits: Mapped[dict] = mapped_column(JSONB, nullable=True)
    notification_preferences: Mapped[dict] = mapped_column(JSONB, nullable=True)
    last_credit_alert: Mapped[DateTime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ApiKey(Base):
    __tablename__ = "api_keys"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)