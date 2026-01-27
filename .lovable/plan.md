
# Full-Screen Split-View Candidate Matching Redesign

## Overview

This plan transforms the Candidate Matching screen from a single-column layout with a collapsible banner into a true ATS-style **split-screen experience** with persistent shortlist panel and smart pool sectioning.

---

## Current State Analysis

### Current Layout Structure
- Single column layout wrapped in `<Layout>` component (max-w-7xl)
- ShortlistBanner at top (collapsible, horizontal scroll of chips)
- Job summary header
- Quick filter buttons (7 grid columns)
- Alpha Sophia banner
- Search & action bar
- Full-width table with candidates
- Footer navigation

### Key Pain Points
1. **Shortlist hidden at top** - Users lose sight of their selections when scrolling
2. **No Local vs Other separation** - Local candidates mixed with everyone
3. **Cramped candidate cards** - Table rows don't highlight key info prominently
4. **Too much scrolling** - Can't see shortlist and pool simultaneously

---

## Proposed Architecture

### Split-View Layout

```text
+-----------------------------------------------------------------------------------+
|  Header (Campaign Builder breadcrumb)                                             |
+-----------------------------------------------------------------------------------+
|  Job Summary Bar (sticky)                                                         |
|  IR at Ascension St. Vincent Hospital - Indianapolis • $500/hr                   |
+-----------------------------------------------------------------------------------+
|                                   |                                               |
|  SHORTLIST PANEL (35%)           |  CANDIDATE POOL (65%)                         |
|  Position: sticky, top-16        |                                               |
|  Max-height: calc(100vh - 8rem)  |  Search + Filters                             |
|  ─────────────────────────────── |  ─────────────────────────────────────────────|
|                                   |                                               |
|  Stats Summary                   |  LOCAL CANDIDATES (8)          [+ Add All]    |
|  ┌─────────────────────────────┐ |  ┌─────────────────────────────────────────┐  |
|  │ 12 added • 10 ready • 4 IN │ |  │  Candidate Card                         │  |
|  └─────────────────────────────┘ |  │  Candidate Card                         │  |
|                                   |  │  ...                                     │  |
|  📍 LOCAL (4)                    |  └─────────────────────────────────────────┘  |
|  ┌─────────────────────────────┐ |                                               |
|  │ Dr. Harris     99%  [×]    │ |  OTHER CANDIDATES (486)        [+ Add All]    |
|  │ Dr. Natarajan  99%  [×]    │ |  ┌─────────────────────────────────────────┐  |
|  │ +2 more local              │ |  │  Candidate Card                         │  |
|  └─────────────────────────────┘ |  │  Candidate Card                         │  |
|                                   |  │  ...                                     │  |
|  🌍 OTHER STATES (8)             |  └─────────────────────────────────────────┘  |
|  ┌─────────────────────────────┐ |                                               |
|  │ Dr. Jean-Baptiste 99% [×] │ |                                               |
|  │ Dr. Craig        99%  [×] │ |  Load More                                    |
|  │ +6 more                    │ |                                               |
|  └─────────────────────────────┘ |  ─────────────────────────────────────────────|
|                                   |                                               |
|  📊 Shortlist Stats              |  [Back]                [Continue with 12 →]   |
|  ┌─────────────────────────────┐ |                                               |
|  │ Avg Match: 97%             │ |                                               |
|  │ IN Licensed: 10/12         │ |                                               |
|  │ Contact Ready: 8/12        │ |                                               |
|  └─────────────────────────────┘ |                                               |
|                                   |                                               |
|  [Continue with 12 Candidates →] |                                               |
|                                   |                                               |
+-----------------------------------------------------------------------------------+
```

---

## Implementation Plan

### Phase 1: Layout Restructuring

**File: `src/pages/CandidateMatching.tsx`**

Replace the current single-column `max-w-7xl` container with a flex split-view:

```typescript
return (
  <Layout currentStep={2} showSteps={false}>
    {/* Sticky Job Summary Header */}
    <div className="sticky top-14 z-40 ...">
      {/* Job info bar */}
    </div>
    
    {/* Split View Container */}
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* Left: Shortlist Panel - Sticky */}
      <div className="w-[380px] shrink-0">
        <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto">
          <ShortlistPanel ... />
        </div>
      </div>
      
      {/* Right: Candidate Pool */}
      <div className="flex-1 min-w-0 space-y-4">
        <PoolFilters ... />
        <LocalCandidatesSection ... />
        <OtherCandidatesSection ... />
        <FooterActions ... />
      </div>
    </div>
  </Layout>
);
```

### Phase 2: New Shortlist Panel Component

**New File: `src/components/candidates/ShortlistPanel.tsx`**

A persistent left sidebar showing:
- Quick stats (count, ready, local)
- Local candidates section (collapsible, max 4 visible)
- Other states section (collapsible)
- Detailed stats (avg match, licensed, contact ready)
- Continue button

```typescript
interface ShortlistPanelProps {
  candidates: Candidate[];
  addedIds: Set<string>;
  jobState: string;
  onRemove: (id: string) => void;
  onClear: () => void;
  onContinue: () => void;
  disabled?: boolean;
}

const ShortlistPanel = ({
  candidates,
  addedIds,
  jobState,
  onRemove,
  onClear,
  onContinue,
  disabled
}: ShortlistPanelProps) => {
  const addedCandidates = candidates.filter(c => addedIds.has(c.id));
  const localCandidates = addedCandidates.filter(c => c.state === jobState);
  const otherCandidates = addedCandidates.filter(c => c.state !== jobState);
  
  // Calculate stats
  const stats = useMemo(() => ({
    total: addedCandidates.length,
    contactReady: addedCandidates.filter(c => c.has_personal_contact || c.personal_mobile).length,
    localCount: localCandidates.length,
    avgMatch: Math.round(addedCandidates.reduce((s, c) => s + c.match_strength, 0) / addedCandidates.length) || 0,
    inLicensed: addedCandidates.filter(c => c.licenses?.some(l => l.includes(jobState))).length,
    needsEnrich: addedCandidates.filter(c => !c.has_personal_contact).length,
  }), [addedCandidates, jobState]);
  
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Your Shortlist
          <Badge className="bg-primary">{stats.total}</Badge>
        </h2>
        {stats.total > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear All
          </Button>
        )}
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-success/10 p-2">
          <p className="text-lg font-bold text-success">{stats.contactReady}</p>
          <p className="text-[10px] text-muted-foreground">Ready</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-2">
          <p className="text-lg font-bold text-primary">{stats.localCount}</p>
          <p className="text-[10px] text-muted-foreground">Local</p>
        </div>
        <div className="rounded-lg bg-purple-500/10 p-2">
          <p className="text-lg font-bold text-purple-400">{stats.inLicensed}</p>
          <p className="text-[10px] text-muted-foreground">{jobState} Lic</p>
        </div>
      </div>
      
      {/* Local Section */}
      <ShortlistSection 
        title="Local"
        icon={<MapPin className="h-4 w-4" />}
        candidates={localCandidates}
        highlight="green"
        onRemove={onRemove}
        maxVisible={4}
      />
      
      {/* Other States Section */}
      <ShortlistSection 
        title="Other States"
        icon={<Globe className="h-4 w-4" />}
        candidates={otherCandidates}
        onRemove={onRemove}
        maxVisible={4}
      />
      
      {/* Detailed Stats */}
      <ShortlistStats stats={stats} jobState={jobState} />
      
      {/* Continue Button */}
      <Button
        className="w-full"
        variant="gradient"
        size="lg"
        onClick={onContinue}
        disabled={disabled || stats.total === 0}
      >
        Continue with {stats.total} Candidates
        <ArrowRight className="h-5 w-5 ml-2" />
      </Button>
    </div>
  );
};
```

### Phase 3: Pool Section Components

**New File: `src/components/candidates/PoolSection.tsx`**

A section component that groups candidates with a header, bulk action, and candidate cards:

```typescript
interface PoolSectionProps {
  title: string;
  subtitle?: string;
  candidates: Candidate[];
  highlight?: 'green' | 'default';
  addedIds: Set<string>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onAddAll: () => void;
  onExpandCandidate: (id: string) => void;
  expandedIds: Set<string>;
  jobState: string;
}

const PoolSection = ({ 
  title, 
  subtitle, 
  candidates, 
  highlight, 
  addedIds,
  onAdd,
  onRemove,
  onAddAll,
  ...props
}: PoolSectionProps) => {
  if (candidates.length === 0) return null;
  
  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2 rounded-lg",
        highlight === 'green' ? "bg-success/10 border border-success/20" : "bg-muted/50"
      )}>
        <div>
          <h3 className={cn(
            "font-semibold flex items-center gap-2",
            highlight === 'green' ? "text-success" : "text-foreground"
          )}>
            {highlight === 'green' && <MapPin className="h-4 w-4" />}
            {title} ({candidates.length})
          </h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onAddAll}
          className={cn(
            highlight === 'green' 
              ? "border-success/30 text-success hover:bg-success/10" 
              : "border-primary/30 text-primary hover:bg-primary/10"
          )}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add All
        </Button>
      </div>
      
      {/* Candidate Cards */}
      <div className="space-y-2">
        {candidates.map(candidate => (
          <CandidatePoolCard 
            key={candidate.id}
            candidate={candidate}
            isLocal={highlight === 'green'}
            isAdded={addedIds.has(candidate.id)}
            onAdd={() => onAdd(candidate.id)}
            onRemove={() => onRemove(candidate.id)}
            {...props}
          />
        ))}
      </div>
    </div>
  );
};
```

### Phase 4: Enhanced Candidate Pool Card

**New File: `src/components/candidates/CandidatePoolCard.tsx`**

A card-based design replacing the current table rows:

```typescript
const CandidatePoolCard = ({
  candidate,
  isLocal,
  isAdded,
  onAdd,
  onRemove,
  onExpand,
  isExpanded,
  jobState,
  onResearch,
  isResearching,
}: CandidatePoolCardProps) => {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 transition-all",
      isAdded && "border-success/40 bg-success/5",
      isLocal && !isAdded && "border-success/20"
    )}>
      {/* Local Banner */}
      {isLocal && (
        <div className="bg-success/10 border border-success/20 rounded-t-lg px-3 py-2 -mx-4 -mt-4 mb-3">
          <div className="flex items-center gap-2 text-success text-sm font-medium">
            <MapPin className="h-4 w-4" />
            LOCAL CANDIDATE - In job state ({jobState})
          </div>
          <div className="text-success/70 text-xs mt-0.5">
            Faster credentialing • No relocation • Immediate start
          </div>
        </div>
      )}
      
      <div className="flex items-start justify-between gap-4">
        {/* Left: Candidate Info */}
        <div className="flex-1 space-y-2">
          {/* Name + Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Checkbox 
              checked={/* for bulk select */}
              onChange={...}
            />
            <span className="font-semibold text-foreground">
              {candidate.first_name} {candidate.last_name}
            </span>
            {/* Research/NPI badges */}
            {candidate.researched && <Badge className="bg-cyan-500/20 text-cyan-500">Researched</Badge>}
            {candidate.deep_researched && <Badge className="bg-purple-500/20 text-purple-500">Deep</Badge>}
          </div>
          
          {/* Specialty + Location */}
          <p className="text-sm text-muted-foreground">
            {candidate.specialty} • {candidate.city}, {candidate.state}
          </p>
          
          {/* Score + Progress Bar */}
          <div className="flex items-center gap-3">
            <Badge className={getScoreBadgeConfig(candidate.unified_score).className}>
              {candidate.unified_score}
            </Badge>
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <Progress value={candidate.match_strength} className="h-2" />
              <span className="text-sm font-medium">{candidate.match_strength}%</span>
            </div>
            <Badge className={getEnrichmentBadgeConfig(candidate.enrichment_tier).className}>
              {candidate.enrichment_tier}
            </Badge>
          </div>
          
          {/* Key Indicators */}
          <div className="flex flex-wrap gap-1.5">
            {/* IN Licensed, 10+ States, Contact Ready, etc. */}
            {getKeyIndicators(candidate).slice(0, 4).map((ind, i) => (
              <Badge key={i} variant="outline" className={ind.className}>
                {ind.label}
              </Badge>
            ))}
          </div>
          
          {/* Needs Enrichment Banner */}
          {needsEnrichment(candidate) && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-sm text-warning">
                Missing personal contact
              </span>
              <Button size="sm" variant="outline" className="border-warning/30 text-warning">
                Enrich Now - $0.20
              </Button>
            </div>
          )}
        </div>
        
        {/* Right: Actions */}
        <div className="flex flex-col gap-2 items-end">
          {/* Add/Added Button */}
          {isAdded ? (
            <Button
              size="sm"
              className="bg-success/20 text-success border border-success/30 hover:bg-destructive/10 hover:text-destructive"
              onClick={onRemove}
            >
              <Check className="h-4 w-4 mr-1" />
              Added
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onAdd}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
          
          {/* Research Button */}
          {!candidate.researched && (
            <Button
              size="sm"
              variant="outline"
              className="text-cyan-600"
              onClick={onResearch}
              disabled={isResearching}
            >
              {isResearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Research</>}
            </Button>
          )}
          
          {/* Expand Toggle */}
          <Button size="sm" variant="ghost" onClick={onExpand}>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      
      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border animate-fade-in">
          <ResearchInsights candidate={candidate} ... />
        </div>
      )}
    </div>
  );
};
```

