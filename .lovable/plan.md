
# Campaign Launch Bug Fix and Personalization Engine Verification

## Issues Identified

### Bug 1: "No Channels" Error on Review Page
**Root Cause**: The routing has changed but the data flow is inconsistent.

Looking at the route configuration:
- `/campaigns/new/channels` → `SequenceStudio.tsx` (NOT `CampaignChannels.tsx`)
- `/campaigns/new/sequence` → `SequenceStudio.tsx`

But `CampaignReview.tsx` has a "Back" button that navigates to `/campaigns/new/channels`, and it expects data from `CampaignChannels.tsx` format.

The `SequenceStudio.tsx` saves channel config with this structure:
```javascript
{
  email: { sender: "...", steps: [...] },  // Note: uses "steps" array
  sms: { fromNumber: "...", steps: [...] },
  aiCall: { fromNumber: "...", steps: [...] },
  ...
}
```

But `CampaignReview.tsx` and `StepConnectChannels.tsx` expect:
```javascript
{
  email: { sender: "...", sequenceLength: 4, gapDays: 3 },  // Note: expects sequenceLength
  sms: { fromNumber: "...", sequenceLength: 2 },
  ...
}
```

The `StepConnectChannels` component checks `if (channels.email)` but because the format is different, the channel status logic fails to properly detect enabled channels.

### Bug 2: Emails Not Showing on Review Page
**Root Cause**: `SequenceStudio.tsx` saves candidates with `email_body` and `email_subject` to sessionStorage, but when `CampaignReview.tsx` loads data via `useCampaignDraft`, the draft data may be stale or the sessionStorage data isn't being properly synchronized.

The `useCampaignDraft` hook has complex priority logic between sessionStorage and localStorage that can cause data to be missed:
1. It checks both session and local storage
2. It compares timestamps to determine which is "fresher"
3. But `SequenceStudio.tsx` saves directly to sessionStorage without updating the unified draft

### Bug 3: Personalization Engine Context
**Confirmation**: Yes, the personalization engine (`generate-email` edge function) **does read deep research and playbook** data:

1. **Deep Research**: The function fetches from `candidate_job_matches` table for `talking_points`, `icebreaker`, and `match_reasons` (line 262-267)
2. **Playbook**: It accepts `playbook_data` in the request body (priority 1) or fetches from campaign's `playbook_data` column (priority 2)
3. **Connection**: The `connection` object from `personalization-research` is used to build the "CONNECTION-FIRST" structure

---

## Technical Fix Plan

### Fix 1: Normalize Channel Config Format in CampaignReview

**File**: `src/pages/CampaignReview.tsx`

Update the `loadSessionData` function to handle both the old format (from `CampaignChannels.tsx`) and the new format (from `SequenceStudio.tsx`):

```typescript
// When loading campaign_channels from sessionStorage
if (storedCampaignChannels) {
  const parsed = JSON.parse(storedCampaignChannels);
  
  // Normalize: if email has "steps" array, convert to expected format
  if (parsed.email?.steps) {
    channelConfig.email = {
      provider: parsed.email.provider,
      sender: parsed.email.sender,
      sequenceLength: parsed.email.steps?.length || 4,
      gapDays: 3,
    };
  }
  if (parsed.sms?.steps) {
    channelConfig.sms = {
      fromNumber: parsed.sms.fromNumber || "",
      sequenceLength: parsed.sms.steps?.length || 1,
    };
  }
  // ... etc
}
```

### Fix 2: Ensure SequenceStudio Syncs to useCampaignDraft

**File**: `src/pages/SequenceStudio.tsx`

Import and use the `useCampaignDraft` hook to sync data properly:

