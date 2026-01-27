

# Improve Candidate Matching - Single Column Layout with Local/Other Sections

## Overview

This plan implements targeted UX improvements to the existing Candidate Matching page, keeping the single-column layout with ShortlistBanner but adding smart sectioning, auto-hide behavior, and better visual hierarchy.

---

## Changes Summary

### 1. Split Table into LOCAL and OTHER Sections
### 2. Add "Add All Local" and "Add All Other" Bulk Actions
### 3. Auto-Hide + Undo Toast for Bulk Add Actions
### 4. More Prominent "Hide Added" Toggle
### 5. Empty State Messages per Section
### 6. Local Count in Stats Header
### 7. LOCAL Badge on In-State Candidate Rows

---

## Implementation Details

### File: `src/pages/CandidateMatching.tsx`

#### 1. Add Computed Arrays for Local vs Other Candidates

After line 886 (after `sortedCandidates`), add:

```typescript
// Split pool into LOCAL vs OTHER sections
const localPoolCandidates = useMemo(() => 
  sortedCandidates.filter(c => c.state === jobState),
[sortedCandidates, jobState]);

const otherPoolCandidates = useMemo(() => 
  sortedCandidates.filter(c => c.state !== jobState),
[sortedCandidates, jobState]);
```

#### 2. Add Section-Level Bulk Add Handlers with Undo

After `handleAddAllVisible` (around line 965), add:

```typescript
// Store previous state for undo functionality
const [lastBulkAddAction, setLastBulkAddAction] = useState<{
  ids: string[];
  previousHideAdded: boolean;
} | null>(null);

const handleAddAllLocal = () => {
  const localIds = localPoolCandidates.map(c => c.id);
  if (localIds.length === 0) return;
  
  // Store for undo
  const previousHideAdded = hideAdded;
  setLastBulkAddAction({ ids: localIds, previousHideAdded });
  
  setAddedToJobIds(prev => {
    const next = new Set(prev);
    localIds.forEach(id => next.add(id));
    return next;
  });
  setHideAdded(true);
  
  toast.success(`Added ${localIds.length} local candidates to shortlist`, {
    action: {
      label: "Undo",
      onClick: () => {
        setAddedToJobIds(prev => {
          const next = new Set(prev);
          localIds.forEach(id => next.delete(id));
          return next;
        });
        setHideAdded(previousHideAdded);
      }
    }
  });
};

const handleAddAllOther = () => {
  const otherIds = otherPoolCandidates.map(c => c.id);
  if (otherIds.length === 0) return;
  
  const previousHideAdded = hideAdded;
  setLastBulkAddAction({ ids: otherIds, previousHideAdded });
  
  setAddedToJobIds(prev => {
    const next = new Set(prev);
    otherIds.forEach(id => next.add(id));
    return next;
  });
  setHideAdded(true);
  
  toast.success(`Added ${otherIds.length} candidates to shortlist`, {
    action: {
      label: "Undo",
      onClick: () => {
        setAddedToJobIds(prev => {
          const next = new Set(prev);
          otherIds.forEach(id => next.delete(id));
          return next;
        });
        setHideAdded(previousHideAdded);
      }
    }
  });
};
```

#### 3. Update `handleAddAllVisible` with Undo Support

Replace the existing `handleAddAllVisible` function:

```typescript
const handleAddAllVisible = () => {
  const visibleIds = sortedCandidates.map(c => c.id);
  if (visibleIds.length === 0) return;
  
  const previousHideAdded = hideAdded;
  
  setAddedToJobIds(prev => {
    const next = new Set(prev);
    visibleIds.forEach(id => next.add(id));
    return next;
  });
  setHideAdded(true);
  
  toast.success(`Added ${visibleIds.length} candidates to shortlist`, {
    action: {
      label: "Undo",
      onClick: () => {
        setAddedToJobIds(prev => {
          const next = new Set(prev);
          visibleIds.forEach(id => next.delete(id));
          return next;
        });
        setHideAdded(previousHideAdded);
      }
    }
  });
};
```

#### 4. Update Stats Header to Include Local Count and Added Count

In the job summary header (around lines 1229-1260), add new stats:

