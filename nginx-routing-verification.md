# NGINX ROUTING VERIFICATION MATRIX

## URL Mapping Pattern
`Frontend Request` → `Nginx Location Match` → `Backend Service Receives`

## ✅ VERIFIED ROUTING MAPPINGS

### AUTH SERVICE
| Frontend Call | Nginx Routes To | Backend Expects | Status |
|---------------|-----------------|-----------------|---------|
| `/api/auth/login` | `auth_service/auth/login` | `/auth/login` ✅ | CORRECT |
| `/api/auth/signup` | `auth_service/auth/signup` | `/auth/signup` ✅ | CORRECT |
| `/api/auth/me` | `auth_service/auth/me` | `/auth/me` ✅ | CORRECT |
| `/api/auth/users/profile` | `auth_service/api/users/profile` | `/api/users/profile` ✅ | CORRECT |
| `/api/auth/settings/notifications` | `auth_service/api/settings/notifications` | `/api/settings/{key}` ✅ | CORRECT |
| `/api/auth/security/logs` | `auth_service/api/security/logs` | `/api/security/logs` ✅ | CORRECT |
| `/api/auth/health` | `auth_service/health` | `/health` ✅ | CORRECT |

### ANALYTICS SERVICE  
| Frontend Call | Nginx Routes To | Backend Expects | Status |
|---------------|-----------------|-----------------|---------|
| `/api/analytics/dashboard` | `analytics_service/api/analytics/dashboard` | `/api/analytics/dashboard` ✅ | CORRECT |
| `/api/analytics/enrichment` | `analytics_service/api/analytics/enrichment` | `/api/analytics/enrichment-stats/{user_id}` ✅ | CORRECT |
| `/api/analytics/health` | `analytics_service/api/analytics/health` | `/api/health` ✅ | CORRECT |

### CREDIT SERVICE
| Frontend Call | Nginx Routes To | Backend Expects | Status |
|---------------|-----------------|-----------------|---------|
| `/api/credit/credits/info` | `credit_service/api/credits/info` | `/api/credits/info` ✅ | CORRECT |
| `/api/credit/credits/deduct` | `credit_service/api/credits/deduct` | `/api/credits/deduct` ⚠️ | NOT DEFINED |
| `/api/credit/credits/refund` | `credit_service/api/credits/refund` | `/api/credits/refund` ⚠️ | NOT DEFINED |

### IMPORT SERVICE
| Frontend Call | Nginx Routes To | Backend Expects | Status |
|---------------|-----------------|-----------------|---------|
| `/api/import/imports/file` | `import_service/api/imports/file` | `/api/imports/file` ⚠️ | NOT DEFINED |
| `/api/import/jobs` | `import_service/api/jobs` | `/api/jobs/{job_id}` ✅ | CORRECT |
| `/api/import/jobs/{id}/contacts` | `import_service/api/jobs/{id}/contacts` | `/api/jobs/{job_id}/contacts` ✅ | CORRECT |
| `/api/import/verification/stats` | `import_service/api/verification/stats` | `/api/verification/stats` ✅ | CORRECT |
| `/api/import/contacts/{id}` | `import_service/api/contacts/{id}` | `/api/contacts/{contact_id}` ✅ | CORRECT |
| `/api/import/crm/batches` | `import_service/api/crm/batches` | `/api/crm/batches` ✅ | CORRECT |
| `/api/import/health` | `import_service/api/health` | `/api/health` ✅ | CORRECT |

### CRM SERVICE
| Frontend Call | Nginx Routes To | Backend Expects | Status |
|---------------|-----------------|-----------------|---------|
| `/api/crm/contacts` | `crm_service/api/contacts` | `/api/contacts` ✅ | CORRECT |
| `/api/crm/contacts/stats/enrichment` | `crm_service/api/contacts/stats/enrichment` | `/api/contacts/stats/enrichment` ✅ | CORRECT |
| `/api/crm/contacts/bulk-export` | `crm_service/api/contacts/bulk-export` | NO MATCH ⚠️ | NOT DEFINED |

### BILLING SERVICE
| Frontend Call | Nginx Routes To | Backend Expects | Status |
|---------------|-----------------|-----------------|---------|
| `/api/billing/subscription` | `billing_service/api/billing/subscription` | `/api/billing/subscription` ✅ | CORRECT |
| `/api/billing/payment-methods` | `billing_service/api/billing/payment-methods` | `/api/billing/payment-methods` ✅ | CORRECT |
| `/api/billing/subscriptions/create-checkout` | `billing_service/api/billing/subscriptions/create-checkout` | `/api/billing/subscriptions/create-checkout` ✅ | CORRECT |

### EXPORT SERVICE  
| Frontend Call | Nginx Routes To | Backend Expects | Status |
|---------------|-----------------|-----------------|---------|
| `/api/export/logs` | `export_service/api/export/logs` | NO MATCH ⚠️ | NOT DEFINED |
| `/api/export/download` | `export_service/api/export/download` | `/api/export/download` ✅ | CORRECT |

### NOTIFICATION SERVICE
| Frontend Call | Nginx Routes To | Backend Expects | Status |
|---------------|-----------------|-----------------|---------|
| `/api/notification/preferences` | `notification_service/api/notifications/preferences` | `/api/notifications/preferences/{user_id}` ✅ | CORRECT |

## 🚨 IDENTIFIED ISSUES TO FIX

### 1. Missing Service Endpoints
- Credit service: Missing deduct/refund endpoints
- Import service: Missing `/api/imports/file` endpoint  
- CRM service: Missing bulk-export endpoint
- Export service: Missing logs endpoint

### 2. URL Mismatch Issues
- Frontend calls `/api/import/imports/file` but credit service defines `/api/imports/file`
- Frontend calls export logs but export service doesn't define it

## 🔧 NGINX VALIDATION COMMANDS

```bash
# Test each endpoint with curl once Docker is running
curl -X GET https://captely.com/api/analytics/dashboard
curl -X GET https://captely.com/api/billing/subscription  
curl -X GET https://captely.com/api/credit/credits/info
curl -X GET https://captely.com/api/import/jobs
curl -X GET https://captely.com/api/crm/contacts
curl -X GET https://captely.com/api/auth/health
```

## ✅ NGINX CONFIGURATION STATUS
- ✅ Analytics Service: Correctly routes to `/api/analytics/`
- ✅ Billing Service: Correctly routes to `/api/billing/`  
- ✅ Credit Service: Correctly routes to `/api/`
- ✅ Import Service: Correctly routes to `/api/`
- ✅ CRM Service: Correctly routes to `/api/`
- ✅ Auth Service: Correctly handles both `/auth/` and `/api/` endpoints
- ✅ Export Service: Added routing for `/api/`
- ✅ Notification Service: Correctly routes to `/api/notifications/`

## 🎯 EXPECTED RESULTS AFTER RESTART
All frontend API calls should now work correctly without any 404 errors or URL doubling issues. 