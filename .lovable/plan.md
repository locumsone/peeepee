
# Enhanced ATS-Style Candidate Selection Workflow

## Research Findings: Best Practices from Modern ATS Systems

Based on research from leading ATS platforms (Bullhorn, Lever, Recruitee, iCIMS), here are the key UX patterns that make candidate selection effective:

### Key UX Patterns from ATS Industry Leaders

1. **Two-Panel "Pool vs Shortlist" Model**: Candidates exist in a search pool, and users explicitly "add to job" to move them to a shortlist. Once added, they're visually differentiated or removed from the pool view.

2. **Persistent Selection State**: Selected candidates remain selected even when filters change. The "shortlist" is independent of the current view filter.

3. **Quick Actions**: Add-to-job should be a single click, not a multi-step process. Remove should be equally easy.

4. **Filter + Add Workflow**: Users filter (e.g., "Local"), review results, then add all or select specific candidates to the job pipeline.

5. **Visual Separation**: Clear distinction between "Candidates in Pool" vs "Candidates Added to This Job" using badges, sections, or color coding.

6. **Summary Bar**: Always-visible summary showing "X added to job | Y in pool | Z total matched"

---

## Current State Analysis

### What Works Now
- AI matching loads candidates into a list
- Checkbox selection allows multi-select
- Filters (Local, 10+ Licenses, Contact Ready) filter the view
- "Continue with X Candidates" saves to session and navigates

### What's Missing (User's Request)
1. No "Add to Job" action - candidates are just selected, not explicitly added
2. Unchecking a candidate doesn't "remove" them - they stay in the list
3. Filters only hide/show - they don't help you "find more local ones" and add them
4. No visual separation between "Added to Job" vs "Available in Pool"
5. No way to remove candidates from the search area after adding them

---

## Proposed Solution: Dual-State Candidate Management

### Concept: "Pool" vs "Added" States

```text
+------------------------------------------------------------------+
|  JOB: Interventional Radiology - Wisconsin Medical Center        |
+------------------------------------------------------------------+
|                                                                   |
|  CAMPAIGN SHORTLIST (12 candidates added)          [View All →]  |
|  +----------------------------------------------------------+    |
|  | Dr. Smith (95%) | Dr. Jones (92%) | Dr. Lee (90%) | +9   |    |
|  +----------------------------------------------------------+    |
|                                                                   |
+------------------------------------------------------------------+
|  CANDIDATE POOL                              [Filters: Local ▼]  |
|  +----------------------------------------------------------+    |
|  | [ ] Dr. Johnson - IR, WI - Local - 94% match  [+ Add]    |    |
|  | [✓] Dr. Wilson - IR, MN - 12 licenses - 89%   [Added ✓]  |    |
|  | [ ] Dr. Brown - IR, TX - 8 licenses - 85%     [+ Add]    |    |
|  +----------------------------------------------------------+    |
|                                                                   |
|  [+ Add All Visible (8)] [Continue with 12 Candidates →]        |
+------------------------------------------------------------------+
```

### Key Changes

**1. New State: `addedToJobIds` (Set)**
- Separate from checkbox selection
- Represents candidates explicitly added to this job/campaign
- Persists when filters change
- These are the candidates that move to the next step

**2. "Add to Job" Action**
- Each candidate row gets an "Add" button
- Clicking adds the candidate to `addedToJobIds`
- The row shows "Added ✓" badge and can be optionally hidden from pool

**3. "Remove from Job" Action**  
- Candidates with "Added ✓" status can be removed
- They return to the pool as unselected

**4. Filter + Add Workflow**
- Click "Local" filter → Shows only local candidates
- Click "Add All Visible" → Adds all visible to job
- Clear filter → See full pool, but added candidates show "Added ✓"

**5. Shortlist Summary Banner**
- Collapsible section at top showing all added candidates
- Quick overview with match scores and key tags
- Click to expand and see full list with ability to remove

**6. Hide Added Toggle**
- Checkbox: "Hide added candidates from pool" (default: off)
- When on, added candidates disappear from the search list
- Keeps focus on finding more candidates to add

---

## Implementation Plan

### Phase 1: Core State Management

**File: `src/pages/CandidateMatching.tsx`**

Add new state:
```typescript
// Candidates explicitly added to this job (the "shortlist")
const [addedToJobIds, setAddedToJobIds] = useState<Set<string>>(new Set());
// Toggle to hide added candidates from pool view
const [hideAdded, setHideAdded] = useState(false);
```

Add handlers:
```typescript
const handleAddToJob = (candidateId: string) => {
  setAddedToJobIds(prev => new Set(prev).add(candidateId));
  toast.success("Added to campaign shortlist");
};

const handleRemoveFromJob = (candidateId: string) => {
  setAddedToJobIds(prev => {
    const next = new Set(prev);
    next.delete(candidateId);
    return next;
  });
  toast.info("Removed from campaign shortlist");
};

const handleAddAllVisible = () => {
  const visibleIds = sortedCandidates.map(c => c.id);
  setAddedToJobIds(prev => {
    const next = new Set(prev);
    visibleIds.forEach(id => next.add(id));
    return next;
  });
  toast.success(`Added ${visibleIds.length} candidates to shortlist`);
};
```

### Phase 2: Shortlist Summary Banner

**New Component: `src/components/candidates/ShortlistBanner.tsx`**

