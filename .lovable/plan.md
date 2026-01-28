
# Job Detail Page - Full Implementation Plan

## Problem Summary
The Job Detail page for "IR Middletown" shows **52 matched candidates** in the job list, but when you navigate to the job detail page:
1. **No candidates are displayed** because the page only shows candidates from `campaign_leads_v2` (requires a campaign to be created)
2. The **matched candidates** from `candidate_job_matches` are completely hidden
3. The **Notes panel uses mock/demo data** instead of real database data
4. There's no way to see or work with matched candidates until a campaign is created

## Root Cause Analysis

| Issue | Current State | Fix Required |
|-------|---------------|--------------|
| Matched candidates not shown | Only fetches from `campaign_leads_v2` (campaign leads) | Add a "Matched Candidates" tab showing `candidate_job_matches` data |
| Notes use demo data | `JobNotesPanel.tsx` uses `MOCK_NOTES` array | Create `job_notes` table and connect to database |
| No job_notes table | Table doesn't exist | Create migration |
| Candidate tab empty | Only shows campaign leads, not matched candidates | Display both matched candidates and pipeline leads |

## Implementation Plan

### Phase 1: Database Changes

**1.1 Create `job_notes` table**
```text
+------------------+
|    job_notes     |
+------------------+
| id (uuid, PK)    |
| job_id (FK)      |
| content (text)   |
| created_by (FK)  |
| is_pinned (bool) |
| created_at       |
| updated_at       |
+------------------+
```

- Add RLS policies for team visibility
- Index on job_id for performance

### Phase 2: Job Detail Page Enhancements

**2.1 Modify JobDetail.tsx**
- Add new state for matched candidates (from `candidate_job_matches` + `candidates` join)
- Create "Matched" vs "Pipeline" toggle in candidates tab
- Fetch matched candidates with their full profile data
- Show matched candidates even when no campaigns exist

**2.2 Update Candidates Tab Structure**

Current flow (broken):
```text
Candidates Tab --> campaign_leads_v2 --> Empty if no campaigns
```

New flow:
```text
Candidates Tab
  |
  +-- [Matched] --> candidate_job_matches + candidates join (52 candidates)
  |
  +-- [In Pipeline] --> campaign_leads_v2 (campaign activity)
```

**2.3 Create `MatchedCandidateCard.tsx`**
- New card component for displaying matched candidates (not yet in a campaign)
- Shows: Name, specialty, state, licenses, match score
- Quick actions: Add to Campaign, View Profile, Call, SMS

### Phase 3: Update JobNotesPanel.tsx

**3.1 Remove demo data**
- Delete `MOCK_NOTES` array
- Implement real database queries
- Add note creation with `supabase.from("job_notes").insert()`
- Add note fetching with real-time updates
- Store `created_by` as actual user ID

### Phase 4: Additional Improvements

**4.1 Activity Feed Enhancement**
- Ensure JobActivityFeed shows activity even for jobs without campaigns
- Add call logs that link by candidate phone matching matched candidates

**4.2 Scorecard Integration**
- Pass matched candidates to scorecard when no pipeline leads exist
- Auto-evaluate based on job requirements vs candidate profile

**4.3 Quick Stats Accuracy**
- Ensure "Matched" count links to the matched candidates tab
- Add click-through from stats to filtered view

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/xxx_create_job_notes.sql` | Create | New table for job notes |
| `src/pages/JobDetail.tsx` | Modify | Add matched candidates fetch and toggle |
| `src/components/jobs/JobNotesPanel.tsx` | Modify | Connect to database, remove mock data |
| `src/components/jobs/MatchedCandidateCard.tsx` | Create | New card for matched candidates |
| `src/components/jobs/MatchedCandidatesGrid.tsx` | Create | Grid view for matched candidates |
| `src/components/jobs/JobScorecard.tsx` | Modify | Accept matched candidates as fallback |
| `src/integrations/supabase/types.ts` | Auto-update | Add job_notes types |

## Technical Details

### Matched Candidates Query
```sql
SELECT 
  c.id, c.first_name, c.last_name, c.email, c.phone,
  c.specialty, c.state, c.licenses, c.board_certified,
  cjm.match_score, cjm.created_at as matched_at
FROM candidate_job_matches cjm
JOIN candidates c ON c.id = cjm.candidate_id
WHERE cjm.job_id = :jobId
ORDER BY cjm.match_score DESC NULLS LAST
```

### Notes Table RLS
- All authenticated users can read notes for jobs they can access
- Users can only update/delete their own notes
- Admins can manage all notes

## User Experience Flow (After Fix)

1. Click on "IR Middletown" job (52 matched)
2. Job Detail loads with Quick Stats: **52 Matched** | 0 In Pipeline | 0 Replies
3. Candidates tab shows two sub-tabs: **Matched (52)** | Pipeline (0)
4. Matched tab displays all 52 candidates with their profiles
5. User can select candidates and "Add to Campaign"
6. Notes tab shows real internal notes from database
7. Scorecard evaluates matched candidates against job requirements
