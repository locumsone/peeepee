
# Add Gmail/SMTP Email Sending as Alternative to Instantly

## Overview

Add the ability to send campaign emails directly via Gmail (or other SMTP providers) as an alternative to Instantly. This lets Marc and other users send email outreach using their Gmail accounts (`marc@locums.one`) while Instantly is being set up.

## How It Will Work

```text
┌────────────────────────────────────────────────────────────┐
│  STEP 3: CHANNELS                                          │
│                                                            │
│  📧 Email                                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Provider:  [▼ Gmail/SMTP ]  [▼ Instantly (Pro)]   │   │
│  │                                                    │   │
│  │  ─────────── Gmail/SMTP Selected ───────────      │   │
│  │  Sender Email: [marc@locums.one        ]          │   │
│  │  Display Name: [Marc - Locums One      ]          │   │
│  │                                                    │   │
│  │  ⚠️ Requires SMTP credentials configured          │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  📱 SMS (Twilio)    ☎️ AI Calls (ARIA)    🔗 LinkedIn     │
└────────────────────────────────────────────────────────────┘
```

---

## Technical Approach

### Option A: Gmail SMTP with App Password (Recommended)

Uses Gmail's SMTP server with an App Password for authentication. This is the simplest approach that works immediately without OAuth complexity.

**Requirements:**
- Gmail account with 2FA enabled
- App Password generated at: https://myaccount.google.com/apppasswords
- Store as Supabase secrets: `GMAIL_USER` and `GMAIL_APP_PASSWORD`

**SMTP Settings:**
- Host: `smtp.gmail.com`
- Port: `465` (SSL) or `587` (TLS)
- Secure: true

### Option B: Google OAuth (More Complex)

Requires OAuth2 token management, refresh tokens, and Google Cloud setup. More enterprise-grade but significantly more complex to implement.

---

## Implementation Plan

### 1. Add New Edge Function: `send-email-smtp`

Create a new edge function that sends emails via SMTP (Gmail or any provider).

```typescript
// supabase/functions/send-email-smtp/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
}

serve(async (req) => {
  // Authenticate request
  // Get GMAIL credentials from secrets
  // Send via SMTP
  // Return success/failure
});
```

### 2. Update Channel Configuration

Modify `CampaignChannels.tsx` to allow choosing between:
- **Instantly** (existing - for power users)
- **Gmail/SMTP** (new - for immediate use)

Add UI to:
- Select email provider
- Enter sender email for SMTP
- Enter display name

### 3. Update `launch-campaign` Edge Function

Modify the email sending logic to check which provider is configured:

```typescript
// In launch-campaign/index.ts
if (channels.email) {
  if (channels.email.provider === 'gmail' || channels.email.provider === 'smtp') {
    // Use send-email-smtp function
    await supabase.functions.invoke('send-email-smtp', {
      body: { to, subject, html, from_email, from_name }
    });
  } else {
    // Use Instantly (existing flow)
  }
}
```

### 4. Add Secrets for Gmail

Required secrets to add:
- `GMAIL_USER` - The Gmail address (e.g., `marc@locums.one`)
- `GMAIL_APP_PASSWORD` - App password from Google

Or for custom SMTP:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/send-email-smtp/index.ts` | SMTP email sender using Deno |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/CampaignChannels.tsx` | Add provider selector (Gmail vs Instantly) |
| `supabase/functions/launch-campaign/index.ts` | Route emails to correct provider |
| `src/components/campaign-review/StepConnectChannels.tsx` | Show Gmail status check |
| `supabase/config.toml` | Register new function |

---

## Database Changes

Add to `ChannelConfig` type:
```typescript
email?: {
  provider: 'instantly' | 'gmail' | 'smtp';  // NEW
  sender: string;
  senderName?: string;  // NEW
  sequenceLength: number;
  gapDays: number;
} | null;
```

---

## UI Changes

### Email Channel Card (Updated)

```text
┌─────────────────────────────────────────────┐
│ 📧 Email                          [Toggle] │
│                                             │
│  Provider                                   │
│  ┌─────────────────────────────────────┐   │
│  │ ○ Gmail/SMTP   ● Instantly          │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  If Gmail selected:                         │
│  ┌─────────────────────────────────────┐   │
│  │ Your Email: [marc@locums.one    ]   │   │
│  │ Display As: [Marc - Locums One  ]   │   │
│  └─────────────────────────────────────┘   │
│  ⓘ Uses your Gmail via secure SMTP         │
│                                             │
│  Sequence: [4 emails ▼]  Gap: [3 days ▼]   │
└─────────────────────────────────────────────┘
```

---

## Setup Steps for Marc

After implementation:

1. **Enable 2FA on Gmail** (if not already)
   - Go to: https://myaccount.google.com/security
   
2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and generate a 16-character password
   
3. **Add Secrets in Supabase**
   - Add `GMAIL_USER` = `marc@locums.one`
   - Add `GMAIL_APP_PASSWORD` = `[16-char app password]`

4. **Use in Campaign**
   - Select "Gmail/SMTP" as email provider
   - Enter sending email address
   - Launch campaign!

---

## Rate Limits & Considerations

Gmail has sending limits:
- **Free Gmail**: 500 emails/day
- **Google Workspace**: 2,000 emails/day

For large campaigns, Instantly is still recommended. Gmail/SMTP is ideal for:
- Small test campaigns
- Quick outreach to 10-50 candidates
- While Instantly is being configured

---

## Security Notes

- App passwords are stored securely in Supabase secrets
- Credentials never exposed to frontend
- All emails sent server-side via edge function
- Supports reply-to for tracking responses

---

## Summary

This plan adds Gmail as an alternative email provider for campaign outreach. It uses Gmail's SMTP with App Passwords for simple setup, requires no OAuth complexity, and can be live within one implementation session.
