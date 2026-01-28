
# Multi-User Data Ownership & Job Assignment Plan

## Overview

This plan implements user-specific data separation for communications while maintaining shared access to jobs across the team. Each recruiter will see only their own SMS/call conversations, but jobs will be visible to everyone with clear indicators showing who is working on each job.

---

## Database Changes

### 1. Create `job_assignments` Table

A new table to track which recruiters are working on which jobs:

```text
job_assignments
├── id (uuid, primary key)
├── job_id (uuid, foreign key to jobs.id)
├── user_id (uuid, foreign key to auth.users)
├── role (text: 'primary' | 'support')
├── assigned_at (timestamp with time zone)
├── assigned_by (uuid, nullable)
└── created_at (timestamp with time zone)

Unique constraint: (job_id, user_id)
```

### 2. Update RLS Policies

**SMS Conversations**: Update existing policy to filter by `recruiter_id = auth.uid()`

**AI Call Logs**: Update existing policy to filter by `recruiter_id = auth.uid()`

**Jobs**: Keep public read access (team-wide visibility)

**Job Assignments**: All authenticated users can view, users can only manage their own assignments

---

## Frontend Changes

### 1. Communications Hub - User-Specific Data

**File: `src/pages/Communications.tsx`**

Update the queries to filter by current user ID:
- SMS conversations: Add `.eq('recruiter_id', userId)` filter
- AI call logs: Add `.eq('recruiter_id', userId)` filter

The current user ID comes from `useAuth()` hook.

### 2. Job Cards - Show Assigned Recruiters

**File: `src/components/jobs/ExpandableJobRow.tsx`**

Add a section showing assigned team members:
- Display avatar circles for each assigned recruiter
- Show primary vs support distinction
- Add "Assign" button to claim/join a job

**File: `src/pages/Jobs.tsx`**

- Fetch job assignments alongside jobs
- Pass assignment data to job cards
- Add filter option: "My Jobs" vs "All Jobs"

### 3. Job Detail Page - Assignment Management

**File: `src/pages/JobDetail.tsx`**

Add assignment management in the sidebar:
- Show current assignees with their roles
- Allow assigning/unassigning team members
- Display "Join this job" button for unassigned users

### 4. Dashboard - User Context

**File: `src/pages/Dashboard.tsx`**

Update to show:
- "My Jobs" (jobs assigned to current user)
- User's personal activity feed
- User's communication stats

### 5. New Component: `TeamMemberAvatars.tsx`

A reusable component to display team member avatars:
- Stacked avatar circles
- Tooltip showing names and roles
- Color coding by role (primary = green border, support = blue border)

### 6. New Component: `JobAssignmentDialog.tsx`

Modal for managing job assignments:
- List of team members with checkboxes
- Role selector (primary/support)
- Save/cancel actions

---

## Data Flow

```text
User logs in
    │
    ▼
useAuth() provides user.id
    │
    ├──▶ Communications: Filter conversations by recruiter_id
    │
    ├──▶ Dashboard: Show user's jobs & personal stats
    │
    └──▶ Jobs List: Show all jobs with assignment indicators
              │
              ▼
         User clicks "Assign" or "Join"
              │
              ▼
         job_assignments table updated
              │
              ▼
         UI refreshes to show new assignment
```

---

## Technical Details

### Query Updates

**Communications - SMS Query:**
```text
supabase
  .from("sms_conversations")
  .select(...)
  .eq("recruiter_id", user.id)  // Add this filter
```

**Jobs with Assignments:**
```text
supabase
  .from("jobs")
  .select(`
    *,
    job_assignments (
      id,
      role,
      user_id,
      users (
        id,
        name,
        email
      )
    )
  `)
```

### Auto-Assignment Logic

When a user sends the first SMS or makes a call to a candidate on a job:
1. Check if job_assignment exists for this user + job
2. If not, create assignment with role='support'
3. This ensures the job appears in "My Jobs" after interaction

### RLS Policy Examples

```text
-- SMS conversations: Users see only their own
CREATE POLICY "Users view own sms_conversations"
ON sms_conversations FOR SELECT
USING (recruiter_id = auth.uid());

-- Job assignments: All authenticated users can view
CREATE POLICY "View all job assignments"
ON job_assignments FOR SELECT
TO authenticated
USING (true);

-- Job assignments: Users manage own assignments
CREATE POLICY "Users manage own assignments"
ON job_assignments FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/jobs/TeamMemberAvatars.tsx` | Create | Display assigned recruiters |
| `src/components/jobs/JobAssignmentDialog.tsx` | Create | Manage job assignments |
| `src/pages/Communications.tsx` | Modify | Add user_id filtering |
| `src/pages/Jobs.tsx` | Modify | Fetch/display assignments |
| `src/components/jobs/ExpandableJobRow.tsx` | Modify | Show assigned members |
| `src/pages/JobDetail.tsx` | Modify | Add assignment management |
| `src/pages/Dashboard.tsx` | Modify | Show user's jobs/stats |
| Database migration | Create | Add job_assignments table + RLS |

---

## User Experience

### Before
- All users see all communications (mixed together)
- No indication of who is working on each job
- Jobs appear identical for all team members

### After
- Each user sees only their own SMS/call conversations
- Job cards show avatars of assigned recruiters
- "My Jobs" filter to focus on personal workload
- Clear ownership with ability to join or leave jobs
- Dashboard reflects individual recruiter performance

---

## Migration Considerations

1. **Existing SMS conversations** - Will need to populate `recruiter_id` based on who sent messages (or leave null for shared access initially)

2. **Existing AI calls** - Already have `recruiter_id`, should work immediately

3. **Job assignments** - Initially empty; users will need to claim their jobs

4. **Gradual rollout** - Add a "Show All Communications" toggle for admins to see team-wide view

