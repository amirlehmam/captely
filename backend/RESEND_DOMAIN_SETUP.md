# 📧 Resend Domain Verification Setup for captely.com

## Quick Steps

### 1. Add Domain in Resend Dashboard
1. Go to [Resend Domains](https://resend.com/domains)
2. Click "Add Domain"
3. Enter: `captely.com`
4. Click "Add"

### 2. Add DNS Records in OVH (Your DNS Provider)

Resend will show you specific DNS records to add. You need to add these **exact records** in your OVH DNS management:

#### Required DNS Records (will be shown in Resend):
1. **DKIM Record** (TXT):
   - **Type**: TXT
   - **Host/Name**: `resend._domainkey`
   - **Value**: `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...` (Resend will provide this)
   - **TTL**: Auto

2. **SPF Record** (TXT):
   - **Type**: TXT  
   - **Host/Name**: `send` or `mail`
   - **Value**: `v=spf1 include:resend.com ~all`
   - **TTL**: Auto

3. **DMARC Record** (TXT):
   - **Type**: TXT
   - **Host/Name**: `_dmarc`
   - **Value**: `v=DMARC1; p=none;`
   - **TTL**: Auto

### 3. How to Add Records in OVH

1. **Login to OVH Manager**: Go to https://www.ovh.com/manager/
2. **Select Domain**: Click on `captely.com`
3. **DNS Zone**: Go to "DNS Zone" tab
4. **Add Record**: Click "Add an entry"
5. **Add Each Record**: Add the TXT records one by one with the exact values from Resend

### 4. Update Auth Service Email Configuration

Once domain is verified, update the email sender in the auth service:

```python
# In /backend/services/auth-service/app/main.py
# Change this line (around line 270):
params = {
    "from": "Captely <noreply@captely.com>",  # Use your verified domain
    "to": [email],
    "subject": "🔐 Verify your Captely account",
    # ... rest of email config
}
```

### 5. Wait for DNS Propagation
- DNS changes can take 24-48 hours to propagate
- You can check status in Resend dashboard
- Use [DNS Checker](https://dnschecker.org/) to verify records

### 6. Test Domain Verification
1. In Resend dashboard, click "Verify" on your domain
2. If all records are correctly added, verification will succeed
3. You can now send emails from `@captely.com` addresses

## Alternative: Quick Fix for Testing

If you want to test immediately, you can temporarily use the default Resend domain:

```python
# Temporary fix in auth service main.py:
params = {
    "from": "Captely <onboarding@resend.dev>",  # Default domain for testing
    "reply_to": "support@captely.com",  # Your actual support email
    # ... rest of config
}
```

**But you should set up the domain verification for production!**

## DNS Records Summary for OVH

Your current DNS setup:
```
captely.com     A       164.90.232.146
www.captely.com A       164.90.232.146  
captely.com     MX      1 mx1.mail.ovh.net
captely.com     MX      5 mx2.mail.ovh.net
captely.com     MX      100 mx3.mail.ovh.net
```

**Add these new TXT records** (exact values from Resend dashboard):
```
resend._domainkey.captely.com  TXT  [DKIM key from Resend]
send.captely.com               TXT  v=spf1 include:resend.com ~all
_dmarc.captely.com            TXT  v=DMARC1; p=none;
```

## Expected Timeline
- **Add DNS records**: 5 minutes
- **DNS propagation**: 1-24 hours  
- **Domain verification**: Immediate once propagated
- **Email sending**: Works immediately after verification

## Support
If you need help with OVH DNS management:
- OVH Support: https://help.ovh.com/
- DNS Records Guide: https://docs.ovh.com/us/en/domains/web_hosting_how_to_edit_my_dns_zone/

Once you add the DNS records and the domain is verified, email verification will work perfectly! 🚀 