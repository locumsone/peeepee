
# Enhanced Candidate Selection - "Add More Candidates" Feature

## Overview

This feature enhances the Candidate Matching page (`/candidates/matching`) to allow recruiters to:
1. **Preserve** their current selection of candidates (e.g., 50 selected)
2. **Search** for additional candidates from the database with specific filters (Local, 10+ Licenses, etc.)
3. **Add** newly found candidates to the existing queue without losing current selections

---

## Current State Analysis

### How It Works Now
- Candidates are loaded in batches of 50 from the `ai-candidate-matcher` edge function
- Selection is stored in a `selectedIds` state (Set of IDs)
- Quick filters exist (Local, 10+ Licenses, Contact Ready) but they only **filter the current view** - they don't search for MORE candidates
- "Load More" fetches the next batch from the same query
- Alpha Sophia search exists but only searches external sources

### The Gap
There's no way to:
- Search the database for specific candidate types (e.g., "find me more local candidates")
- Add those candidates to the current list without replacing it
- Keep the current 50 selected while adding more

---

## New Feature: "Add More Candidates" Panel

### UI Design

```text
+------------------------------------------------------------------+
|  [Current Selection Bar]                                          |
|  50 candidates selected    [Continue] [+ Add More Candidates]     |
+------------------------------------------------------------------+

When clicked, opens a Sheet panel:

+------------------------------------------------------------------+
|  ADD MORE CANDIDATES                                    [X Close] |
+------------------------------------------------------------------+
|  Your 50 selected candidates are preserved.                       |
|  Search for additional candidates to add to your campaign.        |
+------------------------------------------------------------------+
|  QUICK SEARCH                                                     |
|  +--------------------+ +--------------------+                    |
|  | [x] Local (WI)     | | [x] 10+ Licenses   |                    |
|  | Candidates in      | | Multi-state        |                    |
|  | job state          | | travelers          |                    |
|  +--------------------+ +--------------------+                    |
|  +--------------------+ +--------------------+                    |
|  | [ ] Contact Ready  | | [ ] Needs Enrichmt |                    |
|  | Has personal       | | Missing personal   |                    |
|  | contact info       | | contact info       |                    |
|  +--------------------+ +--------------------+                    |
+------------------------------------------------------------------+
|  [Search by Name/NPI]  ___________________________  [Search]      |
+------------------------------------------------------------------+
|  EXCLUDE ALREADY SELECTED: [x] Yes                                |
+------------------------------------------------------------------+
|                                                                   |
|  RESULTS (23 found)                                               |
|  +--------------------------------------------------------------+ |
|  | [ ] Dr. John Smith - IR, WI - 12 licenses - 94% match        | |
|  | [ ] Dr. Jane Doe - IR, MN - 8 licenses - Local - 89% match   | |
|  | ...                                                          | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  [Select All (23)] [Add Selected to Campaign]                     |
+------------------------------------------------------------------+
```

---

## Implementation Plan

### Phase 1: New Component - AddCandidatesPanel

Create `src/components/candidates/AddCandidatesPanel.tsx`:

**Features:**
- Sheet panel that slides in from the right (500px width)
- Filter checkboxes: Local, 10+ Licenses, 5+ Licenses, Contact Ready, Needs Enrichment
- Text search input for name/NPI
- Toggle to exclude already-selected candidates
- Results list with checkboxes
- "Add Selected" button that merges with existing selection

**Props:**
```typescript
interface AddCandidatesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobState: string;
  specialty: string;
  existingCandidateIds: Set<string>;
  onAddCandidates: (candidates: Candidate[]) => void;
}
```

### Phase 2: Database Search Function

The panel will query Supabase directly for candidates matching the filters:

```typescript
// Build dynamic query based on filters
let query = supabase
  .from("candidates")
  .select(`
    id, first_name, last_name, specialty, state, city,
    licenses, enrichment_tier, personal_mobile, personal_email,
    phone, email
  `)
  .ilike("specialty", `%${specialty}%`)
  .limit(100);

// Apply filters
if (filters.local) {
  query = query.eq("state", jobState);
}
if (filters.tenPlusLicenses) {
  query = query.gte("array_length(licenses, 1)", 10);
}
if (filters.contactReady) {
  query = query.or("personal_mobile.neq.null,personal_email.neq.null");
}
if (filters.excludeSelected && existingIds.length > 0) {
  query = query.not("id", "in", `(${existingIds.join(",")})`);
}
if (nameSearch) {
  query = query.or(`first_name.ilike.%${nameSearch}%,last_name.ilike.%${nameSearch}%`);
}
```

