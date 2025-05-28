from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class ImportJob(Base):
    __tablename__ = "import_jobs"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    status = Column(String, default="processing")
    total = Column(Integer, default=0)
    completed = Column(Integer, default=0)
    file_name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Contact(Base):
    __tablename__ = "contacts"
    
    id = Column(String, primary_key=True)
    job_id = Column(String, ForeignKey("import_jobs.id"))
    first_name = Column(String)
    last_name = Column(String)
    company = Column(String)
    position = Column(String)
    industry = Column(String)
    location = Column(String)
    profile_url = Column(String)
    
    # Enrichment results
    email = Column(String)
    phone = Column(String)
    enriched = Column(Boolean, default=False)
    enrichment_status = Column(String, default="pending")
    enrichment_score = Column(Float)
    enrichment_provider = Column(String)
    
    # Verification results
    email_verified = Column(Boolean, default=False)
    email_verification_score = Column(Float)
    phone_verified = Column(Boolean, default=False)
    phone_type = Column(String)
    
    # Quality flags
    is_disposable = Column(Boolean, default=False)
    is_role_based = Column(Boolean, default=False)
    
    # Cost tracking
    credits_consumed = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CreditLog(Base):
    __tablename__ = "credit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False)
    provider = Column(String)
    cost = Column(Float, nullable=False)
    reason = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow) 