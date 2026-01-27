
# Campaigns Page Overhaul - ATS/CRM Command Center

## Overview

Transform the Campaigns page from a basic list view into a comprehensive **Outreach Command Center** that combines the best practices from Greenhouse, Outreach.io, Apollo.io, and Bullhorn. This redesign treats campaigns as **job-centric outreach trackers** with deep candidate pipeline visibility, real-time metrics, and quick actions.

---

## Current State Analysis

### Problems Identified
1. **Flat Table Design** - No visual hierarchy or pipeline visualization
2. **Limited Metrics** - Only shows Sent/Opened/Replied in a compressed format
3. **No Job Context** - Missing job details (specialty, location, pay rate) that give campaigns meaning
4. **Missing Quick Actions** - Can't call/SMS candidates directly from the list
5. **No Pipeline View** - Can't see where candidates are in the outreach funnel
6. **Weak Visual Status** - Status badges don't communicate urgency or health
7. **No Candidate Preview** - Must navigate away to see candidate details
8. **Emoji in Header** - Violates brand guidelines (no emojis in professional UI)

---

## New Architecture

### Three View Modes

```text
+----------------------------------------------------------+
|  CAMPAIGNS                                     [+ New]   |
+----------------------------------------------------------+
|  [List View]  [Kanban View]  [Pipeline View]             |
+----------------------------------------------------------+
```

1. **List View** (Enhanced) - Improved table with inline metrics and job context
2. **Kanban View** - Status columns (Draft -> Active -> Paused -> Completed)
3. **Pipeline View** - Candidate funnel visualization per campaign

---

## Detailed Implementation

### Phase 1: Enhanced Campaign Cards (List View)

Replace the flat table with rich campaign cards that show:

**Header Section**
- Campaign name + Status badge (with health indicator dot)
- Job: Specialty | Facility | Location | Pay Rate
- Created date + Owner

**Metrics Row (Visual Progress Bars)**
```text
+----------------------------------------------------------+
|  SENT    OPENED    CLICKED    REPLIED    INTERESTED      |
|  [====]  [===]     [==]       [=]        [*]             |
|   156    42 (27%)  18 (12%)   8 (5%)     4 (3%)          |
+----------------------------------------------------------+
```

**Channel Breakdown (3-column)**
```text
| EMAIL          | SMS           | CALLS          |
| 120 sent       | 36 sent       | 24 attempted   |
| 35% open       | 89% delivered | 8 connected    |
| 4 replied      | 2 replied     | 2 interested   |
```

**Quick Actions Bar**
- Play/Pause toggle
- View Candidates (slide-out panel)
- Jump to Communications (filtered by job)
- Duplicate / Archive

---

### Phase 2: New Components

#### 1. CampaignCard Component
```typescript
// src/components/campaigns/CampaignCard.tsx
// Rich card with job context, visual metrics, channel breakdown
// Includes mini candidate avatars showing top 5 leads
```

#### 2. CampaignKanbanBoard Component
```typescript
// src/components/campaigns/CampaignKanbanBoard.tsx
// Drag-and-drop columns: Draft -> Active -> Paused -> Completed
// Cards show campaign name, job, lead count, health indicator
```

#### 3. CampaignPipeline Component
```typescript
// src/components/campaigns/CampaignPipeline.tsx
// Funnel visualization showing candidate flow:
// Total Leads -> Contacted -> Opened -> Replied -> Interested -> Placed
```

#### 4. CandidateQuickView Component
```typescript
// src/components/campaigns/CandidateQuickView.tsx
// Slide-out panel showing all candidates in a campaign
// Inline call/SMS/email buttons per candidate
// Status filter chips (All, Opened, Replied, Interested)
```

#### 5. CampaignHealthIndicator Component
```typescript
// src/components/campaigns/CampaignHealthIndicator.tsx
// Green/Yellow/Red dot with tooltip explaining health
// Based on: Open Rate, Reply Rate, Bounce Rate thresholds
```

---

### Phase 3: Enhanced Data Model

**Extended Campaign Query**
```sql
SELECT 
  c.*,
  j.job_name, j.specialty, j.facility_name, j.city, j.state, j.pay_rate,
  (SELECT COUNT(*) FROM campaign_leads_v2 WHERE campaign_id = c.id) as actual_leads_count,
  (SELECT COUNT(*) FROM campaign_leads_v2 WHERE campaign_id = c.id AND status = 'interested') as interested_count,
  (SELECT COUNT(*) FROM campaign_leads_v2 WHERE campaign_id = c.id AND status = 'placed') as placed_count
FROM campaigns c
LEFT JOIN jobs j ON c.job_id = j.id
ORDER BY c.updated_at DESC
```