### Phase 3: Integration with CandidateMatching.tsx

**Changes to main page:**

1. Add state for panel visibility:
```typescript
const [addPanelOpen, setAddPanelOpen] = useState(false);
```

2. Add handler to merge new candidates:
```typescript
const handleAddCandidates = (newCandidates: Candidate[]) => {
  // Merge new candidates with existing list (avoid duplicates)
  const existingIds = new Set(candidates.map(c => c.id));
  const uniqueNew = newCandidates.filter(c => !existingIds.has(c.id));
  
  setCandidates(prev => [...prev, ...uniqueNew]);
  
  // Auto-select the newly added candidates
  setSelectedIds(prev => {
    const next = new Set(prev);
    uniqueNew.forEach(c => next.add(c.id));
    return next;
  });
  
  toast.success(`Added ${uniqueNew.length} candidates to your selection`);
  setAddPanelOpen(false);
};
```

3. Add button in selection bar:
```typescript
{selectedIds.size > 0 && (
  <Button 
    variant="outline" 
    onClick={() => setAddPanelOpen(true)}
    className="bg-blue-500/10 border-blue-500/30 text-blue-400"
  >
    <Plus className="h-4 w-4 mr-2" />
    Add More Candidates
  </Button>
)}
```

4. Render the panel:
```typescript
<AddCandidatesPanel
  isOpen={addPanelOpen}
  onClose={() => setAddPanelOpen(false)}
  jobId={effectiveJobId}
  jobState={jobState}
  specialty={job?.specialty || ""}
  existingCandidateIds={new Set(candidates.map(c => c.id))}
  onAddCandidates={handleAddCandidates}
/>
```

### Phase 4: Selection Persistence Banner

Add a visual indicator that selections are preserved:

```typescript
{selectedIds.size > 0 && addPanelOpen && (
  <div className="bg-success/10 border border-success/30 rounded-lg p-3 flex items-center gap-2">
    <CheckCircle2 className="h-5 w-5 text-success" />
    <span className="text-sm text-success">
      Your {selectedIds.size} selected candidates are preserved. 
      Adding more will merge with your current selection.
    </span>
  </div>
)}
```

---

## File Structure

```text
src/
  components/
    candidates/
      AddCandidatesPanel.tsx      # NEW - Slide-out search panel
      CandidateDetailPanel.tsx    # EXISTING
      ResearchInsights.tsx        # EXISTING
  pages/
    CandidateMatching.tsx         # MODIFY - Add button and panel integration
```

---

## Technical Details

### Candidate Scoring for Added Candidates

When candidates are added via the panel, they need match scores calculated. Options:

**Option A (Recommended):** Use the existing `calculateMatchStrength` function client-side for quick scoring, then optionally trigger deep research for the new candidates.

**Option B:** Call the `ai-candidate-matcher` edge function with just the new candidate IDs for full AI scoring (slower but more accurate).

The implementation will use Option A for immediate results with an optional "Research Added Candidates" button.

### Duplicate Prevention

- The panel will have a toggle "Exclude already selected" (default: on)
- The merge function double-checks for duplicates before adding
- UI shows "(X already in list)" badge on search results if there's overlap

### Filter Chip States

Each filter chip will show:
- Estimated count from database (can be expensive - consider caching or using approximate counts)
- Active/inactive state
- "AND" logic (all selected filters must match)

---

## User Flow

1. User is on Candidate Matching page with 50 candidates selected
2. User clicks "Add More Candidates" button
3. Panel slides in from right
4. Banner shows "Your 50 selected candidates are preserved"
5. User selects filters (e.g., Local + Contact Ready)
6. User clicks "Search" or results auto-load
7. Results show candidates NOT in current selection
8. User selects some or all results
9. User clicks "Add Selected to Campaign"
10. Panel closes, candidates are merged, toast confirms "Added 12 candidates"
11. User now has 62 selected candidates
12. User clicks "Continue with 62 Candidates"

---

## Success Criteria

1. User can search for specific candidate types without losing current selection
2. New candidates are merged and auto-selected
3. No duplicates in final list
4. Clear visual feedback that existing selection is preserved
5. Works with Local, 10+ Licenses, Contact Ready, and name search filters
