
# Instantly 2.0 Migration Plan

## Current Situation

Your codebase is currently using **Instantly API v1** endpoints, which are being **deprecated on January 19, 2026**. Since you've created a new Instantly account with a v2 API key, the following updates are required.

---

## What Needs to Be Configured

### 1. Edge Functions Migration to API v2

The following edge functions use the old v1 endpoints and need updating:

| Function | Current v1 Endpoint | New v2 Endpoint |
|----------|---------------------|-----------------|
| `launch-campaign` | `POST /api/v1/campaign/create` | `POST /api/v2/campaigns` |
| `launch-campaign` | `POST /api/v1/lead/add` | `POST /api/v2/leads` |
| `launch-campaign` | `POST /api/v1/campaign/launch` | `POST /api/v2/campaigns/{id}/activate` |
| `check-integrations` | `GET /api/v1/account/list` | `GET /api/v2/accounts` |

### 2. Email Accounts in Instantly Dashboard

You need to add your sender email accounts in the Instantly dashboard:

**Current hardcoded accounts in the app:**
- rainey@locums.one, rainey@trylocumsone.com, etc.
- parker@locums.one, parker@trylocumsone.com, etc.
- ali@trylocumsone.com, ali@meetlocumsone.com, etc.
- gio@locums.one, gio@trylocumsone.com, etc.

**Action Required:**
1. Go to Instantly dashboard and add each sender account
2. Connect each email via OAuth (Google or Microsoft) or SMTP
3. Enable warmup for each account

### 3. Webhook Configuration

Update the webhook URL in Instantly to receive delivery events:
- **Webhook URL**: `https://qpvyzyspwxwtwjhfcuhh.supabase.co/functions/v1/instantly-webhook`
- **Events to track**: email_sent, email_opened, email_clicked, email_replied, email_bounced

---

## Technical Implementation

### Phase 1: Update `check-integrations` Edge Function

Update the API endpoint from v1 to v2:
```text
Current:  https://api.instantly.ai/api/v1/account/list
New:      https://api.instantly.ai/api/v2/accounts
```

### Phase 2: Update `launch-campaign` Edge Function

**Campaign Creation:**
```text
Current:  POST /api/v1/campaign/create
New:      POST /api/v2/campaigns
```

The v2 campaign creation requires a different payload structure including:
- `name`: Campaign name
- `email_list`: Array of sender email addresses
- `campaign_schedule`: Schedule configuration object
- `sequences`: Array containing email steps/copy

**Lead Addition:**
```text
Current:  POST /api/v1/lead/add
New:      POST /api/v2/leads
```

The v2 lead creation payload changes:
- `campaign_id` becomes just `campaign` 
- Custom variables move to `payload` object

**Campaign Activation:**
```text
Current:  POST /api/v1/campaign/launch
New:      POST /api/v2/campaigns/{id}/activate
```

### Phase 3: Update `instantly-webhook` Edge Function

The webhook may need adjustments to handle v2 event payloads if the structure changed.

---

## Pre-Implementation Checklist (Action for You)

Before I implement the code changes, please confirm:

1. **Email accounts added in Instantly?**
   - Which sender emails are configured in your new Instantly account?
   - Are they warmed up and ready to send?

2. **API Scope verification:**
   - Your API key has `all:all` scope - this is correct for full access

3. **Do you want me to:**
   - Update the hardcoded sender accounts list in `CampaignChannels.tsx`?
   - Add new team members?

---

## Estimated Changes

| File | Change Type |
|------|-------------|
| `supabase/functions/launch-campaign/index.ts` | Update all Instantly API calls to v2 |
| `supabase/functions/check-integrations/index.ts` | Update account list endpoint to v2 |
| `supabase/functions/instantly-webhook/index.ts` | Verify v2 webhook payload compatibility |
| `src/pages/CampaignChannels.tsx` | Optional: Update sender account list |

Once you confirm what email accounts you have in Instantly, I'll implement the migration to v2.
