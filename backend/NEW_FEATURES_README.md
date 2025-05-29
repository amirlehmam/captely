# CAPTELY - New Features Implementation Guide

## 🚀 Features Implemented (30% Completion)

### 1. 💰 Advanced Package & Subscription System

#### Features:
- **4 Subscription Tiers**: Free, Starter ($49/mo), Professional ($149/mo), Enterprise ($499/mo)
- **Package-Based Limits**: Daily/monthly enrichment limits per provider
- **Credit Rollover**: Professional and Enterprise plans support credit rollover
- **One-Time Credit Packages**: Purchase additional credits as needed

#### API Endpoints:
```bash
# Get all packages
GET http://localhost:8007/api/packages

# Create subscription
POST http://localhost:8007/api/subscriptions
{
  "package_id": "uuid",
  "billing_cycle": "monthly|yearly",
  "start_trial": true
}

# Purchase credit package
POST http://localhost:8007/api/credit-packages/purchase
{
  "package_id": "uuid",
  "payment_method_id": "uuid"
}
```

### 2. 🏢 Internal CRM System

#### Features:
- **Contact Management**: Full CRUD operations with tagging and custom fields
- **Activity Tracking**: Log emails, calls, meetings, notes, and tasks
- **Campaign Management**: Create and manage multi-channel outreach campaigns
- **Lead Scoring**: Automatic and manual lead scoring
- **Analytics Dashboard**: Track contact status, activities, and campaign performance

#### API Endpoints:
```bash
# Contact Management
POST http://localhost:8008/api/crm/contacts
GET http://localhost:8008/api/crm/contacts?status=new&tags=prospect
PUT http://localhost:8008/api/crm/contacts/{contact_id}

# Import from enrichment
POST http://localhost:8008/api/crm/contacts/import
{
  "job_id": "enrichment_job_id",
  "default_tags": ["imported", "to_contact"]
}

# Activities
POST http://localhost:8008/api/crm/activities
{
  "contact_id": "uuid",
  "type": "email",
  "subject": "Follow-up",
  "content": "Email content..."
}

# Campaigns
POST http://localhost:8008/api/crm/campaigns
{
  "name": "Q1 Outreach",
  "type": "email",
  "from_email": "sales@company.com",
  "subject_lines": ["Subject 1", "Subject 2"],
  "email_templates": ["Template 1", "Template 2"]
}
```

### 3. 🔌 Real CRM Integrations

#### Implemented Integrations:
1. **HubSpot**: Full contact creation and update
2. **Salesforce**: Lead creation with field mapping
3. **Lemlist**: Add to campaigns with custom fields
4. **Smartlead**: Prospect management
5. **Outreach**: Create prospects with metadata
6. **Zapier**: Webhook triggers for any integration

#### API Usage:
```bash
# HubSpot Export
POST http://localhost:8004/api/integrations/hubspot
{
  "job_id": "enrichment_job_id",
  "mapping": {
    "first_name": "firstname",
    "last_name": "lastname",
    "company": "company"
  },
  "config": {
    "api_key": "your_hubspot_key"
  }
}

# Salesforce Export
POST http://localhost:8004/api/integrations/salesforce
{
  "job_id": "enrichment_job_id",
  "config": {
    "instance_url": "https://your-instance.salesforce.com",
    "access_token": "your_access_token"
  }
}
```

### 4. 💳 Billing & Payment Processing

#### Features:
- **Stripe Integration**: Secure payment processing
- **Payment Methods**: Credit card, PayPal support
- **Billing History**: Complete transaction logs
- **Auto-renewal**: Subscription management
- **Trial Periods**: 14-day free trial for new users

#### Database Schema:
```sql
-- Key tables added:
- packages (subscription tiers)
- user_subscriptions (active subscriptions)
- payment_methods (stored payment methods)
- billing_transactions (payment history)
- credit_packages (one-time purchases)
```

### 5. 🎯 Enhanced Credit System

