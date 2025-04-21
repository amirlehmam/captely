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
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("import_jobs.id", ondelete="CASCADE"))
    first_name: Mapped[str] = mapped_column(String)
    last_name: Mapped[str | None]
    company: Mapped[str]
    linkedin_url: Mapped[str | None]
    email: Mapped[str | None]
    phone: Mapped[str | None]
    enriched: Mapped[Boolean] = mapped_column(default=False)
