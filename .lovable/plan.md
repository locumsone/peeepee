
# Deep Research Bug Fix

## Problem Summary

The "Deep Research" feature appears to work but returns cached results instead of performing actual Perplexity web searches. Users see "Deep" badges and cached research summaries, but no fresh web research is executed.

## Root Cause Analysis

### Issue 1: Aggressive Cache Validation (Edge Function)

In `personalization-research/index.ts` lines 703-722, the cache logic treats candidates as "deeply researched" based solely on icebreaker length (>60 chars), without verifying if actual Perplexity web research was performed.

```text
Current Logic:
- icebreaker > 60 chars + talking_points exist → treat as deeply researched
- Connection engine generates icebreakers > 60 chars
- Result: All connection-based icebreakers pass the cache check
```

### Issue 2: Missing Deep Research Flag in Database

The `candidate_job_matches` table stores `icebreaker` and `talking_points`, but there's no dedicated `deep_researched` or `research_source` column to distinguish between:
- Quick research (NPI verification only)
- Connection-based personalization (no web search)
- Deep research (actual Perplexity web search)

### Issue 3: Frontend Flag Propagation

In `CandidateMatching.tsx` lines 829-858, the `deep_researched` flag is set incorrectly:

```typescript
// Current (problematic):
const actualDeepResearch = !result.from_cache || 
  (result.icebreaker && result.icebreaker.length > 60) ||
  result.deep_research_done;

// Result: Cached results with long icebreakers get marked as "deep researched"
```

---

## Proposed Fixes

### Fix 1: Add Research Source Tracking (Edge Function)

Update the `upsert_candidate_job_match` RPC call to store a `research_source` field that explicitly tracks how the data was generated:

```text
research_source values:
- 'perplexity_deep'  → Actual web research via Perplexity
- 'connection_engine' → Generated from connection priority system
- 'quick_research'    → NPI/cache only
- 'cached'           → Loaded from database
```

### Fix 2: Stricter Cache Validation (Edge Function)

Modify the cache check to require explicit evidence of Perplexity research:

```text
Current: icebreakerIsSubstantial && hasQualityData
New:     icebreakerIsSubstantial && hasResearchSummary && researchSummaryHasPerplexityFormat
```

The check should look for Perplexity-style structured content (contains "EMPLOYER", "TRAINING", "CREDENTIALS" sections) rather than just length.

### Fix 3: Add "Force Refresh" Auto-Trigger (Frontend)

When clicking "Deep Research" for the first time on a candidate without verified Perplexity data, automatically set `force_refresh: true` to bypass the cache.

---

## Implementation Details

### File 1: `supabase/functions/personalization-research/index.ts`

**Changes:**
1. Update cache validation (lines 703-722) to check for actual Perplexity content:
   - Add helper function `hasPerplexityResearch(researchSummary)` that checks for structured sections
   - Only cache as "deep researched" if research contains Perplexity-format data

2. Add `deep_research_done` flag to response when actual Perplexity calls are made

3. Update database upsert to include research source tracking

```text
Cache Validation Logic:
┌──────────────────────────────────────────────────────────┐
│ IS DEEP RESEARCH CACHED?                                 │
├──────────────────────────────────────────────────────────┤
│ 1. Check if icebreaker exists AND > 60 chars            │
│ 2. Check if research_summary exists AND > 100 chars     │
│ 3. Check if research_summary contains structured format │
│    (has EMPLOYER/TRAINING/CREDENTIALS sections)         │
│ 4. ALL THREE must be true to skip Perplexity call       │
└──────────────────────────────────────────────────────────┘
```

### File 2: `src/pages/CandidateMatching.tsx`

**Changes:**
1. Update `deepResearchCandidates` function (lines 762-885):
   - When `from_cache: true` but no substantial `research_summary`, trigger re-research with `force_refresh: true`
   - Add flag to detect first-time deep research attempts

2. Update state management (lines 829-858):
   - Only set `deep_researched: true` when response includes `deep_research_done: true` OR verified Perplexity content
   - Add UI indicator for "research source" (e.g., "🔮 Perplexity" vs "⚡ Connection Engine")

3. Fix the `handleDeepResearchCandidate` function (lines 887-895):
   - When candidate has no verified deep research, automatically set `forceRefresh: true`

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/personalization-research/index.ts` | Stricter cache validation, add `deep_research_done` flag, research source tracking |
| `src/pages/CandidateMatching.tsx` | Fix deep research flag propagation, auto-force-refresh for first deep research |

---

## Testing Plan

1. Clear candidate_job_matches for a test candidate
2. Run "Quick Research" (NPI only) - verify no "Deep" badge
3. Run "Deep Research" - verify Perplexity is called (check edge function logs)
4. Verify `research_summary` contains structured EMPLOYER/TRAINING format
5. Refresh page - verify cached deep research shows correctly
6. Click "Deep Research" again - verify it shows "Refresh" option (not re-research)

---

## Success Criteria

1. "Deep Research" button triggers actual Perplexity API calls (not cache hits on first run)
2. Edge function logs show "Deep researching: [Name]" messages
3. UI clearly distinguishes between cached and fresh research
4. Refresh button works to re-fetch from Perplexity
5. Research summaries contain structured professional data (fellowship, employer, certifications)
