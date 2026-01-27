

# Backend Connection Fixes for ATS Features

## Root Cause Analysis

I traced through the entire campaign flow and found **multiple critical issues** causing the "0 leads" problem:

### Issue 1: Candidates Not Being Saved to `campaign_leads_v2`
**Evidence from edge function logs:**
```
[launch-campaign] Starting launch for job ... with 0 candidates
[launch-campaign] Inserted 0 leads
```

The edge function receives **0 candidates** in its payload even though users selected them.

### Issue 2: Data Sync Gap Between Pages
The campaign builder has a fragmented data flow:
```text
CandidateMatching -> PersonalizationStudio -> SequenceStudio -> CampaignReview -> launch-campaign
     |                      |                      |                   |
     v                      v                      v                   v
sessionStorage          sessionStorage         sessionStorage      useCampaignDraft
(campaign_candidates)   (campaign_candidates)  (campaign_channels)     |
                                                                       v
                                                              Reads from draft OR legacy keys
```

**Problem:** The `useCampaignDraft` hook checks `localStorage` first for a unified draft. If an old/stale draft exists there with 0 candidates, it uses that instead of the fresh `sessionStorage` data.

### Issue 3: Draft Hook Priority Issue
In `useCampaignDraft.ts` lines 190-207:
```typescript
const storedDraft = localStorage.getItem(DRAFT_KEY);
if (storedDraft) {
  // Uses localStorage draft even if sessionStorage has newer data!
  setDraft(parsed);
  return; // Exits early, never checks sessionStorage
}
```

### Issue 4: Missing `specialty` and `state` fields in Candidate Mapping
In `LaunchStatusBar.tsx` line 180-191, the candidate mapping doesn't include all required fields:
```typescript
candidates: candidates.map(c => ({
  id: c.id,
  first_name: c.first_name,
  last_name: c.last_name,
  email: c.email || c.personal_email,
  phone: c.phone || c.personal_mobile,
  // Missing: specialty, state, tier, unified_score
})),
```

---

## Fixes Required

### Fix 1: Update `useCampaignDraft` to Merge Data Sources
Modify the draft loading logic to prefer sessionStorage over stale localStorage data, and merge data from both sources.

**File:** `src/hooks/useCampaignDraft.ts`

Changes:
- Check sessionStorage first (current session data)
- Compare timestamps between localStorage and sessionStorage
- Use the most recent data
- Clear localStorage if sessionStorage has fresher data

### Fix 2: Fix Candidate Payload in Launch
Add missing fields to the candidate mapping in `LaunchStatusBar.tsx`:

```typescript
candidates: candidates.map(c => ({
  id: c.id,
  first_name: c.first_name,
  last_name: c.last_name,
  email: c.email || c.personal_email,
  phone: c.phone || c.personal_mobile,
  specialty: c.specialty,           // ADD
  state: c.state,                   // ADD
  tier: c.tier,                     // ADD
  unified_score: c.unified_score,   // ADD
  icebreaker: c.icebreaker,
  talking_points: c.talking_points,
  email_subject: c.email_subject,
  email_body: c.email_body,
  sms_message: c.sms_message,
})),
```

### Fix 3: Add Debug Logging to Track Data Flow
Add console logs at each stage to trace where candidates disappear:

**CampaignReview.tsx:** Log candidates count when loaded
**LaunchStatusBar.tsx:** Log payload before sending
**launch-campaign edge function:** Already has logging

### Fix 4: Ensure Jobs Page Kanban Links to Real Data
Update `JobDetail.tsx` to query `campaign_leads_v2` correctly:

The current query joins `campaigns` to `campaign_leads_v2` via `campaign_id`, which is correct. However, leads are not being inserted because of Issues 1-3 above.

### Fix 5: Add Fallback Direct Insert in LaunchStatusBar
The fallback code in `LaunchStatusBar.tsx` (lines 196-229) already handles direct insert when edge function fails - but it also has the same missing fields issue.

---

## Implementation Plan

### Phase 1: Fix Data Sync (Priority: Critical)

**File: `src/hooks/useCampaignDraft.ts`**
- Modify `loadDraft()` to check sessionStorage first
- Add timestamp comparison logic
- Clear stale localStorage data when sessionStorage is fresher

**File: `src/pages/CampaignReview.tsx`**
- Add debug logging when loading candidates
- Ensure `candidates` state is populated before allowing launch

### Phase 2: Fix Candidate Payload (Priority: Critical)

**File: `src/components/campaign-review/LaunchStatusBar.tsx`**
- Add missing fields (`specialty`, `state`, `tier`, `unified_score`) to candidate mapping
- Add debug logging before edge function call
- Fix fallback insert to include all fields

### Phase 3: Verify Edge Function (Priority: High)

**File: `supabase/functions/launch-campaign/index.ts`**
- Already has correct logic
- Just needs to receive complete data from frontend

### Phase 4: Update JobDetail to Show Real Data (Priority: Medium)

**File: `src/pages/JobDetail.tsx`**
- The component is already wired correctly
- Will automatically show data once leads are being saved

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useCampaignDraft.ts` | Fix draft loading priority to prefer sessionStorage |
| `src/components/campaign-review/LaunchStatusBar.tsx` | Add missing candidate fields to payload |
| `src/pages/CampaignReview.tsx` | Add debug logging, ensure candidates loaded |
| `src/pages/SequenceStudio.tsx` | Ensure candidates are saved with all fields |

---

## Testing Plan

After fixes:
1. Create a new job
2. Go through Candidate Matching → select candidates → Continue
3. Go through PersonalizationStudio → Continue  
4. Go through SequenceStudio → Continue to Review
5. On CampaignReview, verify candidate count shows correctly
6. Click Launch Campaign
7. Verify edge function logs show correct candidate count
8. Check `campaign_leads_v2` table has records
9. Go to JobDetail → Candidates tab should show pipeline

---

## Success Criteria

After implementation:
1. Launching a campaign inserts leads into `campaign_leads_v2`
2. Job Detail page shows candidates in pipeline/kanban
3. Campaigns page shows correct leads_count
4. Activity feed shows SMS/call events
5. No data loss during page transitions

