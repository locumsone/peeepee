
# Instantly 2.0 Migration Plan

## ✅ COMPLETED - Code Migration

The following edge functions have been updated to use Instantly API v2:

### Updated Files

| File | Change |
|------|--------|
| `supabase/functions/check-integrations/index.ts` | ✅ Updated to `GET /api/v2/accounts` |
| `supabase/functions/launch-campaign/index.ts` | ✅ Updated to v2 endpoints: campaigns, leads, activate |

### API Changes Implemented

| Action | Old v1 Endpoint | New v2 Endpoint |
|--------|-----------------|-----------------|
| List accounts | `GET /api/v1/account/list` | `GET /api/v2/accounts` |
| Create campaign | `POST /api/v1/campaign/create` | `POST /api/v2/campaigns` |
| Add leads | `POST /api/v1/lead/add` (one at a time) | `POST /api/v2/leads` (batch) |
| Activate | `POST /api/v1/campaign/launch` | `POST /api/v2/campaigns/{id}/activate` |

### Key Improvements in v2

- **Batch lead import**: v2 now supports adding multiple leads in a single API call
- **Full schedule config**: Campaign schedules are now configured during creation
- **Cleaner payload structure**: Custom variables moved to `payload` object

---

## ⚠️ STILL NEEDED - Instantly Dashboard Setup

### 1. Add Email Accounts in Instantly Dashboard

Go to [app.instantly.ai](https://app.instantly.ai) → Email Accounts → Add Account

**Required sender emails:**
- rainey@locums.one, rainey@trylocumsone.com
- parker@locums.one, parker@trylocumsone.com  
- ali@trylocumsone.com, ali@meetlocumsone.com
- gio@locums.one, gio@trylocumsone.com

### 2. Configure Webhook

In Instantly Dashboard → Settings → Webhooks, add:
- **URL**: `https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/instantly-webhook`
- **Events**: email_sent, email_opened, email_clicked, email_replied, email_bounced

### 3. Enable Warmup

For each connected email account, enable warmup to improve deliverability.

---

## Status

- ✅ API key updated to v2
- ✅ Edge functions migrated
- ⏳ Email accounts need to be added in Instantly dashboard
- ⏳ Webhook URL needs to be configured
