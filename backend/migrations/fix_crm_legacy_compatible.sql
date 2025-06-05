-- Legacy PostgreSQL Compatible CRM Fix
-- Works with PostgreSQL 9.1+ by avoiding IF NOT EXISTS syntax

-- 1. First, safely check and drop existing types
-- Use individual DO blocks for maximum compatibility

DO $$
BEGIN
    EXECUTE 'DROP TYPE activitytype CASCADE';
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'DROP TYPE activitystatus CASCADE';
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'DROP TYPE priority CASCADE';
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'DROP TYPE activitypriority CASCADE';
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'DROP TYPE campaignstatus CASCADE';
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'DROP TYPE contactstatus CASCADE';
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- 2. Drop existing tables safely
DO $$
BEGIN
    EXECUTE 'DROP TABLE crm_activities CASCADE';
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'DROP TABLE crm_campaigns CASCADE';
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- 3. Create enum types (the exact names the CRM service expects)
CREATE TYPE activitytype AS ENUM ('call', 'email', 'meeting', 'task', 'note', 'follow_up');
CREATE TYPE activitystatus AS ENUM ('pending', 'completed', 'cancelled', 'overdue');
CREATE TYPE priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE campaignstatus AS ENUM ('draft', 'active', 'paused', 'completed');
CREATE TYPE contactstatus AS ENUM ('new', 'contacted', 'qualified', 'customer', 'lost');

-- 4. Create CRM Activities table
CREATE TABLE crm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type activitytype NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    contact_id UUID,
    status activitystatus DEFAULT 'pending',
    priority priority DEFAULT 'medium',
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    assigned_to VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Create CRM Campaigns table
CREATE TABLE crm_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'email',
    status campaignstatus DEFAULT 'draft',
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    total_contacts INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Add foreign key constraint safely
DO $$
BEGIN
    EXECUTE 'ALTER TABLE crm_activities ADD CONSTRAINT fk_activities_contact_id FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL';
EXCEPTION
    WHEN OTHERS THEN 
        RAISE NOTICE 'Could not add foreign key constraint (crm_contacts table may not exist)';
END $$;

-- 7. Create indexes
CREATE INDEX idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX idx_crm_activities_type ON crm_activities(type);
CREATE INDEX idx_crm_activities_status ON crm_activities(status);
CREATE INDEX idx_crm_activities_priority ON crm_activities(priority);
CREATE INDEX idx_crm_activities_due_date ON crm_activities(due_date);
CREATE INDEX idx_crm_activities_created_at ON crm_activities(created_at DESC);

CREATE INDEX idx_crm_campaigns_status ON crm_campaigns(status);
CREATE INDEX idx_crm_campaigns_type ON crm_campaigns(type);
CREATE INDEX idx_crm_campaigns_created_at ON crm_campaigns(created_at DESC);

-- 8. Insert sample campaigns
INSERT INTO crm_campaigns (id, name, type, status, from_email, from_name, total_contacts, sent_count, open_count, click_count, reply_count) VALUES
    ('00000000-0000-0000-0006-000000000001', 'Q2 Product Launch Campaign', 'email', 'active', 'marketing@captely.com', 'Captely Marketing', 1500, 1200, 420, 85, 24),
    ('00000000-0000-0000-0006-000000000002', 'Enterprise Outreach', 'email', 'active', 'sales@captely.com', 'Captely Sales', 300, 280, 145, 32, 8),
    ('00000000-0000-0000-0006-000000000003', 'Customer Feedback Survey', 'email', 'completed', 'success@captely.com', 'Captely Success', 850, 850, 380, 127, 89),
    ('00000000-0000-0000-0006-000000000004', 'New Feature Announcement', 'email', 'draft', 'product@captely.com', 'Captely Product', 0, 0, 0, 0, 0);

-- 9. Insert sample activities
INSERT INTO crm_activities (type, title, description, status, priority, due_date, created_by, assigned_to) VALUES
    ('task', 'Review quarterly sales reports', 'Analyze Q4 performance and prepare for Q1 planning', 'pending', 'high', NOW() + INTERVAL '1 day', 'system', 'sales_team'),
    ('meeting', 'Team standup meeting', 'Daily team sync and progress updates', 'completed', 'low', NOW() - INTERVAL '1 day', 'system', 'sales_team'),
    ('email', 'Send welcome email to new leads', 'Template-based welcome sequence for new sign-ups', 'pending', 'medium', NOW() + INTERVAL '2 days', 'system', 'marketing_team'),
    ('call', 'Follow-up call with prospects', 'Discuss their business needs and our solutions', 'pending', 'medium', NOW() + INTERVAL '3 days', 'system', 'sales_team'),
    ('follow_up', 'Check in with trial users', 'Send feedback survey and offer support', 'pending', 'low', NOW() + INTERVAL '7 days', 'system', 'marketing_team'),
    ('note', 'Client feedback on latest features', 'Positive response to new dashboard, requested mobile app', 'completed', 'medium', NULL, 'system', 'product_team');

-- 10. Update crm_contacts status column if table exists
DO $$
BEGIN
    ALTER TABLE crm_contacts ALTER COLUMN status TYPE contactstatus USING status::contactstatus;
    RAISE NOTICE 'Successfully updated crm_contacts.status to use contactstatus enum';
EXCEPTION
    WHEN undefined_table THEN 
        RAISE NOTICE 'crm_contacts table does not exist, skipping status column update';
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not convert crm_contacts.status to enum, keeping as VARCHAR: %', SQLERRM;
END $$;

-- 11. Verification
SELECT 'Legacy compatible CRM schema setup complete' as status;

DO $$
DECLARE
    activity_count INTEGER;
    campaign_count INTEGER;
    contact_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO activity_count FROM crm_activities;
    SELECT COUNT(*) INTO campaign_count FROM crm_campaigns;
    
    -- Handle case where crm_contacts doesn't exist
    BEGIN
        SELECT COUNT(*) INTO contact_count FROM crm_contacts;
    EXCEPTION
        WHEN undefined_table THEN 
            contact_count := 0;
    END;
    
    RAISE NOTICE 'Total activities: %', activity_count;
    RAISE NOTICE 'Total campaigns: %', campaign_count;
    RAISE NOTICE 'Total contacts: %', contact_count;
    RAISE NOTICE 'All enum types created successfully';
END $$; 