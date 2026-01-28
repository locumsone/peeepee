
# Add Google OAuth Sign-In + Gmail Email Sending

## Overview

Enable users to **sign in with Google** and automatically use their Gmail account for sending campaign emails. This creates a seamless flow where:
1. User clicks "Continue with Google" to sign in
2. Their Gmail is auto-saved as an available sender account  
3. Campaign builder shows their Gmail as the default sender option

## User Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                    LOGIN PAGE                               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  🔵  Continue with Google                             │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ──────────────────── OR ────────────────────────           │
│                                                             │
│  Email:    [________________________]                       │
│  Password: [________________________]                       │
│  [          Sign In              ]                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
                     After OAuth login
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  CAMPAIGN CHANNELS - Email Provider                         │
│                                                             │
│  ● Gmail (Your Account)                                     │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ Sender: marc@locums.one ✓ (Connected via Google)    │  │
│    │ Display Name: Marc - Locums One                     │  │
│    └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ○ Instantly (Pro)                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Add Google OAuth to Login/Signup

Add a "Continue with Google" button that uses Supabase's OAuth:

```typescript
const handleGoogleSignIn = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      scopes: 'email profile',  // Basic scopes for login
    },
  });
  if (error) toast.error(error.message);
};
```

### Step 2: Create Gmail Accounts Table

Store connected Gmail accounts with send capability:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to auth.users |
| email | text | Gmail address |
| display_name | text | Sender display name |
| is_primary | boolean | Default sender |
| provider | text | 'google_oauth' or 'smtp' |
| created_at | timestamp | When connected |

### Step 3: Auto-Create Gmail Account on Google Login

After successful Google OAuth, automatically:
1. Create/update the user's signature
2. Add their Gmail as an available sender account

```typescript
// In auth state change listener
if (session?.user?.app_metadata?.provider === 'google') {
  const email = session.user.email;
  const fullName = session.user.user_metadata?.full_name;
  
  // Create signature
  await supabase.from('user_signatures').upsert({
    user_id: session.user.id,
    full_name: fullName,
    first_name: fullName?.split(' ')[0],
    // ...
  });
  
  // Register Gmail as sender
  await supabase.from('gmail_accounts').upsert({
    user_id: session.user.id,
    email: email,
    display_name: `${fullName} - Locums One`,
    is_primary: true,
    provider: 'google_oauth',
  });
}
```

### Step 4: Update Campaign Channels UI

Show user's connected Gmail accounts in the sender dropdown:

```typescript
// Fetch user's connected Gmail accounts
const { data: gmailAccounts } = await supabase
  .from('gmail_accounts')
  .select('*')
  .eq('user_id', user.id);

// Show in dropdown
<Select value={gmailSender}>
  {gmailAccounts?.map(account => (
    <SelectItem key={account.id} value={account.email}>
      {account.email} ✓
    </SelectItem>
  ))}
</Select>
```

### Step 5: Update Review Step

Show the authenticated Gmail account status:
- Display checkmark for OAuth-connected Gmail
- Show "Connected via Google" badge

---

## Files to Create

| File | Purpose |
|------|---------|
| Database migration | Create `gmail_accounts` table |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Login.tsx` | Add Google OAuth button with separator |
| `src/pages/Signup.tsx` | Add Google OAuth button |
| `src/hooks/useAuth.ts` | Add signInWithGoogle helper + auto-setup |
| `src/pages/CampaignChannels.tsx` | Fetch user's Gmail accounts, show in dropdown |
| `src/components/campaign-review/StepConnectChannels.tsx` | Show Google-connected status |

---

## Database Changes

```sql
-- Create gmail_accounts table
CREATE TABLE gmail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  provider TEXT DEFAULT 'google_oauth',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Enable RLS
ALTER TABLE gmail_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own accounts
CREATE POLICY "Users can view own gmail accounts"
  ON gmail_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gmail accounts"
  ON gmail_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail accounts"
  ON gmail_accounts FOR UPDATE
  USING (auth.uid() = user_id);
```

---

## UI Design

### Login Page with Google OAuth

```text
┌────────────────────────────────────────────────┐
│                                                │
│           Welcome to Locums One                │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  🔵  Continue with Google                │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│              ─────── OR ───────                │
│                                                │
│  Email:    [____________________________]      │
│  Password: [____________________________]      │
│                                                │
│  [           Sign In                    ]      │
│                                                │
│  Don't have an account? Sign up                │
└────────────────────────────────────────────────┘
```

### Campaign Channels - Gmail Provider

```text
┌─────────────────────────────────────────────────────┐
│  Email Provider                                     │
│                                                     │
│  ● Gmail (Your Account)   ○ Instantly               │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ Sender Account                                │  │
│  │ ┌─────────────────────────────────────────┐   │  │
│  │ │ marc@locums.one          ▼              │   │  │
│  │ └─────────────────────────────────────────┘   │  │
│  │ ✓ Connected via Google                        │  │
│  │                                               │  │
│  │ Display Name                                  │  │
│  │ [Marc - Locums One                        ]   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Manual Setup Required (One-Time)

Before this works, you need to configure Google OAuth in Supabase:

1. **Google Cloud Console**:
   - Go to https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 Client ID (Web application)
   - Add authorized JavaScript origins:
     - `https://locumsone.lovable.app`
     - `https://id-preview--fab97c13-17df-49bd-92a6-0546f0103825.lovable.app`
   - Add authorized redirect URL:
     - `https://qpvyzyspwxwtwjhfcuhh.supabase.co/auth/v1/callback`

2. **Supabase Dashboard**:
   - Go to Authentication → Providers → Google
   - Enable Google
   - Paste your Client ID and Client Secret
   - Set redirect URL in URL Configuration

---

## How Email Sending Works

After OAuth login, emails are still sent via the existing SMTP function:
- User's Gmail is stored in `gmail_accounts` table
- Campaign launch uses the stored email + GMAIL_APP_PASSWORD secret
- No additional OAuth tokens needed for SMTP with App Passwords

This approach uses:
- **Google OAuth for login** (quick, easy sign-in)
- **Gmail SMTP for sending** (using App Password already configured)

---

## Benefits

- **One-click sign-in**: Marc can sign in with Google instantly
- **Auto-configured sender**: His Gmail is automatically available for campaigns
- **Seamless UX**: No manual email entry needed in campaign builder
- **Familiar flow**: Uses standard Google OAuth that users trust
