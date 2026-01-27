
# Campaign Builder Bug Review & Dashboard Redesign

## Executive Summary

This plan addresses two main objectives:
1. **Bug Review**: Comprehensive audit of the campaign builder flow from job entry to launch
2. **Dashboard Redesign**: Transform the home page from static stats to a data-driven command center with real insights

---

## Part 1: Campaign Builder Bug Review

### A. Critical Bugs Found

#### BUG-001: Navigation Path Inconsistency (CRITICAL)
**Location**: `CandidateMatching.tsx` line 1228
**Issue**: The "Continue" button navigates to `/campaigns/new/personalize`, but this route requires candidates in `sessionStorage`. If the shortlist (`addedToJobIds`) is empty but `selectedIds` has values, users see an empty state.
**Fix**: Add validation before navigation and consolidate the selection model

#### BUG-002: Jobs Page "Start Campaign" Button Uses Wrong ID Pattern
**Location**: `Jobs.tsx` line 203
**Issue**: Button navigates to `/campaigns/new?jobId=${job.id}` but `CandidateMatching.tsx` falls back to a hardcoded job ID when no `jobId` query param is processed correctly. The `effectiveJobId` fallback (line 274) masks the real issue.
**Fix**: Remove the hardcoded fallback; show proper error when no job is selected

#### BUG-003: Session Storage Race Condition
**Location**: `CandidateMatching.tsx` lines 1207-1227
**Issue**: Multiple `sessionStorage.setItem` calls happen sequentially without awaiting, and `CampaignReview.tsx` reads from both the new unified draft system AND legacy keys, creating potential data conflicts.
**Fix**: Use the `useCampaignDraft` hook consistently across all pages

#### BUG-004: NewJobEntry.tsx Navigates to Wrong Route
**Location**: `NewJobEntry.tsx` line 225
**Issue**: After saving, navigates to `/candidates?jobId=${data.id}` but this route doesn't exist (should be `/candidates/matching?jobId=${data.id}`)
**Fix**: Correct the navigation path

#### BUG-005: Enrichment Results Not Persisting Across Page Refreshes
**Location**: `StepPrepareCandidates.tsx`
**Issue**: Enrichment results are stored in component state (`enrichmentResults`) but not synced to the draft system. If user refreshes, they lose visibility of which candidates were enriched.
**Fix**: Persist enrichment status to the `useCampaignDraft` hook

#### BUG-006: Launch Pre-Flight Check Always Fails for Integrations
**Location**: `LaunchStatusBar.tsx` lines 135-136
**Issue**: The integration check (`integrationsConnected`) is always false initially because `StepConnectChannels` hasn't run its API check yet when `LaunchStatusBar` renders.
**Fix**: Make integration check async or lazy-load the status

### B. Warning-Level Issues

#### WARN-001: Duplicate Job Entries
**Database Query Result**: Multiple identical jobs exist (e.g., 5 "IR - Humble, TX" entries)
**Recommendation**: Add upsert logic or duplicate detection in `JobEntry.tsx`

#### WARN-002: Research Counter Shows 0/50 Despite Cached Data
**Root Cause**: Already fixed in previous session by adding batching to `ai-candidate-matcher`, but may still occur if batch size changes
**Recommendation**: Add retry logic and better error handling in research status display

#### WARN-003: Tier Stats Calculation Uses Inconsistent Score Parsing
**Location**: `CampaignReview.tsx` line 207
**Issue**: Tier calculation uses `unified_score?.startsWith("A")` but unified_score can be numeric or letter grade
**Fix**: Normalize score format before comparison

### C. UX Friction Points

1. **No Clear Progress Indicator**: Users don't know they're on step 3 of 5
2. **"Hot Leads" Counter on Dashboard**: Currently queries `action_type = 'reply'` but no replies exist yet
3. **Callbacks Section**: Queries `ai_call_queue` for scheduled callbacks but most have `scheduled_at = now()` making them immediately due

---

## Part 2: Dashboard Redesign

### Current State Analysis

**Data Available**:
- 98 total jobs (22 active, 7 open)
- 138,490 candidates (64 enriched with personal contact)
- 2 campaigns (1 active)
- 4 SMS messages (1 inbound reply)
- 2 AI calls logged

**Current Dashboard Problems**:
1. Stats are mostly zeros or placeholders
2. Activity feed shows "No recent activity" because `activity_log` is empty
3. Callbacks section queries wrong table
4. No connection to real campaign performance
5. Static greeting without personalized insights

### Redesigned Dashboard Structure

```text
+-----------------------------------------------+
|  Good morning, [Name]                         |
|  3 active jobs need candidates                |
|  [Quick Campaign]  [Add Job]                  |
+-----------------------------------------------+

+----------+----------+----------+----------+
| ACTIVE   | CANDIDATES| SMS     | CALLS    |
| JOBS     | ENRICHED  | SENT    | THIS WEEK|
|   22     |    64     |   4     |    2     |
+----------+----------+----------+----------+

+------------------------+----------------------+
| YOUR JOBS              | RECENT ACTIVITY      |
| [Kanban cards with     | [Unified feed from   |
|  real job data,        |  sms_messages,       |
|  candidate counts,     |  ai_call_logs,       |
|  next actions]         |  campaign_events]    |
|                        |                      |
| [+ New Job]            |                      |
+------------------------+----------------------+

+------------------------+----------------------+
| PIPELINE SUMMARY       | TOP CANDIDATES       |
| [Visual showing        | [High-match candidates|
|  candidates by stage]  |  awaiting outreach]  |
+------------------------+----------------------+
```

