
# Job Scorecard Enhancement and Matched Candidates UX Improvements

## Issues Identified

### 1. Scorecard Scroll Not Working
The `ScrollArea` component in `JobScorecard.tsx` has a `max-h-[500px]` but no explicit height set on the viewport, which can cause scrolling issues. Additionally, using a `<table>` inside `ScrollArea` with sticky headers can break the scroll behavior.

### 2. Console Warning: Tooltip Ref Issue
The console shows: "Function components cannot be given refs". This is because `<Tooltip>` is being used as a wrapper in the `<th>` table header without proper ref forwarding for `TooltipTrigger`.

### 3. No Pop-Out/Detail View for Scorecard
Currently, the scorecard is embedded in the tab content with no way to expand it for more detail or see additional candidate information.

### 4. No Ability to Remove Matched Candidates
Users cannot remove candidates from the `candidate_job_matches` table when they are no longer suitable for a job.

---

## Implementation Plan

### Phase 1: Fix Scorecard Scroll and Tooltip Issues

**1.1 Fix Tooltip Warning**
- Wrap `<span>` in `<TooltipTrigger asChild>` with a proper `<button>` element that can accept refs
- Change from `<span className="cursor-help">` to `<button type="button" className="cursor-help">`

**1.2 Fix ScrollArea for Table**
- Replace `ScrollArea` with a native `<div>` with `overflow-auto` for better table scrolling compatibility
- Add explicit height constraints that work with table layouts
- Use `overflow-x-auto` for horizontal scroll on smaller screens

---

### Phase 2: Create Scorecard Pop-Out Dialog

**2.1 Create `ScorecardDetailDialog.tsx`**
A full-screen or large dialog component that provides:
- Expanded candidate view with all profile details
- Full scorecard with more detailed criteria
- Match score breakdown
- Match concerns and reasons
- Notes input for each candidate
- Quick actions (Call, SMS, Add to Campaign, Remove)

**2.2 Add Expand Button to Scorecard**
- Add "Expand" button in the scorecard header
- Clicking a candidate row opens their detail in the dialog

---

### Phase 3: Implement Remove Matched Candidates

**3.1 Add Remove Functionality to MatchedCandidateCard**
- Add a "Remove Match" button (X icon) that appears on hover
- Confirmation dialog before removal
- Call `supabase.from("candidate_job_matches").delete()` on confirmation

**3.2 Add Bulk Remove to MatchedCandidatesGrid**
- Add checkbox selection for bulk operations
- "Remove Selected" action in toolbar
- Update state after removal

---

### Phase 4: UI/UX Quality of Life Improvements

**4.1 MatchedCandidateCard Enhancements**
- Show match concerns as warning badges
- Add keyboard navigation support
- Improve hover states with subtle animations
- Always show actions (not just on hover) on mobile

**4.2 MatchedCandidatesGrid Improvements**
- Add selection mode with checkboxes
- Show selected count in toolbar
- Add filter by "Has Required License" toggle
- Add "Select All Local" quick action

**4.3 Scorecard Improvements**
- Add keyboard navigation between cells
- Show candidate photo/avatar if available
- Add "Reset Scores" button per candidate
- Show last evaluated date
- Persist scores to database (create `candidate_scorecard_ratings` table)

---

## Database Changes

**Create `candidate_scorecard_ratings` table:**
```text
+---------------------------+
| candidate_scorecard_ratings |
+---------------------------+
| id (uuid, PK)              |
| job_id (FK -> jobs)        |
| candidate_id (FK)          |
| attribute_id (text)        |
| value (jsonb)              |
| evaluated_by (FK -> users) |
| created_at                 |
| updated_at                 |
+---------------------------+
```

This allows scorecard ratings to persist across sessions.

---

## Technical Details

### Fix for Tooltip Warning
Current (problematic):
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <span className="cursor-help">...</span>
  </TooltipTrigger>
</Tooltip>
```

Fixed:
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <button type="button" className="cursor-help inline-flex items-center gap-1">
      ...
    </button>
  </TooltipTrigger>
</Tooltip>
```

### Remove Match Function
```typescript
const handleRemoveMatch = async (candidateId: string) => {
  const { error } = await supabase
    .from("candidate_job_matches")
    .delete()
    .eq("job_id", jobId)
    .eq("candidate_id", candidateId);
  
  if (!error) {
    setMatchedCandidates(prev => prev.filter(c => c.id !== candidateId));
    setMatchedCount(prev => prev - 1);
    toast({ title: "Candidate removed from matches" });
  }
};
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/xxx_create_scorecard_ratings.sql` | Create | Table for persisting scorecard ratings |
| `src/components/jobs/JobScorecard.tsx` | Modify | Fix scroll, tooltip, add expand button |
| `src/components/jobs/ScorecardDetailDialog.tsx` | Create | Full-screen scorecard dialog |
| `src/components/jobs/MatchedCandidateCard.tsx` | Modify | Add remove button, improve hover states |
| `src/components/jobs/MatchedCandidatesGrid.tsx` | Modify | Add selection, bulk remove, filters |
| `src/pages/JobDetail.tsx` | Modify | Handle remove matched, pass callbacks |
| `src/hooks/useScorecardRatings.ts` | Create | Hook for persisting/loading scorecard data |
| `src/integrations/supabase/types.ts` | Auto-update | Add new table types |

---

## User Experience After Implementation

1. **Scorecard Tab** scrolls smoothly with no console warnings
2. **Expand Button** opens full-detail dialog with all candidate info
3. **Remove Match** button (X) on each matched candidate card
4. **Bulk Selection** with checkboxes in matched candidates grid
5. **Confirmation Dialog** before removing to prevent accidents
6. **Persisted Scores** that survive page refresh
7. **Mobile-friendly** actions always visible on touch devices
