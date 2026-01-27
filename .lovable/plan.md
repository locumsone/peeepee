

# Jobs ATS Transformation - Full Redesign

## Overview

Transform the current basic Jobs page into a comprehensive Applicant Tracking System (ATS) experience inspired by industry leaders like Greenhouse, Lever, and iCIMS. This will include candidate pipeline visualization, activity tracking, outreach metrics, and reply management - all within the job context.

---

## Current State Analysis

**What Exists Today:**
- Jobs list with basic details (facility, location, pay rate, status)
- Job detail page showing static information and pay breakdown
- Campaigns are separate from jobs with limited linkage
- No candidate pipeline visibility per job
- No reply/activity tracking within job context

**Database Assets Available:**
- `jobs` table with 98 jobs (22 active, 7 open)
- `campaigns` table linked to jobs via `job_id`
- `campaign_leads_v2` with full pipeline tracking (status, emails_sent/replied, sms_sent/replied, calls)
- `sms_messages` for SMS conversation history
- `ai_call_logs` for call tracking
- `candidates` with 138K+ records (64 enriched with contact info)

---

## Proposed ATS Features

### 1. Enhanced Job Detail Page with Pipeline View

```text
+----------------------------------------------------------+
| [Back] IR - Middletown, NY                    [ACTIVE]   |
|         Garnet Health • $150/hr                          |
+----------------------------------------------------------+
|                                                          |
| [Candidates] [Activity] [Outreach] [Settings]            |
|                                                          |
+----------------------------------------------------------+
| CANDIDATE PIPELINE                                       |
+----------+----------+----------+----------+--------------+
| Sourced  | Contacted| Interested| Placed  |              |
|   24     |    18    |    5     |    1    |              |
+----------+----------+----------+----------+--------------+
|                                                          |
| [Kanban board showing candidates in each stage]          |
|                                                          |
+----------------------------------------------------------+
```

### 2. Pipeline Stages (Healthcare-Specific)

| Stage | Description | Color |
|-------|-------------|-------|
| **Sourced** | Matched but not yet contacted | Gray |
| **Contacted** | Initial outreach sent | Blue |
| **Engaged** | Opened/Clicked/Replied | Yellow |
| **Interested** | Expressed interest via any channel | Green |
| **Submitted** | CV submitted to client | Purple |
| **Placed** | Successfully placed | Emerald |
| **Not Interested** | Declined or unresponsive after X touches | Red |

### 3. Job Detail Tabs Structure

**Tab 1: Candidates** (Default)
- Pipeline summary bar (visual)
- Kanban or list view toggle
- Candidate cards with:
  - Name, specialty, location
  - Current stage badge
  - Last contact date
  - Engagement metrics (opens, replies)
  - Quick actions (call, SMS, email)

**Tab 2: Activity**
- Unified activity feed from all sources:
  - SMS messages (sent/received)
  - Emails (sent/opened/replied)
  - AI Calls (completed/callbacks)
  - Manual notes
- Filterable by candidate or activity type

**Tab 3: Outreach Metrics**
- Aggregate stats for all campaigns linked to this job:
  - Total candidates reached
  - Response rates by channel
  - Best performing touchpoints
  - Time-to-response analytics

**Tab 4: Job Settings**
- Edit job details
- Requirements checklist
- Pay breakdown
- Client contact info

### 4. Enhanced Jobs List Page

Add pipeline summary to each job card:

```text
+------------------------------------------+
| IR - Middletown, NY              [ACTIVE] |
| Garnet Health                             |
| NY • $150/hr                              |
+------------------------------------------+
| Pipeline: ████░░░░░░ 18 contacted         |
| 5 interested • 2 replies today            |
+------------------------------------------+
| [View Pipeline]  [Create Campaign]        |
+------------------------------------------+
```

### 5. Quick Filters on Jobs Page

- **By Activity**: Jobs with replies in last 24h
- **By Stage**: Jobs with candidates in "Interested" stage
- **By Coverage**: Jobs without campaigns (need attention)
- **By Urgency**: Marked as urgent or with upcoming start dates

---

## New Components to Create

### 1. `JobPipeline.tsx`
Visual pipeline bar showing candidate distribution across stages

### 2. `JobCandidateKanban.tsx`
Draggable kanban board for candidates within a job context

### 3. `JobCandidateCard.tsx`
Compact candidate card with engagement metrics and quick actions

### 4. `JobActivityFeed.tsx`
Unified activity feed aggregating SMS, email, and call events for a job

### 5. `JobOutreachStats.tsx`
Metrics dashboard showing channel performance for the job

### 6. `JobReplyBadge.tsx`
Badge indicator showing reply count (appears on job cards)

---

## Data Flow Architecture

```text
Job Detail Page
       |
       v
+------------------+
| Fetch Job Data   |
+------------------+
       |
       +---------> Fetch Campaigns (WHERE job_id = X)
       |                    |
       |                    v
       |           Fetch campaign_leads_v2 (WHERE campaign_id IN (...))
       |                    |
       +---------> Aggregate by status --> Pipeline counts
       |
       +---------> Fetch SMS Messages (WHERE candidate_id IN (...))
       |
       +---------> Fetch AI Call Logs (WHERE job_id = X)
       |
       v
Render Pipeline + Candidates + Activity
```

---

## Database Queries Required

