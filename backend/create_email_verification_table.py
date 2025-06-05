#!/usr/bin/env python3

"""
Script to create the EmailVerification table in the database
"""

import asyncio
from sqlalchemy import create_engine, text
import os

async def create_email_verification_table():
    try:
        # Database URL for local development
        DATABASE_URL = 'postgresql://postgres:postgrespw@localhost:5432/postgres'
        
        # Create engine (non-async for simple table creation)
        engine = create_engine(DATABASE_URL)
        
        # Create EmailVerification table
        with engine.begin() as conn:
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS email_verifications (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email VARCHAR NOT NULL,
                    code VARCHAR(6) NOT NULL,
                    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    verified BOOLEAN DEFAULT FALSE NOT NULL,
                    attempts INTEGER DEFAULT 0 NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
                );
                
                CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
            '''))
            
            print('✅ EmailVerification table created successfully')
            
    except Exception as e:
        print(f'❌ Error creating EmailVerification table: {e}')

if __name__ == "__main__":
    asyncio.run(create_email_verification_table()) 