```typescript
{/* Added to Shortlist count */}
<div className="text-center">
  <p className="text-2xl font-bold text-success">{addedToJobIds.size}</p>
  <p className="text-xs text-muted-foreground">Added</p>
</div>

{/* Local count already exists but ensure it's prominent */}
<div className="text-center">
  <p className="text-2xl font-bold text-emerald-400">{filterCounts.local}</p>
  <p className="text-xs text-muted-foreground">Local ({jobState})</p>
</div>
```

#### 5. Move "Hide Added" Toggle to Search Bar Area

Move the toggle from its current location to next to the search bar (around line 1390). Update styling:

```typescript
{/* Search & Actions Bar */}
<div className="flex flex-wrap gap-3 items-center">
  <div className="relative flex-1 min-w-[200px] max-w-md">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Search by name, specialty, location..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="pl-9"
    />
  </div>
  
  {/* Prominent Hide Added Toggle */}
  <div className={cn(
    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
    addedToJobIds.size > 0 
      ? "bg-success/10 border-success/30 shadow-sm" 
      : "bg-muted/50 border-border"
  )}>
    <Checkbox
      id="hideAdded"
      checked={hideAdded}
      onCheckedChange={(checked) => setHideAdded(!!checked)}
    />
    <label 
      htmlFor="hideAdded" 
      className={cn(
        "text-sm cursor-pointer font-medium",
        addedToJobIds.size > 0 ? "text-success" : "text-muted-foreground"
      )}
    >
      {addedToJobIds.size > 0 
        ? `Hide ${addedToJobIds.size} added` 
        : "Hide added"}
    </label>
  </div>
  
  {/* Rest of actions... */}
</div>
```

#### 6. Replace Single Table with Two Section Tables

Replace the existing single table (lines 1538-2165) with two sectioned tables:

```typescript
{/* LOCAL CANDIDATES SECTION */}
{localPoolCandidates.length > 0 ? (
  <div className="space-y-3">
    {/* Section Header */}
    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-success/10 border border-success/30">
      <div className="flex items-center gap-3">
        <MapPin className="h-5 w-5 text-success" />
        <div>
          <h3 className="font-semibold text-success flex items-center gap-2">
            LOCAL CANDIDATES
            <Badge className="bg-success text-success-foreground">
              {localPoolCandidates.length}
            </Badge>
          </h3>
          <p className="text-xs text-success/70">
            Faster credentialing - No relocation - Immediate availability
          </p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={handleAddAllLocal}
        className="bg-success text-success-foreground hover:bg-success/90"
      >
        <Plus className="h-4 w-4 mr-1" />
        Add All Local ({localPoolCandidates.length})
      </Button>
    </div>
    
    {/* Local Candidates Table */}
    <CandidatesTable 
      candidates={localPoolCandidates} 
      isLocalSection={true}
      // ...other props
    />
  </div>
) : hideAdded && filterCounts.local > 0 ? (
  /* Empty state when all local candidates are added */
  <div className="rounded-xl border border-success/30 bg-success/5 p-6 text-center">
    <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
    <p className="text-success font-medium">All local candidates added to shortlist</p>
    <p className="text-xs text-muted-foreground mt-1">
      Toggle "Hide added" to review your selections
    </p>
  </div>
) : null}

{/* OTHER CANDIDATES SECTION */}
{otherPoolCandidates.length > 0 ? (
  <div className="space-y-3">
    {/* Section Header */}
    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/50 border border-border">
      <div className="flex items-center gap-3">
        <Globe className="h-5 w-5 text-muted-foreground" />
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            OTHER CANDIDATES
            <Badge variant="secondary">
              {otherPoolCandidates.length}
            </Badge>
          </h3>
          <p className="text-xs text-muted-foreground">
            Out-of-state candidates with matching qualifications
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleAddAllOther}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add All Other ({otherPoolCandidates.length})
      </Button>
    </div>
    
    {/* Other Candidates Table */}
    <CandidatesTable 
      candidates={otherPoolCandidates} 
      isLocalSection={false}
      // ...other props
    />
  </div>
) : hideAdded && (candidates.length - filterCounts.local) > 0 ? (
  /* Empty state when all other candidates are added */
  <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
    <CheckCircle2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
    <p className="text-muted-foreground font-medium">All candidates added to shortlist</p>
    <p className="text-xs text-muted-foreground mt-1">
      Toggle "Hide added" to review your selections
    </p>
  </div>
) : null}
```