---

### Phase 4: UI/UX Improvements

#### Stats Dashboard (Top of Page)
Replace 4 simple stat cards with a more comprehensive dashboard:

```text
+-------------+-------------+-------------+-------------+-------------+
| CAMPAIGNS   | LEADS       | OPEN RATE   | REPLY RATE  | INTERESTED  |
| Active: 5   | Total: 234  | Avg: 32%    | Avg: 4.2%   | Total: 18   |
| Draft: 2    | Hot: 23     | Best: 58%   | Best: 12%   | This Week: 6|
+-------------+-------------+-------------+-------------+-------------+
```

#### Filter Enhancements
- Add "Hot" filter (campaigns with recent replies or interested signals)
- Add Job filter dropdown (filter by associated job)
- Add Channel filter (Email-only, SMS-only, Multi-channel)
- Add Health filter (Healthy, Needs Attention, Critical)

#### Bulk Actions
- Select multiple campaigns
- Bulk Pause/Resume
- Bulk Duplicate
- Bulk Export to CSV

---

### Phase 5: Campaign Detail Page Enhancements

When clicking a campaign, show:

**Left Panel (70%)**
- Candidates table with sortable columns
- Inline engagement indicators (opened/clicked/replied badges)
- Quick action buttons per candidate
- Bulk select + bulk actions

**Right Panel (30%)**
- Campaign summary card
- Job details card
- Sequence timeline (existing but enhanced)
- Activity feed (real-time)

---

## File Structure

```text
src/
  pages/
    Campaigns.tsx           # Redesigned main page
  components/
    campaigns/
      CampaignCard.tsx          # NEW - Rich campaign card
      CampaignKanbanBoard.tsx   # NEW - Kanban view
      CampaignPipeline.tsx      # NEW - Funnel visualization
      CandidateQuickView.tsx    # NEW - Slide-out candidate list
      CampaignHealthIndicator.tsx # NEW - Health dot
      CampaignFilters.tsx       # NEW - Enhanced filter bar
      CampaignStats.tsx         # NEW - Top dashboard stats
      CampaignMetrics.tsx       # EXISTING - Enhanced
```

---

## Technical Details

### Key Features to Implement

1. **Real-time Updates**
   - Subscribe to `campaigns` and `campaign_leads_v2` changes
   - Auto-refresh metrics when new activity comes in

2. **Performance Optimization**
   - Virtualized list for 100+ campaigns
   - Lazy load candidate counts
   - Cache job details

3. **Responsive Design**
   - Cards stack on mobile
   - Kanban scrolls horizontally
   - Filters collapse to dropdown

4. **Accessibility**
   - Keyboard navigation in Kanban
   - Screen reader announcements for status changes
   - Focus management in slide-out panels

---

## Visual Design (Xbox Corporate Theme)

### Color Usage
- Active campaigns: Electric Blue border glow
- Paused: Warning yellow subtle border
- Completed: Muted border
- Health indicators: Green/Yellow/Red dots

### Card Design
```text
+----------------------------------------------------------+
| [Status Dot] Campaign Name                    [Active ▼] |
| IR - Interventional Radiology                            |
| 📍 Chippewa Valley, WI | $500/hr                        |
+----------------------------------------------------------+
|  METRICS PROGRESS BARS                                   |
|  ████████░░░░  Sent: 156                                |
|  █████░░░░░░░  Opened: 42 (27%)                         |
|  ██░░░░░░░░░░  Replied: 8 (5%)                          |
+----------------------------------------------------------+
| [📧 Email]  [💬 SMS]  [📞 Calls]                        |
|  120 sent   36 sent   8 connected                        |
+----------------------------------------------------------+
| [⏸ Pause] [👥 View Leads] [💬 Go to Inbox] [⋮ More]     |
+----------------------------------------------------------+
```

---

## Success Metrics

After implementation, users should be able to:
1. See campaign health at a glance (5 seconds)
2. Filter to "hot" campaigns with one click
3. Call/SMS a candidate without leaving the page
4. Understand which campaigns need attention immediately
5. Track candidate progress through the funnel visually

---

## Implementation Order

1. Create new component files (empty shells)
2. Implement CampaignCard with enhanced layout
3. Implement CampaignStats dashboard
4. Implement CampaignFilters with new options
5. Integrate into redesigned Campaigns.tsx
6. Add CandidateQuickView slide-out panel
7. Implement CampaignKanbanBoard view mode
8. Add real-time subscriptions
9. Polish animations and transitions
