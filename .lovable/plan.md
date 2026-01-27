
# Auto-Save Progress & Local Candidates Count Improvements

## Overview

This plan addresses two key issues:
1. **Auto-Save Visibility**: Display a persistent "Saved just now" indicator in the Campaign Builder header so users know their progress is being saved
2. **Accurate Local Candidate Counts**: Show the real number of local candidates available in the database (e.g., 162 for Indiana) instead of just the loaded batch (8), with an option to load more local candidates in batches of 25-50

---

## Current State Analysis

### Auto-Save System
- The `useCampaignDraft` hook exists and provides:
  - `lastSaved: Date | null` - timestamp of last save
  - `isDirty: boolean` - whether there are unsaved changes
  - Auto-saves every 30 seconds to `localStorage` and `sessionStorage`
- The `AutoSaveIndicator` component exists but is **only used in CampaignReview**, not across the entire Campaign Builder flow

### Local Candidate Counts
- Database query shows **162 IR candidates in Indiana** but the page only loads 50 at a time
- `filterCounts.local` shows only **8** because it counts from the loaded `candidates` array, not from the database
- The AI matcher function uses a `campaign_candidate_search` database function that returns up to 500 candidates

---

## Implementation Plan

### Part 1: Global Auto-Save Indicator

#### 1.1 Update Layout Component to Accept Auto-Save Props

**File: `src/components/layout/Layout.tsx`**

Add optional props for auto-save state and display the indicator in the header next to "Campaign Builder":

```typescript
interface LayoutProps {
  children: ReactNode;
  currentStep?: number;
  showSteps?: boolean;
  // New auto-save props
  lastSaved?: Date | null;
  isDirty?: boolean;
  isSaving?: boolean;
}
```

In the header, add the AutoSaveIndicator after the "Campaign Builder" label:

```typescript
<header className="sticky top-0 z-50 h-14 flex items-center justify-between ...">
  <div className="flex items-center gap-4">
    <SidebarTrigger ... />
    <div className="h-4 w-px bg-border" />
    <span className="text-sm font-medium text-muted-foreground">Campaign Builder</span>
    {/* Auto-save indicator */}
    {lastSaved !== undefined && (
      <>
        <div className="h-4 w-px bg-border" />
        <AutoSaveIndicator 
          lastSaved={lastSaved} 
          isDirty={isDirty ?? false}
          isSaving={isSaving}
        />
      </>
    )}
  </div>
  <UserMenu />
</header>
```

#### 1.2 Integrate useCampaignDraft in Key Campaign Builder Pages

**Files to update:**
- `src/pages/CampaignBuilder.tsx` (Step 1: Job Selection)
- `src/pages/CandidateMatching.tsx` (Step 2: Match Candidates)
- `src/pages/CampaignReview.tsx` (already has it)

Each page will:
1. Import and use the `useCampaignDraft` hook
2. Pass `lastSaved`, `isDirty` to the Layout component
3. Call the appropriate update functions when state changes

**Example for CandidateMatching.tsx:**

```typescript
import { useCampaignDraft } from "@/hooks/useCampaignDraft";

const CandidateMatching = () => {
  const { lastSaved, isDirty, updateCandidates } = useCampaignDraft();
  
  // ... existing state ...

  // Sync added candidates to draft when they change
  useEffect(() => {
    if (addedToJobIds.size > 0) {
      const addedCandidates = candidates.filter(c => addedToJobIds.has(c.id));
      updateCandidates(addedCandidates as SelectedCandidate[]);
    }
  }, [addedToJobIds, candidates]);

  return (
    <Layout currentStep={2} lastSaved={lastSaved} isDirty={isDirty}>
      {/* ... */}
    </Layout>
  );
};
```

#### 1.3 Clear Draft on Campaign Launch

**File: `src/pages/CampaignReview.tsx`**

After successful campaign launch, call `clearDraft()`:

```typescript
const handleLaunch = async () => {
  // ... launch logic ...
  if (success) {
    clearDraft(); // Clear all saved progress
    navigate(`/campaigns/${campaignId}`);
  }
};
```

