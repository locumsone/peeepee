
# Campaigns Page Overhaul + Inbox Caller Fix - Complete Implementation Plan

## Overview

This plan implements two major features:
1. **Campaigns Page Overhaul** - Transform the flat table into a comprehensive ATS/CRM Command Center with rich campaign cards, Kanban view, pipeline visualization, and candidate quick-view
2. **Inbox "Unknown" Caller Fix** - Improve phone number matching and display logic to eliminate "Unknown" entries

---

## Part 1: Campaigns Page Overhaul

### Current State Problems
- Flat table design with no visual hierarchy
- Missing job context (specialty, facility, pay rate, location)
- No pipeline/funnel visualization
- No quick actions for candidates
- Limited metrics display (only Sent/Opened/Replied text)
- Emoji in header violating brand guidelines
- No Kanban or card view options

### New Architecture

```text
+------------------------------------------------------------------+
|  CAMPAIGNS                        [Search]   [+ New Campaign]    |
+------------------------------------------------------------------+
|  [List] [Kanban] [Pipeline]    Filter: [All] [Active] [Paused]   |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------------------------------------------------+  |
|  | [Active] IR Campaign - Interventional Radiology             |  |
|  | Chippewa Valley Health, WI | $500/hr                        |  |
|  +------------------------------------------------------------+  |
|  | SENT    OPENED    REPLIED    INTERESTED                     |  |
|  | ████░   ███░░     █░░░░      ●●○○○                          |  |
|  | 156     42 (27%)  8 (5%)     4 leads                        |  |
|  +------------------------------------------------------------+  |
|  | EMAIL: 120 | SMS: 36 | CALLS: 8 connected                   |  |
|  +------------------------------------------------------------+  |
|  | [Pause] [View Leads] [Inbox] [Duplicate] [...]              |  |
|  +------------------------------------------------------------+  |
|                                                                   |
+------------------------------------------------------------------+
```

### New Components to Create

#### 1. CampaignCard.tsx
Rich card component displaying:
- Campaign name + status badge with health indicator
- Job context: specialty, facility, city/state, pay rate
- Visual progress bars for metrics (sent, opened, replied)
- Channel breakdown (Email, SMS, Calls) with icons
- Quick action buttons (Pause/Resume, View Leads, Inbox, Duplicate)

#### 2. CampaignHealthIndicator.tsx
Visual health status component:
- Green dot: Healthy (Open Rate >= 30%)
- Yellow dot: Needs Attention (Open Rate 15-30%)
- Red dot: Low Engagement (Open Rate < 15%)
- Tooltip with explanation

#### 3. CampaignStats.tsx
Enhanced stats dashboard:
- Active/Paused/Completed/Draft counts
- Total leads across all campaigns
- Average open rate and reply rate
- "Hot" leads count (interested status)

#### 4. CampaignKanbanBoard.tsx
Drag-and-drop Kanban view:
- Columns: Draft, Active, Paused, Completed
- Compact cards showing campaign name, job, lead count
- Drag to change status
- Visual health indicators

#### 5. CampaignPipeline.tsx
Funnel visualization:
- Stages: Total Leads -> Contacted -> Opened -> Replied -> Interested -> Placed
- Visual funnel with percentages
- Click to filter by stage

#### 6. CandidateQuickView.tsx
Slide-out panel for campaign leads:
- List of candidates in the campaign
- Status badges (contacted, opened, replied, interested)
- Quick action buttons (Call, SMS, Email)
- Filter chips (All, Hot, Replied, Interested)
- Search within candidates

#### 7. CampaignFilters.tsx
Enhanced filter bar:
- Status tabs: All, Active, Paused, Completed, Draft
- Job dropdown filter
- Channel filter (Email, SMS, Multi-channel)
- Health filter (Healthy, Needs Attention, Critical)

### Enhanced Data Fetching

Current query:
```typescript
const { data } = await supabase
  .from("campaigns")
  .select(`*, jobs (job_name)`)
```

New query:
```typescript
const { data } = await supabase
  .from("campaigns")
  .select(`
    *,
    jobs (
      job_name,
      specialty,
      facility_name,
      city,
      state,
      pay_rate
    )
  `)
  .order("updated_at", { ascending: false });
```

### Interface Updates

```typescript
interface CampaignWithJob {
  id: string;
  name: string | null;
  job_id: string | null;
  channel: string | null;
  status: string | null;
  leads_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  // Email metrics
  emails_sent: number | null;
  emails_opened: number | null;
  emails_clicked: number | null;
  emails_replied: number | null;
  emails_bounced: number | null;
  // SMS metrics
  sms_sent: number | null;
  sms_delivered: number | null;
  sms_replied: number | null;
  // Call metrics
  calls_attempted: number | null;
  calls_connected: number | null;
  // Job context
  jobs: {
    job_name: string | null;
    specialty: string | null;
    facility_name: string | null;
    city: string | null;
    state: string | null;
    pay_rate: number | null;
  } | null;
}
```

### View Modes Implementation

```typescript
type ViewMode = "list" | "kanban" | "pipeline";
const [viewMode, setViewMode] = useState<ViewMode>("list");
```

### File Structure

