from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, ForeignKey, DateTime, func, Boolean

class Base(DeclarativeBase): pass

class ImportJob(Base):
    __tablename__ = "import_jobs"
    id: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    total: Mapped[int]
    completed: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="processing")
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

class Contact(Base):
    __tablename__ = "contacts"
    id:           Mapped[int]    = mapped_column(primary_key=True, autoincrement=True)
    job_id:       Mapped[str]    = mapped_column(ForeignKey("import_jobs.id", ondelete="CASCADE"))
    first_name:   Mapped[str]    = mapped_column(String)
    last_name:    Mapped[str | None]
    company:      Mapped[str]
    linkedin_url: Mapped[str | None]
    email:        Mapped[str | None]
    phone:        Mapped[str | None]
    enriched:     Mapped[bool]    = mapped_column(Boolean, default=False)

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, default=0)
    plan: Mapped[str] = mapped_column(String, default="free")
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    invoices = relationship("Invoice", backref="user")
    credit_logs = relationship("CreditLog", backref="user")

class CreditLog(Base):
    __tablename__ = "credit_logs"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    change: Mapped[int] = mapped_column(Integer)  # positive or negative
    reason: Mapped[str] = mapped_column(String)
    job_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    paid_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)