---

### Part 2: Accurate Local Candidate Counts & "Load More Local" Feature

#### 2.1 Fetch Total Local Count from Database

**File: `src/pages/CandidateMatching.tsx`**

Add a new state and API call to get the total count of local candidates matching the specialty:

```typescript
// New state for actual database totals
const [dbTotals, setDbTotals] = useState<{
  localTotal: number;
  otherTotal: number;
} | null>(null);

// Fetch total counts on mount
useEffect(() => {
  const fetchTotalCounts = async () => {
    if (!job?.specialty || !jobState) return;
    
    const { data, error } = await supabase
      .rpc('get_candidate_counts_by_state', {
        p_specialty: job.specialty,
        p_job_state: jobState
      });
    
    if (!error && data) {
      setDbTotals({
        localTotal: data.local_count,
        otherTotal: data.other_count
      });
    }
  };
  
  fetchTotalCounts();
}, [job?.specialty, jobState]);
```

#### 2.2 Create Database Function for Counts

**New Migration:**

```sql
CREATE OR REPLACE FUNCTION get_candidate_counts_by_state(
  p_specialty TEXT,
  p_job_state TEXT
)
RETURNS TABLE(local_count INTEGER, other_count INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE c.state = p_job_state)::INTEGER AS local_count,
    COUNT(*) FILTER (WHERE c.state != p_job_state)::INTEGER AS other_count
  FROM candidates c
  WHERE c.specialty ILIKE '%' || p_specialty || '%';
END;
$$;
```

#### 2.3 Update LOCAL Section Header with Real Counts

**File: `src/pages/CandidateMatching.tsx`**

Update the LOCAL CANDIDATES section header to show:
- Loaded count: `localPoolCandidates.length`
- Database total: `dbTotals?.localTotal`

```typescript
{/* LOCAL CANDIDATES SECTION */}
<div className="flex items-center justify-between px-4 py-3 rounded-xl bg-success/10 border border-success/30">
  <div className="flex items-center gap-3">
    <MapPin className="h-5 w-5 text-success" />
    <div>
      <h3 className="font-semibold text-success flex items-center gap-2">
        LOCAL CANDIDATES
        <Badge className="bg-success text-success-foreground">
          {localPoolCandidates.length}
          {dbTotals?.localTotal && dbTotals.localTotal > localPoolCandidates.length && (
            <span className="ml-1 opacity-80">/ {dbTotals.localTotal} in database</span>
          )}
        </Badge>
      </h3>
      <p className="text-xs text-success/70">
        Faster credentialing • No relocation • Immediate availability
      </p>
    </div>
  </div>
  <div className="flex items-center gap-2">
    {/* Load More Local button - only show if more exist */}
    {dbTotals?.localTotal && dbTotals.localTotal > candidates.filter(c => c.state === jobState).length && (
      <Button
        size="sm"
        variant="outline"
        onClick={handleLoadMoreLocal}
        disabled={isLoadingMoreLocal}
        className="border-success/30 text-success hover:bg-success/10"
      >
        {isLoadingMoreLocal ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Plus className="h-4 w-4 mr-1" />
        )}
        Load 25 More Local
      </Button>
    )}
    <Button
      size="sm"
      onClick={handleAddAllLocal}
      className="bg-success text-success-foreground hover:bg-success/90"
    >
      <Plus className="h-4 w-4 mr-1" />
      Add All ({localPoolCandidates.length})
    </Button>
  </div>
</div>
```

#### 2.4 Add "Load More Local" Handler

**File: `src/pages/CandidateMatching.tsx`**

Create a new handler that specifically fetches more local candidates:

```typescript
const [isLoadingMoreLocal, setIsLoadingMoreLocal] = useState(false);

const handleLoadMoreLocal = async () => {
  setIsLoadingMoreLocal(true);
  
  try {
    // Get current local candidate IDs to exclude
    const existingLocalIds = candidates
      .filter(c => c.state === jobState)
      .map(c => c.id);
    
    const { data, error } = await supabase
      .from('candidates')
      .select(`
        id, first_name, last_name, specialty, state, city,
        licenses, enrichment_tier, enrichment_source,
        personal_mobile, personal_email, phone, email, npi
      `)
      .ilike('specialty', `%${job?.specialty}%`)
      .eq('state', jobState)
      .not('id', 'in', `(${existingLocalIds.join(',')})`)
      .limit(25);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      // Transform to match Candidate interface
      const newCandidates = data.map(c => transformCandidate(c, jobState));
      setCandidates(prev => [...prev, ...newCandidates]);
      toast.success(`Loaded ${data.length} more local candidates`);
    } else {
      toast.info('No more local candidates available');
    }
  } catch (err) {
    console.error('Error loading more local candidates:', err);
    toast.error('Failed to load more candidates');
  } finally {
    setIsLoadingMoreLocal(false);
  }
};

// Helper function to transform DB result to Candidate interface
const transformCandidate = (c: any, jobState: string): Candidate => ({
  id: c.id,
  first_name: c.first_name || '',
  last_name: c.last_name || '',
  specialty: c.specialty || '',
  state: c.state || '',
  city: c.city || '',
  licenses: c.licenses || [],
  licenses_count: (c.licenses || []).length,
  enrichment_tier: c.enrichment_tier || 'Unknown',
  enrichment_source: c.enrichment_source,
  unified_score: calculateUnifiedScore(c, jobState),
  match_strength: calculateMatchStrength(c, jobState),
  score_reason: `Loaded via "Load More Local"`,
  icebreaker: '',
  talking_points: [],
  has_personal_contact: !!(c.personal_mobile || c.personal_email),
  needs_enrichment: !(c.personal_mobile || c.personal_email),
  is_enriched: !!(c.personal_mobile || c.personal_email),
  personal_mobile: c.personal_mobile,
  personal_email: c.personal_email,
  work_email: c.email,
  work_phone: c.phone,
  npi: c.npi,
  source: 'load_more_local',
  is_local: c.state === jobState,
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/layout/Layout.tsx` | Add auto-save props and display AutoSaveIndicator in header |
| `src/pages/CandidateMatching.tsx` | Integrate useCampaignDraft, add dbTotals state, add handleLoadMoreLocal |
| `src/pages/CampaignBuilder.tsx` | Integrate useCampaignDraft, pass auto-save props to Layout |
| `src/pages/CampaignReview.tsx` | Call clearDraft() on successful launch |
| `supabase/migrations/` | Add get_candidate_counts_by_state function |

---

## Visual Summary

### Header with Auto-Save Indicator
```text
┌──────────────────────────────────────────────────────────────────┐
│ ☰  │  Campaign Builder  │  ☁ Saved just now        [UserMenu]  │
└──────────────────────────────────────────────────────────────────┘
```

### LOCAL Section with Counts
```text
┌── LOCAL CANDIDATES ──────────────────────────────────────────────┐
│ 📍 LOCAL CANDIDATES [8 / 162 in database]   [Load 25 More] [Add]│
│ Faster credentialing • No relocation • Immediate availability   │
├──────────────────────────────────────────────────────────────────┤
│ Dr. Harris    LOCAL  A+ 99%  ...                                │
│ Dr. Natarajan LOCAL  A+ 99%  ...                                │
│ ...                                                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Expected Behavior

1. **Auto-Save Visibility**:
   - Header shows "Saved just now" or "Saved 2 min ago" after any state change
   - Shows "Unsaved changes" (amber) if dirty and not yet saved
   - Shows "Saving..." with spinner during save
   - Cleared when campaign is launched

2. **Local Candidate Counts**:
   - Section header shows "8 / 162 in database" format
   - "Load 25 More Local" button appears when more exist
   - Each click loads 25 more local candidates from DB
   - Stats update in real-time as more candidates are loaded
   - Button disappears when all local candidates are loaded