### Phase 5: Pool Filtering Updates

**File: `src/pages/CandidateMatching.tsx`**

Add computed arrays for Local vs Other candidates:

```typescript
// Separate pool into Local vs Other
const localPoolCandidates = useMemo(() => 
  sortedCandidates.filter(c => c.state === jobState),
[sortedCandidates, jobState]);

const otherPoolCandidates = useMemo(() => 
  sortedCandidates.filter(c => c.state !== jobState),
[sortedCandidates, jobState]);

// Handlers for section-level bulk add
const handleAddAllLocal = () => {
  const localIds = localPoolCandidates.map(c => c.id);
  setAddedToJobIds(prev => new Set([...prev, ...localIds]));
  setHideAdded(true);
  toast.success(`Added ${localIds.length} local candidates to shortlist`);
};

const handleAddAllOther = () => {
  const otherIds = otherPoolCandidates.map(c => c.id);
  setAddedToJobIds(prev => new Set([...prev, ...otherIds]));
  setHideAdded(true);
  toast.success(`Added ${otherIds.length} candidates to shortlist`);
};
```

### Phase 6: Hide Layout Steps Header

**File: `src/pages/CandidateMatching.tsx`**

Pass `showSteps={false}` to Layout to maximize vertical space:

```typescript
<Layout currentStep={2} showSteps={false}>
```

### Phase 7: Responsive Considerations

For mobile/tablet, collapse to single column with shortlist as collapsible header:

```typescript
<div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-8rem)]">
  {/* Shortlist: Full width on mobile, sidebar on desktop */}
  <div className="w-full lg:w-[380px] lg:shrink-0">
    {/* On mobile: Collapsible version */}
    {/* On desktop: Sticky panel */}
  </div>
  
  {/* Pool */}
  <div className="flex-1 min-w-0">
    ...
  </div>
</div>
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/CandidateMatching.tsx` | Modify | Restructure to split-view layout, add local/other pool separation |
| `src/components/candidates/ShortlistPanel.tsx` | Create | Persistent left sidebar with sections and stats |
| `src/components/candidates/PoolSection.tsx` | Create | Section component for Local/Other grouping |
| `src/components/candidates/CandidatePoolCard.tsx` | Create | Card-based candidate display replacing table rows |
| `src/components/candidates/ShortlistBanner.tsx` | Keep | Can be repurposed for mobile view or deleted |

---

## Migration Strategy

1. Keep existing `ShortlistBanner.tsx` as fallback for mobile
2. Create new components incrementally
3. Update CandidateMatching.tsx layout last
4. Test both desktop and mobile views

---

## Success Criteria

1. Shortlist always visible on left (desktop)
2. Local candidates grouped at top of pool with green styling
3. "Add All Local" one-click action works
4. Pool automatically hides added candidates
5. Real-time stats update as candidates are added/removed
6. Smooth transitions when adding/removing candidates
7. Mobile responsive with collapsible shortlist