```text
src/components/campaigns/
├── CampaignCard.tsx           # NEW - Rich campaign card
├── CampaignHealthIndicator.tsx # NEW - Health status dot
├── CampaignStats.tsx          # NEW - Dashboard stats
├── CampaignKanbanBoard.tsx    # NEW - Kanban view
├── CampaignPipeline.tsx       # NEW - Funnel view
├── CandidateQuickView.tsx     # NEW - Slide-out panel
├── CampaignFilters.tsx        # NEW - Enhanced filters
├── CampaignMetrics.tsx        # EXISTING - Enhance
└── index.ts                   # NEW - Barrel export

src/pages/
└── Campaigns.tsx              # REWRITE - Complete overhaul
```

---

## Part 2: Inbox "Unknown" Caller Fix

### Root Causes Identified
1. Phone number normalization inconsistency
2. Call logs with empty `phone_number` fields
3. Incomplete candidate matching in voice-incoming webhook
4. Display logic not falling back to formatted phone

### Fixes Required

#### 1. Enhanced Phone Matching in useTwilioDevice.ts
```typescript
const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10); // Last 10 digits
};

// Query with multiple field matching
const { data: candidate } = await supabase
  .from("candidates")
  .select("id, first_name, last_name, specialty, state")
  .or(`
    phone.ilike.%${last10},
    personal_mobile.ilike.%${last10},
    phone_enriched.ilike.%${last10}
  `)
  .limit(1)
  .maybeSingle();
```

#### 2. voice-incoming Edge Function Updates
- Normalize phone numbers on both inbound and outbound
- Match against all phone fields (phone, personal_mobile, phone_enriched)
- Set candidate_name immediately when match found
- Update ai_call_logs with proper candidate context

#### 3. Communications.tsx Display Logic
```typescript
// For call logs
const displayName = call.candidate_name && call.candidate_name !== ""
  ? call.candidate_name
  : formatPhoneNumber(call.phone_number) || "Unknown";

// Filter out invalid entries
.filter((call) => call.phone_number && call.phone_number !== "")
```

#### 4. ConversationDetail.tsx Header Fix
```typescript
const displayPhone = callData?.phone_number || conversation.candidatePhone;
const displayName = callData?.candidate_name && callData.candidate_name !== ""
  ? callData.candidate_name
  : conversation.candidateName && conversation.candidateName !== "Unknown"
    ? conversation.candidateName
    : formatPhoneNumber(displayPhone) || "Unknown";
```

---

## Implementation Order

### Phase 1: Inbox Fix (Quick Win)
1. Update useTwilioDevice.ts phone matching
2. Update voice-incoming edge function
3. Fix Communications.tsx display logic
4. Fix ConversationDetail.tsx header

### Phase 2: Campaign Components
1. Create CampaignHealthIndicator.tsx
2. Create CampaignCard.tsx with full layout
3. Create CampaignStats.tsx dashboard
4. Create CampaignFilters.tsx

### Phase 3: Views and Panels
1. Create CandidateQuickView.tsx slide-out
2. Create CampaignKanbanBoard.tsx
3. Create CampaignPipeline.tsx

### Phase 4: Main Page Integration
1. Rewrite Campaigns.tsx with new components
2. Add view mode toggle
3. Add real-time subscriptions
4. Remove emoji from header

---

## Technical Specifications

### Real-time Subscriptions
```typescript
useEffect(() => {
  const channel = supabase
    .channel("campaigns-realtime")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "campaigns",
    }, () => refetch())
    .subscribe();
  return () => supabase.removeChannel(channel);
}, []);
```

### Health Calculation Logic
```typescript
const calculateHealth = (campaign: CampaignWithJob): "healthy" | "warning" | "critical" => {
  const sent = campaign.emails_sent || 0;
  if (sent === 0) return "warning";
  
  const openRate = (campaign.emails_opened || 0) / sent * 100;
  if (openRate >= 30) return "healthy";
  if (openRate >= 15) return "warning";
  return "critical";
};
```

### Xbox Corporate Theme Styling
- Card backgrounds: `bg-card` (#16191D)
- Active glow: `shadow-glow` with Electric Blue
- Status colors: Success (green), Warning (yellow), Destructive (red)
- Progress bars with gradient fills
- No emojis anywhere in the UI

---

## Files to Create
1. `src/components/campaigns/CampaignCard.tsx`
2. `src/components/campaigns/CampaignHealthIndicator.tsx`
3. `src/components/campaigns/CampaignStats.tsx`
4. `src/components/campaigns/CampaignFilters.tsx`
5. `src/components/campaigns/CandidateQuickView.tsx`
6. `src/components/campaigns/CampaignKanbanBoard.tsx`
7. `src/components/campaigns/CampaignPipeline.tsx`
8. `src/components/campaigns/index.ts`

## Files to Modify
1. `src/pages/Campaigns.tsx` - Complete rewrite
2. `src/pages/Communications.tsx` - Display logic fixes
3. `src/components/inbox/ConversationDetail.tsx` - Header fix
4. `src/hooks/useTwilioDevice.ts` - Phone matching improvement
5. `supabase/functions/voice-incoming/index.ts` - Candidate lookup fix

---

## Success Criteria
1. No "Unknown" entries in inbox when phone number exists
2. Campaign cards show job context (specialty, facility, location, pay rate)
3. Visual health indicators on all campaigns
4. View mode toggle works (List/Kanban/Pipeline)
5. Candidate quick-view panel opens from campaign
6. Real-time updates when campaign data changes
7. No emojis in the UI
8. Xbox Corporate theme applied consistently
