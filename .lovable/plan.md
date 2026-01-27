
# Campaign Review Final Step Fixes

## Issues Identified

After extensive investigation, I found multiple issues affecting the campaign review workflow:

### Issue 1: "Campaign Not Found" Error
- **Root Cause**: The `launch-campaign` Edge Function does **not exist** in the codebase
- The `LaunchStatusBar.tsx` attempts to invoke `supabase.functions.invoke("launch-campaign")` on line 160
- When this fails, there's a fallback that inserts directly into the `campaigns` table
- However, if the fallback also fails or the returned campaign ID is malformed, the redirect to `/campaigns/{id}` fails, showing "Campaign not found"

### Issue 2: Personalized Data Not Saving
- **Root Cause**: The `icebreaker`, `talking_points`, `email_subject`, `email_body`, and `sms_message` fields on candidates are only stored in **session/local storage** via `useCampaignDraft.ts`
- These are passed to the launch function but never persisted to the database:
  - The fallback insert (line 198-205) only saves `candidate_name`, `candidate_email`, `candidate_phone`, `status`
  - Missing: `icebreaker`, `talking_points`, personalized messages
- The `campaign_leads_v2` table has limited fields and doesn't store personalization

### Issue 3: Manual Entry for PDL Failures - Missing Feature
- Currently, when PDL enrichment fails (marked as "not_found"), there's no way to manually enter email/phone
- The results table shows a red X with "Not Found" but no edit button

### Issue 4: Already-Enriched Check - Partially Implemented
- The `handleEnrichAll` function in `StepPrepareCandidates.tsx` (lines 70-117) already checks the database for cached enrichment
- However, it only checks `personal_email` and `personal_mobile`, not `contact_enrichment_source`
- The visual feedback for cached vs. new enrichment could be clearer

### Issue 5: Campaign Send/Tracking Verification
The launch flow has gaps:
- **Email**: Relies on `launch-campaign` Edge Function (which doesn't exist) to create Instantly campaigns
- **SMS**: The `sms-campaign-send` Edge Function exists and properly creates `sms_conversations` and `sms_messages`, which are tracked in Communications
- **AI Calls**: Would be queued via `ai_call_queue` but again depends on the missing `launch-campaign` function

---

## Implementation Plan

### Part 1: Create Launch Campaign Edge Function
Create `supabase/functions/launch-campaign/index.ts`:

```text
Responsibilities:
1. Create campaign record in 'campaigns' table with status='active'
2. Create campaign_leads_v2 records with personalization data
3. Queue SMS messages via sms-campaign-send for Day 1
4. Create Instantly email campaign (if email channel enabled)
5. Queue AI calls in ai_call_queue (if voice channel enabled)
6. Return campaign_id for redirect
```

### Part 2: Fix Personalization Data Persistence
Update `LaunchStatusBar.tsx` fallback insert (lines 198-205):

```text
Add these fields to campaign_leads_v2 insert:
- match_score (from unified_score)
- tier
- notes (concatenated icebreaker + talking_points)
- And ensure the launch-campaign function saves full personalization
```

### Part 3: Add Manual Entry for Failed Enrichments
Update `StepPrepareCandidates.tsx`:

1. Add "Edit" button in the results table for failed/not_found candidates
2. Create inline editing dialog with:
   - Email input field
   - Phone input field (with format validation)
   - Save button that updates the candidate record
3. Update the `EnrichmentResult` interface to support manual entries

Visual mockup:
```text
| Status   | Name               | Email           | Phone          | Actions    |
|----------|--------------------|-----------------|----------------|------------|
| [X]      | Dr. John Smith     | --              | --             | [Edit] btn |
```

Clicking Edit opens a dialog:
```text
+------------------------------------------+
| Manual Contact Entry                     |
| Dr. John Smith                           |
|                                          |
| Email: [________________________]        |
| Phone: [________________________]        |
|                                          |
| [Cancel]                    [Save]       |
+------------------------------------------+
```

### Part 4: Improve Already-Enriched Detection
Update enrichment check in `StepPrepareCandidates.tsx`:

```text
Current check (line 82):
  dbRecord?.personal_email || dbRecord?.personal_mobile

Enhanced check:
  dbRecord?.personal_email || 
  dbRecord?.personal_mobile ||
  dbRecord?.contact_enrichment_source // If previously enriched via PDL/Whitepages
```

Also add a "source" column to the results table showing:
- "PDL (cached)" - already had PDL data
- "PDL" - newly enriched via PDL
- "Whitepages" - newly enriched via Whitepages
- "Manual" - manually entered

### Part 5: Communications Tracking Verification
Ensure the launch creates proper tracking records:

1. **SMS Tracking**: The `sms-campaign-send` function already creates:
   - `sms_conversations` record linked to `campaign_id` and `candidate_id`
   - `sms_messages` record with delivery status
   - Real-time updates via Supabase subscription in `Communications.tsx`

2. **Email Tracking**: Via Instantly webhooks (`instantly-webhook/index.ts`):
   - `campaign_events` table tracks opens, clicks, replies
   - `campaigns` table stats are updated (emails_sent, emails_opened, etc.)

3. **Call Tracking**: Via `ai_call_logs` table:
   - Updated by `voice-incoming` webhook
   - Displayed in Communications Hub "Calls" tab

---

## Files to Create/Modify

### New Files:
1. `supabase/functions/launch-campaign/index.ts` - Main launch orchestration
2. `src/components/campaign-review/ManualEntryDialog.tsx` - Manual contact entry modal

### Modified Files:
1. `src/components/campaign-review/StepPrepareCandidates.tsx`:
   - Add manual entry button in results table
   - Improve cached enrichment detection
   - Add source column to results table

2. `src/components/campaign-review/LaunchStatusBar.tsx`:
   - Update fallback insert to include personalization fields
   - Add pre-flight check for edge function availability

3. `supabase/config.toml`:
   - Add `[functions.launch-campaign]` configuration

---

## Technical Details

### launch-campaign Edge Function Structure:

```text
Input:
{
  job_id: string,
  campaign_name: string,
  sender_email: string,
  channels: ChannelConfig,
  candidates: [{
    id, first_name, last_name, email, phone,
    icebreaker, talking_points, email_subject, 
    email_body, sms_message, tier
  }]
}

Flow:
1. Create campaign record -> get campaign_id
2. Insert campaign_leads_v2 with personalization
3. For each candidate with phone:
   - Queue Day 1 SMS via sms-campaign-send
   - Create sms_conversation record
4. For each candidate with email:
   - Create Instantly lead (if INSTANTLY_API_KEY exists)
5. For AI calls (if enabled):
   - Insert into ai_call_queue with scheduled_at
6. Return { success: true, campaign_id }

Output:
{
  success: boolean,
  campaign_id: string,
  message: string,
  stats: { emails_queued, sms_queued, calls_queued }
}
```

### Manual Entry Dialog Props:

```text
interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: {
    id: string;
    name: string;
    currentEmail?: string;
    currentPhone?: string;
  };
  onSave: (email: string | null, phone: string | null) => Promise<void>;
}
```

This plan addresses all the reported issues and ensures campaigns will properly send and track in the Communications area.
