
# Jobs & Campaigns Improvement Plan

## Problems Identified

### 1. Total Candidates Display Issue (Jobs Page)
The Jobs page currently only shows candidates from `campaign_leads_v2` which requires campaigns to be launched. It doesn't show:
- Candidates matched to the job but not yet added to a campaign
- Candidates saved during campaign building (draft state)

### 2. Candidates Not Saving to Campaigns
The `campaigns` table stores `leads_count` but this only updates on launch. When you:
- Select candidates in CandidateMatching
- Work through PersonalizationStudio and SequenceStudio
- Never launch the campaign

The candidates exist only in `sessionStorage`/`localStorage` via `useCampaignDraft` and are never persisted to the database until the campaign launches.

### 3. Campaign Progress Not Resumable
Related to issue 2 - while `useCampaignDraft` saves to local storage, there's no database persistence for draft campaigns with their candidate selections. Users can't resume from another device or after clearing browser data.

### 4. Jobs Need Expandable Details
Currently jobs require navigating to JobDetail page. Users want inline expansion to see progress without leaving the Jobs list.

---

## Solution Overview

### Part A: Add `candidate_job_matches` Count to Jobs Page
The `candidate_job_matches` table already tracks candidates matched to jobs. We should aggregate this count along with `campaign_leads_v2` for a complete picture.

### Part B: Save Draft Candidates to Database
Create early persistence for campaign drafts so candidates are saved before launch:
1. Insert a "draft" campaign record when user first adds candidates
2. Insert `campaign_leads_v2` records with status "draft" immediately
3. Update the draft hook to sync with database, not just local storage

### Part C: Expandable Job Cards
Add collapsible sections to job cards showing:
- Pipeline progress (from existing components)
- Recent activity
- Quick action buttons

---

## Technical Implementation

### File 1: `src/pages/Jobs.tsx`

**Changes:**
1. Fetch candidate counts from `candidate_job_matches` table
2. Show both "Matched" and "In Pipeline" counts
3. Add expandable/collapsible row for each job

```text
Before:
+------------------------------------------+
| IR - Middletown, NY              [ACTIVE] |
| Pipeline: 18 contacted                    |
+------------------------------------------+

After:
+------------------------------------------+
| IR - Middletown, NY              [ACTIVE] |
| 47 Matched · 18 In Pipeline               |
|                                [▼ Expand] |
+------------------------------------------+
   ↓ Expanded:
+------------------------------------------+
| PIPELINE STAGES                          |
| [Sourced: 12] [Contacted: 8] [...]       |
|                                          |
| RECENT ACTIVITY                          |
| • Dr. Smith replied via SMS (2h ago)     |
| • Dr. Jones opened email (4h ago)        |
|                                          |
| [View Full Details] [Create Campaign]    |
+------------------------------------------+
```

### File 2: `src/hooks/useCampaignDraft.ts`

**Changes:**
1. Add `persistToDatabase` function that creates/updates draft campaign in DB
2. Save `campaign_leads_v2` records with status "draft" when candidates are added
3. Add `loadFromDatabase` fallback when local storage is empty

```typescript
// New function to persist draft to database
const persistToDatabase = async (draft: CampaignDraft) => {
  if (!draft.jobId || draft.candidates.length === 0) return;
  
  // Upsert campaign record with draft status
  const { data: campaign } = await supabase
    .from("campaigns")
    .upsert({
      id: draft.databaseCampaignId, // New field to track DB record
      job_id: draft.jobId,
      name: draft.campaignName || "Draft Campaign",
      status: "draft",
      leads_count: draft.candidates.length,
    })
    .select()
    .single();
    
  if (campaign) {
    // Upsert campaign_leads_v2 records
    const leads = draft.candidates.map(c => ({
      campaign_id: campaign.id,
      candidate_id: c.id,
      candidate_name: `${c.first_name} ${c.last_name}`,
      status: "draft",
      // ... other fields
    }));
    
    await supabase.from("campaign_leads_v2").upsert(leads, {
      onConflict: "campaign_id,candidate_id"
    });
  }
};
```

### File 3: New Component `src/components/jobs/ExpandableJobRow.tsx`

**Purpose:** Self-contained expandable job card with inline pipeline view

**Features:**
- Collapsible panel with animation
- Embedded JobPipeline component
- Embedded mini-activity feed (last 5 items)
- Quick action buttons

### File 4: `src/pages/JobDetail.tsx`

**Minor update:** Ensure it handles "draft" status leads correctly in pipeline display

---

## Database Changes

### Add Unique Constraint for Upsert
The `campaign_leads_v2` table needs a unique constraint on `(campaign_id, candidate_id)` for upsert operations.

```sql
ALTER TABLE campaign_leads_v2 
ADD CONSTRAINT campaign_leads_v2_campaign_candidate_unique 
UNIQUE (campaign_id, candidate_id);
```

---

## Data Flow After Fix

```text
User Flow:
1. User navigates to /campaigns/new?jobId=xxx
2. Selects candidates in CandidateMatching
   → Immediately saves draft campaign to DB
   → Inserts campaign_leads_v2 with status="draft"
3. Continues through PersonalizationStudio
   → Updates icebreaker/talking_points in campaign_leads_v2
4. Navigates away or closes browser
   → Data persists in database
5. Returns later
   → Draft recovered from DB, resume where left off
6. Launches campaign
   → Updates status from "draft" to "pending"/"active"
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/jobs/ExpandableJobRow.tsx` | Collapsible job card with embedded pipeline |
| `src/components/jobs/JobQuickActivity.tsx` | Compact activity list for expanded view |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Jobs.tsx` | Add matched count query, integrate ExpandableJobRow |
| `src/hooks/useCampaignDraft.ts` | Add database persistence, load from DB fallback |
| `src/pages/CandidateMatching.tsx` | Trigger draft save when candidates added to job |

---

## UI Improvements Summary

1. **Jobs List**: Shows "47 Matched / 18 In Pipeline" instead of just pipeline count
2. **Expandable Cards**: Click to expand any job to see pipeline, activity, and actions inline
3. **Draft Persistence**: Candidates saved to database immediately, not just browser storage
4. **Resume Drafts**: Can continue campaign from any device or after browser data cleared
5. **Real-time Updates**: Pipeline counts update when leads are added via campaigns

---

## Implementation Order

1. **Database migration**: Add unique constraint to campaign_leads_v2
2. **useCampaignDraft.ts**: Add database sync logic
3. **CandidateMatching.tsx**: Trigger early draft save
4. **ExpandableJobRow.tsx**: Create new component
5. **Jobs.tsx**: Integrate new component and matched count query
6. **Testing**: Verify end-to-end flow with resume capability