```typescript
import { useCampaignDraft } from "@/hooks/useCampaignDraft";

// In component:
const { updateCandidates, updateChannels, saveDraft } = useCampaignDraft();

// In handleNext:
const handleNext = () => {
  // ... existing validation ...
  
  // Sync to unified draft system
  updateCandidates(candidates);
  updateChannels(normalizedConfig);
  saveDraft();
  
  // Also save to legacy sessionStorage
  sessionStorage.setItem("campaign_candidates", JSON.stringify(candidates));
  sessionStorage.setItem("campaign_channels", JSON.stringify(config));
  
  navigate("/campaigns/new/review");
};
```

### Fix 3: Update StepConnectChannels to Handle Both Formats

**File**: `src/components/campaign-review/StepConnectChannels.tsx`

Update the channel detection logic to handle both formats:

```typescript
// Check if email is enabled - handle both formats
if (channels.email) {
  const isGmail = channels.email.provider === 'gmail' || channels.email.provider === 'smtp';
  const hasSender = channels.email.sender || (Array.isArray(channels.email.steps) && channels.email.steps.length > 0);
  
  if (hasSender) {
    statuses.push({
      name: `Email (${isGmail ? 'Gmail' : 'Instantly'})`,
      key: "email",
      icon: <Mail className="h-4 w-4" />,
      enabled: true,
      status: isGmail ? "connected" : "checking",
      details: channels.email.sender || senderEmail,
    });
  }
}
```

### Fix 4: Fix ChannelConfig Type to Support Both Formats

**File**: `src/components/campaign-review/types.ts`

Update the type to be more flexible:

```typescript
export interface ChannelConfig {
  email?: {
    provider?: 'instantly' | 'gmail' | 'smtp';
    sender: string;
    senderName?: string;
    sequenceLength?: number;  // Optional - may not exist in new format
    gapDays?: number;
    steps?: Array<{ id: string; day: number; content: string }>;  // New format
  } | null;
  // ... similar for sms, aiCall
}
```

### Fix 5: Add Debug Logging to Track Data Flow

Add console logs at key points to help debug future issues:

```typescript
// In CampaignReview.tsx loadSessionData:
console.log("[CampaignReview] Loading channels from sessionStorage:", storedCampaignChannels);
console.log("[CampaignReview] Normalized channelConfig:", channelConfig);

// In SequenceStudio.tsx handleNext:
console.log("[SequenceStudio] Saving config:", config);
console.log("[SequenceStudio] Saving candidates:", candidates.length);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/CampaignReview.tsx` | Add channel format normalization in `loadSessionData` |
| `src/pages/SequenceStudio.tsx` | Import and use `useCampaignDraft` to sync data |
| `src/components/campaign-review/StepConnectChannels.tsx` | Handle both channel formats |
| `src/components/campaign-review/types.ts` | Update `ChannelConfig` interface |
| `src/hooks/useCampaignDraft.ts` | Minor fix to ensure sessionStorage takes priority over stale localStorage |

---

## Summary of Personalization Engine Context Usage

The personalization engine **correctly reads**:

1. **Playbook Data** (from request body or campaign record):
   - Compensation rates (hourly, daily, weekly)
   - Clinical scope (procedures, call status, schedule)
   - Positioning guidance (selling points, differentiators, messaging tone)
   - Credentialing info

2. **Deep Research** (from `candidate_job_matches` table):
   - `icebreaker` - AI-generated opening line
   - `talking_points` - Array of discussion points
   - `match_reasons` - Why this candidate fits

3. **Connection Object** (from `personalization-research`):
   - Priority ranking (1-8)
   - Fact about candidate
   - Benefit of the role
   - Pre-written connection line for email
   - SMS-friendly hook

The AI prompt explicitly requires the connection line to appear in sentence 1 or 2 of the email body, ensuring personalization is front-and-center rather than buried in the message.

---

## Testing Checklist

After implementing fixes:

1. Start new campaign from Job Detail page
2. Select candidates, proceed to Personalize step
3. Generate emails, verify content has playbook data
4. Proceed to Sequence step
5. Configure sequence, proceed to Review
6. Verify channels show as connected
7. Verify email previews show generated content
8. Launch campaign successfully