### Dashboard Data Sources (All Real)

| Widget | Data Source | Query |
|--------|-------------|-------|
| Active Jobs | `jobs` table | `WHERE status IN ('active', 'open')` |
| Candidates Enriched | `candidates` | `WHERE personal_mobile IS NOT NULL OR personal_email IS NOT NULL` |
| SMS Activity | `sms_messages` | `WHERE created_at >= NOW() - INTERVAL '7 days'` |
| Calls This Week | `ai_call_logs` | `WHERE created_at >= NOW() - INTERVAL '7 days'` |
| Recent Activity | Combined query | Union of SMS, calls, campaign events |
| Your Jobs | `jobs` | Last 6 jobs with candidate counts |
| Pipeline | `campaign_leads_v2` | Grouped by status |
| Top Candidates | `candidate_job_matches` | Ordered by match_score DESC |

---

## Implementation Plan

### Phase 1: Critical Bug Fixes

| Task | File | Priority |
|------|------|----------|
| Fix NewJobEntry navigation to `/candidates/matching` | `NewJobEntry.tsx` | P0 |
| Remove hardcoded `effectiveJobId` fallback | `CandidateMatching.tsx` | P0 |
| Add validation before "Continue" navigation | `CandidateMatching.tsx` | P0 |
| Fix session storage sync in `handleContinue` | `CandidateMatching.tsx` | P1 |
| Make integration check async in pre-flight | `LaunchStatusBar.tsx` | P1 |
| Persist enrichment results to draft | `StepPrepareCandidates.tsx` | P2 |

### Phase 2: Dashboard Redesign

1. **Create new dashboard components**:
   - `DashboardJobCard.tsx` - Mini job cards with real stats
   - `DashboardActivityFeed.tsx` - Unified activity from SMS, calls, events
   - `DashboardPipeline.tsx` - Visual candidate pipeline
   - `DashboardStats.tsx` - Real-time stat widgets

2. **Update Dashboard.tsx**:
   - Replace static stats with real queries
   - Add job list section
   - Create unified activity feed
   - Add pipeline visualization
   - Show top candidates needing action

3. **Database queries to add**:
   - Recent communications (SMS + calls + emails)
   - Candidate pipeline by status
   - Jobs with candidate counts
   - Hot leads (replies in last 24h)

---

## Technical Details

### Bug Fix: NewJobEntry Navigation
```typescript
// Line 225: Change from
navigate(`/candidates?jobId=${data.id}`);
// To
navigate(`/candidates/matching?jobId=${data.id}`);
```

### Bug Fix: Remove Hardcoded JobId
```typescript
// Line 274: Change from
const effectiveJobId = jobId || "befd5ba5-4e46-41d9-b144-d4077f750035";
// To
const effectiveJobId = jobId;
// Add early return if no jobId
if (!jobId) {
  return <NoJobSelectedState />;
}
```

### Dashboard: Unified Activity Query
```sql
SELECT 
  'sms' as source,
  id,
  created_at,
  CASE WHEN direction = 'inbound' THEN 'sms_reply' ELSE 'sms_sent' END as action_type,
  to_number as related_phone,
  body as preview
FROM sms_messages
WHERE created_at >= NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
  'call' as source,
  id::text,
  created_at,
  CASE WHEN call_result = 'interested' THEN 'call_interested' ELSE 'call_completed' END,
  phone_number,
  call_summary
FROM ai_call_logs
WHERE created_at >= NOW() - INTERVAL '7 days'

ORDER BY created_at DESC
LIMIT 20
```

### Dashboard: Jobs with Candidate Counts
```sql
SELECT 
  j.id,
  j.job_name,
  j.specialty,
  j.state,
  j.facility_name,
  j.status,
  j.pay_rate,
  COUNT(DISTINCT c.id) as matched_candidates,
  COUNT(DISTINCT cl.id) as campaign_leads
FROM jobs j
LEFT JOIN candidates c ON c.specialty ILIKE '%' || j.specialty || '%' AND c.state = j.state
LEFT JOIN campaign_leads_v2 cl ON cl.candidate_state = j.state
WHERE j.status IN ('active', 'open')
GROUP BY j.id
ORDER BY j.created_at DESC
LIMIT 6
```

---

## Files to Modify

### Phase 1 (Bug Fixes):
- `src/pages/NewJobEntry.tsx` - Fix navigation path
- `src/pages/CandidateMatching.tsx` - Remove fallback, add validation
- `src/components/campaign-review/LaunchStatusBar.tsx` - Async integration check
- `src/components/campaign-review/StepPrepareCandidates.tsx` - Persist enrichment

### Phase 2 (Dashboard):
- `src/pages/Dashboard.tsx` - Complete redesign
- `src/components/dashboard/DashboardJobCard.tsx` - New component
- `src/components/dashboard/DashboardActivityFeed.tsx` - New component
- `src/components/dashboard/DashboardPipeline.tsx` - New component
- `src/components/dashboard/DashboardStats.tsx` - New component

---

## Success Metrics

After implementation:
1. Zero "Campaign not found" errors after launch
2. Dashboard shows real data from all 98 jobs
3. Activity feed shows SMS and call activity
4. Jobs section shows actual candidate matches
5. Users can see enrichment progress clearly
6. Pre-flight checks complete without false failures