#### Features:
- **Provider-Specific Limits**: Control usage per enrichment provider
- **Daily/Monthly Caps**: Prevent overspending
- **Real-Time Validation**: Check limits before enrichment
- **Detailed Usage Analytics**: Track spending by provider

#### Credit Check Logic:
```python
# The system now checks:
1. Basic credit balance
2. Daily enrichment limit
3. Monthly provider limits
4. Package-specific restrictions
```

## 🛠️ Setup Instructions

### 1. Database Migration
```bash
# Apply new schema
docker exec captely-db psql -U postgres -d postgres -f /migrations/add_packages_crm_billing.sql
```

### 2. Environment Variables
Add these to your `.env`:
```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# CRM API Keys (optional)
HUBSPOT_API_KEY=...
SALESFORCE_CLIENT_ID=...
SALESFORCE_CLIENT_SECRET=...
```

### 3. Start New Services
```bash
# Start all services including new ones
docker-compose up -d

# New services:
# - Billing Service: http://localhost:8007
# - CRM Service: http://localhost:8008
```

## 📊 Package Details

### Free Plan
- 100 credits/month
- 50 daily enrichment limit
- IcyPeas only
- 1 import, 100 contacts max

### Starter ($49/mo)
- 1,000 credits/month
- 500 daily limit
- IcyPeas, Dropcontact, Hunter
- 10 imports, 5,000 contacts

### Professional ($149/mo)
- 5,000 credits/month (with rollover)
- 2,000 daily limit
- All providers including Apollo
- Unlimited imports, 50,000 contacts
- Team collaboration (5 members)

### Enterprise ($499/mo)
- 20,000 credits/month (with rollover)
- 10,000 daily limit
- All providers with higher limits
- Unlimited everything
- Dedicated support & SLA

## 🔄 Integration Configuration

### Save Integration Credentials
```sql
-- Integrations are stored per user
INSERT INTO integration_configs (user_id, provider, api_key, config)
VALUES (
  'user_uuid',
  'hubspot',
  'encrypted_api_key',
  '{"portal_id": "12345"}'
);
```

### Webhook Setup
```bash
POST http://localhost:8008/api/webhooks
{
  "name": "Enrichment Complete",
  "url": "https://hooks.zapier.com/...",
  "events": ["contact.enriched", "job.completed"],
  "secret_key": "webhook_secret"
}
```

## 🎨 Frontend Integration

The frontend needs to be updated to support:

1. **Billing Pages**:
   - Package selection
   - Payment method management
   - Billing history
   - Subscription management

2. **CRM Module**:
   - Contact list/grid view
   - Contact detail page
   - Activity timeline
   - Campaign builder

3. **Integration Settings**:
   - API key management
   - Field mapping UI
   - Sync configuration

## 🧪 Testing

### Test Credit System
```python
# Test package limits
python test_credit_limits.py

# Test billing flow
python test_billing.py
```

### Test CRM
```bash
# Import test data
curl -X POST http://localhost:8008/api/crm/contacts/import \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"job_id": "test_job", "default_tags": ["test"]}'
```

### Test Integrations
```bash
# Test HubSpot integration
python test_integrations.py --provider hubspot
```

## 📝 Notes

1. **Security**: All API keys are encrypted in the database
2. **Rate Limiting**: Integrations respect provider rate limits
3. **Error Handling**: Comprehensive error logging and retry logic
4. **Scalability**: Services are independently scalable

## 🚦 Status

- ✅ Database schema updated
- ✅ Billing service implemented
- ✅ CRM service implemented
- ✅ Credit system enhanced
- ✅ Real CRM integrations
- ⏳ Frontend updates needed
- ⏳ Payment provider setup needed

## 🤝 Next Steps

1. Configure Stripe account
2. Set up OAuth for Salesforce
3. Update frontend components
4. Add email campaign execution
5. Implement usage analytics dashboard

---

**Congratulations!** You now have a complete B2B enrichment platform with enterprise features. The remaining 30% is mainly frontend work and payment provider configuration. 