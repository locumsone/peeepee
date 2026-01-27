

# Job Detail Page Redesign - Enterprise ATS Standards

## Research Summary

Based on analysis of leading ATS platforms (Bullhorn, Greenhouse, JobDiva, Lever, Workday), the following are critical patterns for an optimal job detail page:

### Industry Best Practices Discovered

| ATS Platform | Key Features |
|-------------|--------------|
| **Bullhorn** | Multi-section layout (Information, Compensation, Requirements, Internal Notes, Status), Match button for instant candidate matching, Action buttons (Edit, Delete, Clone) |
| **Greenhouse** | Visual candidate pipeline, Interview scorecards, Collaboration tools (@mentions), Job-specific analytics, Stage-based automation alerts |
| **Lever** | Interview scorecard system, Stage-based candidate tracking, Feedback forms integrated into job view |
| **Workday** | Requisition-centric view, Approval workflows visible, Hiring team panel, Multi-opening tracking |

### Current Gaps in Locums One Job Detail Page

1. **Missing Quick Stats Panel** - No at-a-glance metrics in header
2. **No Hiring Team Section** - Can't see who's working this job
3. **Limited Quick Actions** - Buried in tabs instead of prominent
4. **No Job Health Score** - No visual indicator of job performance
5. **Missing Time Metrics** - Days open, time-to-fill estimates not shown
6. **No Scorecard/Notes** - No quick notes or scoring for candidates inline
7. **Activity is Tab-Gated** - Recent activity should be visible immediately

---

## Proposed Redesign

### New Layout Architecture

```text
+------------------------------------------------------------------+
|  HEADER BAR                                                       |
|  [Back] IR - Middletown Regional | $185/hr | ACTIVE | URGENT     |
|  Facility Name, NY | REQ #12345 | 2 Openings                     |
+------------------------------------------------------------------+
|                                                                   |
|  QUICK STATS ROW (new)                                           |
|  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     |
|  │ 47      │ │ 12      │ │ 5       │ │ 23 days │ │ 78%     │     |
|  │ Matched │ │ Active  │ │ Replies │ │ Open    │ │ Health  │     |
|  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘     |
|                                                                   |
|  QUICK ACTIONS (new - always visible)                            |
|  [Find Candidates] [Create Campaign] [Edit Job] [Clone] [Share]  |
|                                                                   |
+------------------------------------------------------------------+
|                                                                   |
|  PIPELINE (existing, enhanced)                                   |
|  Visual bar + Stage cards with click-to-filter                   |
|                                                                   |
+------------------------------------------------------------------+
|  LEFT COLUMN (60%)          |  RIGHT COLUMN (40%)                |
|  ┌────────────────────────┐ | ┌────────────────────────────────┐ |
|  │ TABS                   │ | │ JOB DETAILS CARD (new sidebar) │ |
|  │ Candidates | Activity  │ | │ • Specialty: IR                │ |
|  │ Outreach | Scorecards  │ | │ • Schedule: 7on/7off           │ |
|  │                        │ | │ • Start: Mar 15, 2026          │ |
|  │ [Tab Content Area]     │ | │ • Requirements: TX license...  │ |
|  │                        │ | ├────────────────────────────────┤ |
|  │                        │ | │ PAY BREAKDOWN                  │ |
|  │                        │ | │ Bill: $250 | Pay: $185 | 73%   │ |
|  │                        │ | ├────────────────────────────────┤ |
|  │                        │ | │ HIRING TEAM (new)              │ |
|  │                        │ | │ 👤 John Smith (Owner)          │ |
|  │                        │ | │ 👤 Jane Doe (Recruiter)        │ |
|  │                        │ | ├────────────────────────────────┤ |
|  │                        │ | │ RECENT ACTIVITY (3 items)      │ |
|  │                        │ | │ • Dr. Smith replied (2h ago)   │ |
|  │                        │ | │ • SMS sent to Dr. Jones        │ |
|  │                        │ | │ [View All Activity]            │ |
|  └────────────────────────┘ | └────────────────────────────────┘ |
+------------------------------------------------------------------+
```

---

## Detailed Component Changes

### Component 1: JobDetailHeader (New)

**Purpose:** Compact, information-dense header with all critical job info visible immediately

**Features:**
- Job name + facility + location on one line
- Status badges (Active, Urgent, On Hold)
- Pay rate prominently displayed
- Requisition ID as copyable badge
- Number of openings indicator

### Component 2: JobQuickStats (New)

**Purpose:** At-a-glance metrics row below header

**Metrics to Display:**
- **Matched**: Total candidates matched to this job (from `candidate_job_matches`)
- **In Pipeline**: Active candidates in campaigns
- **Replies**: Total responses received (email + SMS + calls)
- **Days Open**: Calculated from job creation date
- **Health Score**: Composite score based on activity, response rate, pipeline movement

**Implementation:**
```typescript
interface QuickStatsProps {
  matchedCount: number;
  pipelineCount: number;
  totalReplies: number;
  daysOpen: number;
  healthScore: number; // 0-100
}
```

