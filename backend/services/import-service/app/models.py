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
    file_name: Mapped[str | None] = mapped_column(String, nullable=True)
    mapping: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String, default="csv")
    contacts = relationship("Contact", backref="job")

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
    enriched: Mapped[bool] = mapped_column(Boolean, default=False)
    enrichment_status: Mapped[str] = mapped_column(String, default="pending")
    enrichment_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    enrichment_provider: Mapped[str | None] = mapped_column(String, nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    enrichment_results = relationship("EnrichmentResult", backref="contact")

class EnrichmentResult(Base):
    __tablename__ = "enrichment_results"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    contact_id: Mapped[int] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"))
    provider: Mapped[str] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