#### 7. Add LOCAL Badge to In-State Candidate Rows

In the candidate name cell (around line 1590), add a LOCAL badge for local section:

```typescript
<td className="px-4 py-4">
  <div className="space-y-1">
    <div className="flex items-center gap-2">
      <span className="font-medium text-foreground">
        {candidate.first_name} {candidate.last_name}
      </span>
      {/* LOCAL badge for in-state candidates */}
      {isLocal(candidate) && (
        <Badge 
          className="bg-success/20 text-success border border-success/30 text-[10px] font-bold"
        >
          LOCAL
        </Badge>
      )}
      {contactReady && (
        <CheckCircle2 className="h-4 w-4 text-success" />
      )}
      {/* ... rest of badges */}
    </div>
    {/* ... rest of content */}
  </div>
</td>
```

---

## Component Extraction (Optional Refactor)

To avoid code duplication, extract the table body into a reusable component:

```typescript
interface CandidatesTableProps {
  candidates: Candidate[];
  isLocalSection: boolean;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  addedToJobIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onAddToJob: (id: string) => void;
  onRemoveFromJob: (id: string) => void;
  onResearch: (candidate: Candidate) => void;
  onEnrich: (candidate: Candidate) => void;
  researchingIds: Set<string>;
  enrichingIds: Set<string>;
  deepResearchingIds: Set<string>;
  // ... other handlers
}
```

This keeps the code DRY while having separate section wrappers.

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/CandidateMatching.tsx` | Modify | Add local/other section logic, undo toasts, hide toggle, LOCAL badges |

---

## Visual Summary

```text
+------------------------------------------------------------------+
|  Job Header + Stats                                               |
|  [Total] [Local] [Added] [Researched] [Contact Ready] [10+ Lic]  |
+------------------------------------------------------------------+
|  Search [___________]  [Hide 12 added ✓]  [Select Actions...]    |
+------------------------------------------------------------------+
|                                                                   |
|  ┌─ LOCAL CANDIDATES (8) ────────────────── [+ Add All Local] ─┐ |
|  │  Green header with "Faster credentialing" subtitle          │ |
|  │                                                              │ |
|  │  ☐ Dr. Harris  [LOCAL] A+ 99% Gold  ✅ Contact  [+ Add]    │ |
|  │  ☐ Dr. Natarajan [LOCAL] A+ 99% Gold ✅ Contact [✓ Added]  │ |
|  │  ...                                                         │ |
|  └──────────────────────────────────────────────────────────────┘ |
|                                                                   |
|  ┌─ OTHER CANDIDATES (486) ─────────────── [+ Add All Other] ─┐  |
|  │  Default header with count                                  │  |
|  │                                                              │  |
|  │  ☐ Dr. Jean-Baptiste  A+ 99% Gold  ✅ Contact  [+ Add]     │  |
|  │  ☐ Dr. Craig  A+ 98% Silver  🔍 Needs Enrich  [+ Add]      │  |
|  │  ...                                                         │  |
|  └──────────────────────────────────────────────────────────────┘ |
|                                                                   |
|  [Load More]                                                      |
|                                                                   |
|  [Back to Job]            [Search More] [Continue with 12 →]     |
+------------------------------------------------------------------+
```

---

## Expected Behavior

1. **Page Load**: Candidates split into LOCAL (top, green) and OTHER (bottom)
2. **Click "Add All Local"**: 
   - All local candidates added to shortlist
   - "Hide added" toggle auto-enabled
   - Toast appears with "Undo" button
   - LOCAL section shows empty state: "All local candidates added"
3. **Click "Undo"**: 
   - Candidates removed from shortlist
   - "Hide added" reverts to previous state
4. **Toggle "Hide added" OFF**: Shows all candidates (both added and not)
5. **LOCAL Badge**: Visible on all in-state candidate rows for quick identification