### Component 3: JobQuickActions (New)

**Purpose:** Prominent action buttons always visible (not hidden in tabs)

**Actions:**
- Find Candidates (navigates to search)
- Create Campaign (navigates to matching)
- Edit Job (inline edit or modal)
- Clone Job (duplicate for similar positions)
- Share Job (copy link or send to team member)
- Archive/Close (with confirmation)

### Component 4: JobDetailSidebar (New)

**Purpose:** Right-side panel with job details, pay breakdown, team, and recent activity

**Sections:**
1. **Job Requirements Card**
   - Specialty, schedule, dates, requirements text
   - Click to expand full requirements
   
2. **Pay Breakdown Card**
   - Bill rate, pay rate, margin, percentage breakdown
   - Visual comparison bar
   
3. **Hiring Team Card** (new concept)
   - Job owner/creator
   - Assigned recruiters
   - Quick @mention capability
   
4. **Recent Activity Mini-Feed**
   - Last 3-5 activity items
   - "View All" link to Activity tab

### Component 5: Enhanced Tabs

**Current Tabs:** Candidates, Activity, Outreach, Settings

**Proposed Tabs:**
1. **Candidates** - Keep Kanban/List view (existing)
2. **Activity** - Full activity timeline (existing)
3. **Outreach** - Channel performance stats (existing)
4. **Scorecards** (NEW) - Candidate ratings and interview notes
5. **Notes** (NEW) - Internal job notes and updates

### Component 6: JobScorecard (New Tab Content)

**Purpose:** Greenhouse-style scorecard for rating candidates against job requirements

**Features:**
- Define 3-5 key attributes for this job (e.g., "State License", "Fellowship", "Years Experience")
- Rate each candidate on each attribute (1-5 stars or Yes/No)
- Quick visual of which candidates meet criteria
- Sorting/filtering by scorecard completion

### Component 7: JobHealthIndicator (New)

**Purpose:** Visual health score with drill-down explanations

**Calculation Factors:**
- Days open (older = lower score)
- Pipeline movement (stagnant = lower)
- Response rate vs benchmark
- Time since last activity
- Candidate quality (tier distribution)

**Visual Treatment:**
- Circular progress indicator with percentage
- Color coding (green > 70%, yellow 40-70%, red < 40%)
- Hover tooltip with breakdown

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/jobs/JobDetailHeader.tsx` | Enhanced header with all critical info |
| `src/components/jobs/JobQuickStats.tsx` | At-a-glance metrics row |
| `src/components/jobs/JobQuickActions.tsx` | Prominent action buttons |
| `src/components/jobs/JobDetailSidebar.tsx` | Right-side info panel |
| `src/components/jobs/JobHealthIndicator.tsx` | Visual health score |
| `src/components/jobs/JobScorecard.tsx` | Candidate rating system |
| `src/components/jobs/JobNotesPanel.tsx` | Internal notes section |
| `src/components/jobs/JobTeamCard.tsx` | Hiring team display |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/JobDetail.tsx` | Complete restructure with new layout, fetch additional data |
| `src/components/jobs/index.ts` | Export new components |
| `src/components/jobs/JobPipeline.tsx` | Add stage filtering callback |

---

## Database Queries Needed

### New Aggregations for Quick Stats

```typescript
// Matched candidates count
const { count: matchedCount } = await supabase
  .from("candidate_job_matches")
  .select("*", { count: "exact", head: true })
  .eq("job_id", jobId);

// Days open calculation
const daysOpen = differenceInDays(new Date(), new Date(job.created_at));

// Health score calculation
const healthScore = calculateHealthScore({
  daysOpen,
  pipelineMovementRate,
  responseRate,
  lastActivityDate,
});
```

---

## Visual Design Notes

Following the "Corporate Xbox Console" aesthetic:
- Quick Stats cards: Rounded square tiles with subtle glow on hover
- Health indicator: Ring/donut chart with Electric Blue (#0EA5E9) accent
- Sidebar cards: Deep surface (#16191D) with border-border
- Action buttons: Primary uses success color for positive actions (Create Campaign)
- Scorecard: Table layout with star ratings or checkbox indicators

---

## Implementation Order

1. **Phase 1: Layout Restructure**
   - Create two-column layout (60/40 split)
   - Move job details to sidebar
   - Add Quick Stats row

2. **Phase 2: New Components**
   - JobQuickStats
   - JobDetailSidebar
   - JobHealthIndicator
   - JobQuickActions

3. **Phase 3: New Features**
   - Scorecards tab
   - Notes tab
   - Team card

4. **Phase 4: Data Integration**
   - Fetch `candidate_job_matches` count
   - Calculate health score
   - Add days open tracking

---

## Success Criteria

After implementation:
1. All critical job info visible without scrolling
2. Quick actions always accessible (not buried in tabs)
3. Health score provides instant job status assessment
4. Hiring team visible for collaboration
5. Recent activity shown without clicking Activity tab
6. Scorecard system enables structured candidate evaluation
7. Layout matches enterprise ATS standards (Bullhorn, Greenhouse quality)