### Query 1: Pipeline Counts per Job
```sql
SELECT 
  cl.status,
  COUNT(*) as count
FROM campaign_leads_v2 cl
JOIN campaigns c ON c.id = cl.campaign_id
WHERE c.job_id = $JOB_ID
GROUP BY cl.status
```

### Query 2: Candidates with Engagement for Job
```sql
SELECT 
  cl.*,
  ca.first_name,
  ca.last_name,
  ca.personal_mobile,
  ca.personal_email
FROM campaign_leads_v2 cl
JOIN campaigns c ON c.id = cl.campaign_id
LEFT JOIN candidates ca ON ca.id = cl.candidate_id
WHERE c.job_id = $JOB_ID
ORDER BY cl.updated_at DESC
```

### Query 3: Recent Activity for Job
```sql
-- SMS Activity
SELECT 
  'sms' as type,
  sm.created_at,
  sm.body as content,
  sm.direction,
  sm.to_number as phone,
  cl.candidate_name
FROM sms_messages sm
JOIN sms_conversations sc ON sc.id = sm.conversation_id
JOIN campaign_leads_v2 cl ON cl.id = sc.campaign_lead_id
JOIN campaigns c ON c.id = cl.campaign_id
WHERE c.job_id = $JOB_ID
ORDER BY sm.created_at DESC
LIMIT 50
```

### Query 4: Reply Count for Job Cards
```sql
SELECT 
  c.job_id,
  SUM(cl.emails_replied) + SUM(cl.sms_replied) as total_replies,
  COUNT(DISTINCT CASE WHEN cl.status IN ('interested', 'engaged') THEN cl.id END) as hot_leads
FROM campaign_leads_v2 cl
JOIN campaigns c ON c.id = cl.campaign_id
WHERE c.job_id IS NOT NULL
GROUP BY c.job_id
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/jobs/JobPipeline.tsx` | Visual pipeline summary bar |
| `src/components/jobs/JobCandidateKanban.tsx` | Kanban board for job candidates |
| `src/components/jobs/JobCandidateCard.tsx` | Individual candidate card |
| `src/components/jobs/JobActivityFeed.tsx` | Activity feed for job |
| `src/components/jobs/JobOutreachStats.tsx` | Metrics dashboard |
| `src/components/jobs/JobReplyBadge.tsx` | Reply indicator badge |
| `src/components/jobs/index.ts` | Component exports |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/JobDetail.tsx` | Complete redesign with tabs, pipeline, and activity |
| `src/pages/Jobs.tsx` | Add pipeline summaries, reply badges, and filters |
| `src/components/dashboard/DashboardJobCard.tsx` | Add pipeline mini-view |

---

## Implementation Phases

### Phase 1: Job Detail Page Transformation
1. Add tabbed interface (Candidates, Activity, Outreach, Settings)
2. Create JobPipeline component with stage counts
3. Create JobCandidateKanban for visual candidate management
4. Implement stage drag-and-drop to update candidate status

### Phase 2: Activity & Metrics Integration
1. Create unified JobActivityFeed component
2. Aggregate SMS, email events, and call logs
3. Create JobOutreachStats dashboard
4. Add reply/engagement badges

### Phase 3: Jobs List Enhancement
1. Add pipeline summary bars to job cards
2. Add "Hot Leads" indicator showing recent replies
3. Implement quick filters (by activity, by stage)
4. Add "Needs Attention" section for jobs without outreach

### Phase 4: Candidate Stage Management
1. Enable drag-and-drop stage changes in Kanban
2. Add bulk actions (move multiple candidates)
3. Implement status change logging
4. Add quick action buttons on candidate cards

---

## UI/UX Improvements

### Color Coding
- **Sourced**: `bg-muted` (gray)
- **Contacted**: `bg-blue-500/20` (blue)
- **Engaged**: `bg-warning/20` (yellow/amber)
- **Interested**: `bg-success/20` (green)
- **Submitted**: `bg-purple-500/20` (purple)
- **Placed**: `bg-emerald-500/20` (emerald)
- **Not Interested**: `bg-destructive/20` (red)

### Engagement Indicators
- 🔥 Hot Lead: Replied within 24 hours
- ⚡ Active: Opened/clicked in last 7 days
- 💤 Cold: No engagement in 14+ days
- ❌ Bounced: Email or SMS delivery failed

### Pipeline Progress Bar
Visual representation using stacked horizontal bars:
```text
Sourced  Contacted   Interested   Placed
[█████████][███████][████][██]
    40%       30%      20%    10%
```

---

## Success Metrics

After implementation:
1. Every job shows real-time pipeline counts
2. Recruiters can see all activity for a job in one place
3. Candidate stages can be updated via drag-and-drop
4. Reply notifications are visible on job cards
5. Time-to-hire visibility via pipeline progression
6. Channel performance comparison (email vs SMS vs call)

---

## Technical Considerations

### Performance
- Use React Query for data caching
- Implement virtual scrolling for large candidate lists
- Lazy load activity feed with pagination

### Real-time Updates
- Subscribe to `campaign_leads_v2` changes for live stage updates
- Subscribe to `sms_messages` for incoming reply notifications

### Mobile Responsiveness
- Pipeline collapses to horizontal scroll on mobile
- Kanban switches to list view on small screens
- Activity feed remains full-width