A collapsible banner at the top of the page showing:
- Count of added candidates
- Horizontal scrollable list of candidate chips with match scores
- Quick remove (X) button on each chip
- "View Details" expands to full list
- Key stats: "8 Contact Ready | 5 Local | 3 with 10+ Licenses"

```text
+------------------------------------------------------------------+
| 📋 SHORTLIST (12 candidates)                    [Collapse ▲]     |
+------------------------------------------------------------------+
| [Dr. Smith 95% ×] [Dr. Jones 92% ×] [Dr. Lee 90% ×] +9 more     |
| Stats: 8 Contact Ready • 5 Local • 3 with 10+ Licenses           |
+------------------------------------------------------------------+
```

### Phase 3: Updated Candidate Row UI

Each candidate card gets:
- **Add Button**: Shows "Add to Campaign" if not added
- **Added Badge**: Shows "✓ Added" with green styling if added
- **Remove Option**: Click the "✓ Added" badge to remove

```typescript
// In the candidate row
{addedToJobIds.has(candidate.id) ? (
  <Button
    variant="outline"
    size="sm"
    className="bg-success/20 border-success/40 text-success"
    onClick={() => handleRemoveFromJob(candidate.id)}
  >
    <Check className="h-4 w-4 mr-1" />
    Added
  </Button>
) : (
  <Button
    variant="outline"
    size="sm"
    onClick={() => handleAddToJob(candidate.id)}
  >
    <Plus className="h-4 w-4 mr-1" />
    Add
  </Button>
)}
```

### Phase 4: Pool Filtering Logic

Update the filter logic to optionally hide added candidates:
```typescript
const poolCandidates = useMemo(() => {
  let pool = sortedCandidates;
  if (hideAdded) {
    pool = pool.filter(c => !addedToJobIds.has(c.id));
  }
  return pool;
}, [sortedCandidates, hideAdded, addedToJobIds]);
```

Add toggle in the filter bar:
```typescript
<div className="flex items-center gap-2">
  <Checkbox
    id="hideAdded"
    checked={hideAdded}
    onCheckedChange={(checked) => setHideAdded(!!checked)}
  />
  <label htmlFor="hideAdded" className="text-sm text-muted-foreground">
    Hide added candidates
  </label>
</div>
```

### Phase 5: Updated Continue Flow

Change the "Continue" button to use `addedToJobIds` instead of `selectedIds`:
```typescript
const handleContinue = () => {
  const addedCandidates = candidates.filter(c => addedToJobIds.has(c.id));
  
  sessionStorage.setItem("selectedCandidates", JSON.stringify(addedCandidates));
  sessionStorage.setItem("campaign_candidates", JSON.stringify(addedCandidates));
  sessionStorage.setItem("campaign_candidate_ids", JSON.stringify(Array.from(addedToJobIds)));
  
  // ... rest of job data saving
  navigate("/campaigns/new/personalize");
};
```

### Phase 6: Remove Legacy Checkbox Selection

Since "Add to Job" replaces the old checkbox selection:
- Remove the checkbox from each row
- Remove `selectedIds` state (or repurpose for bulk actions)
- The shortlist IS the selection

**Alternative**: Keep checkboxes for bulk operations (bulk add, bulk research) but use `addedToJobIds` for final campaign selection.

---

## Updated User Flow

1. User arrives at Candidate Matching with job context
2. AI loads matched candidates into the **Pool**
3. User clicks "Add" on individual high-match candidates → They appear in **Shortlist Banner**
4. User clicks "Local" filter → Pool shows only local candidates
5. User clicks "Add All Visible" → All local candidates added to Shortlist
6. User toggles "Hide Added" → Pool now shows only un-added candidates
7. User can click "10+ Licenses" filter → Find more to add
8. Shortlist shows running total: "18 candidates added"
9. User reviews Shortlist Banner, removes any unwanted
10. User clicks "Continue with 18 Candidates" → Moves to Personalization

---

## Technical Details

### File Changes

| File | Change |
|------|--------|
| `src/pages/CandidateMatching.tsx` | Add `addedToJobIds` state, add/remove handlers, update UI, update continue flow |
| `src/components/candidates/ShortlistBanner.tsx` | **NEW** - Collapsible banner showing added candidates |
| `src/components/candidates/AddCandidatesPanel.tsx` | Update to use "Add to Job" instead of checkbox selection |

### State Flow

```text
Candidate Pool (from AI matcher)
       ↓
   [Add to Job]
       ↓
Shortlist (addedToJobIds Set)
       ↓
   [Continue]
       ↓
Session Storage → PersonalizationStudio
```

### Key Props for ShortlistBanner

```typescript
interface ShortlistBannerProps {
  candidates: Candidate[];
  addedIds: Set<string>;
  onRemove: (id: string) => void;
  onClear: () => void;
  jobState: string; // For showing "Local" badges
}
```

---

## Success Criteria

1. Users can "Add to Job" individual candidates with one click
2. Added candidates are visually distinct in the pool (or hidden)
3. Shortlist banner shows real-time count and summary
4. Filters help find specific candidates to add (e.g., "show me locals")
5. "Add All Visible" quickly adds filtered results
6. Users can remove candidates from shortlist before continuing
7. Only shortlisted candidates proceed to Personalization Studio
8. Next page (Personalization) shows all added candidates with scores/tags/status
