

## Communication Hub 4.0 - Complete Redesign

### Executive Summary

This plan transforms the Communication Hub into a modern, recruiter-first command center inspired by Salesloft, Outreach.io, and Superhuman. Key improvements include removing all demo data, enabling messaging to any phone number (not just existing contacts), adding a reminder/snooze feature, and streamlining the UX for high-velocity recruiting workflows.

---

### Phase 1: Data Cleanup (Immediate)

**Problem**: 15 demo/test records polluting the `ai_call_logs` table

**Records to Delete**:
| Phone | Name | Status | Reason |
|-------|------|--------|--------|
| `+15551234567` | Sarah Mitchell | completed | Demo data |
| `+15559876543` | James Chen | completed | Demo data |
| `+15557890123` | Unknown | completed | Fake voicemail |
| `unknown` | null | in_progress | 11 incomplete test records |
| `+16784675978` | Dr. ATLAZ Test | initiated | Old test entry |
| `+12185628671` | null | in_progress | Test call to Twilio number |

**SQL Migration**:
```sql
DELETE FROM ai_call_logs 
WHERE phone_number IN ('+15551234567', '+15559876543', '+15557890123', 'unknown', '+12185628671')
   OR (status = 'initiated' AND candidate_name = 'Dr. ATLAZ Test')
   OR (status = 'in_progress' AND candidate_name IS NULL);
```

---

### Phase 2: "Quick Compose" - Message Anyone

**Problem**: Current modal requires selecting an existing candidate from the database

**Solution**: Add a "Manual Entry" mode that allows direct phone number input

**NewMessageModal.tsx Changes**:

1. Add toggle between "Search Contacts" and "New Number" modes
2. New Number mode shows:
   - Phone number input with E.164 validation
   - Optional name field (for display purposes)
   - Direct channel selection (SMS only for manual)
3. When sending to new number:
   - Create conversation with `candidate_id = null`
   - Store display name in a new `contact_name` column
   - Conversation appears immediately in inbox

**Database Migration**:
```sql
ALTER TABLE sms_conversations 
ADD COLUMN contact_name TEXT;
```

**UI Flow**:
```text
[New Message]
     |
     v
+-------------------+
| Search Contacts   |  <-- Toggle
| [x] New Number    |
+-------------------+
     |
     v
+-------------------+
| Phone: [________] |
| Name:  [________] | (optional)
+-------------------+
     |
     v
[Select Channel] --> [Compose & Send]
```

---

### Phase 3: Reminders & Snooze Feature

**Problem**: No way to follow up on conversations later

**Solution**: Add snooze/reminder functionality inspired by Superhuman

**Database Migration**:
```sql
ALTER TABLE sms_conversations 
ADD COLUMN reminder_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN reminder_note TEXT,
ADD COLUMN snoozed_until TIMESTAMP WITH TIME ZONE;
```

**UI Components**:

1. **Snooze Button** in conversation header:
   - "Later Today" (3 hours)
   - "Tomorrow Morning" (9am next day)
   - "Next Week" (Monday 9am)
   - "Custom..." (date picker)

2. **Reminders Tab** in main navigation:
   - Shows conversations with active reminders
   - Sorted by `reminder_at` ascending
   - Visual indicator when reminder is due

3. **Reminder Badge** on conversation list items:
   - Clock icon with time until reminder
   - Highlight when reminder is past due

**Keyboard Shortcuts**:
- `H` = Snooze until later today
- `T` = Snooze until tomorrow
- `W` = Snooze until next week

---

### Phase 4: UI/UX Improvements

**4.1 Unified Conversation Display**

Update conversation list to show contact name OR phone when no candidate linked:
```typescript
// ConversationList.tsx
const displayName = conv.candidateName !== 'Unknown' 
  ? conv.candidateName 
  : conv.contactName || formatPhoneNumber(conv.candidatePhone);
```

**4.2 Streamlined Header**

Reduce header height and merge actions:
- Remove redundant "Profile" badge
- Add snooze button inline
- Show reminder indicator if set

**4.3 Empty State Improvements**

When inbox is empty:
```text
+----------------------------------+
|     📬 Inbox Zero!               |
|                                  |
|  All caught up. Start a new     |
|  conversation or check back     |
|  later for replies.             |
|                                  |
|  [+ New Message]                |
+----------------------------------+
```

**4.4 Keyboard-First Navigation**

Enhance existing shortcuts:
| Key | Action |
|-----|--------|
| `↑/↓` | Navigate list |
| `Enter` | Open conversation |
| `Esc` | Close/back |
| `Cmd+N` | New message |
| `Cmd+Enter` | Send message |
| `1/2/3` | Insert AI suggestion |
| `H/T/W` | Snooze shortcuts |

---

### Phase 5: Email Tab (Coming Soon Placeholder)

**Problem**: No email visibility in Communication Hub

**Immediate Solution**: Add "Email" tab with coming soon state

```typescript
// Add to tabs
<TabsTrigger value="email" className="text-xs px-3 h-7 gap-1">
  <Mail className="h-3 w-3" />
  <span className="hidden sm:inline">Email</span>
  <Badge variant="outline" className="text-[8px] px-1">Soon</Badge>
</TabsTrigger>
```

**Email Tab Content**:
```text
+----------------------------------+
|     📧 Email Integration         |
|                                  |
|  Connect your email to view     |
|  and respond to candidates      |
|  directly from the hub.         |
|                                  |
|  [ Connect Instantly.ai ]       |
|  [ Connect Gmail/Outlook ]      |
+----------------------------------+
```

---

### Technical Implementation Summary

**Files to Create**:
1. `supabase/migrations/xxx_cleanup_demo_data.sql` - Remove demo records
2. `supabase/migrations/xxx_add_reminders.sql` - Add reminder columns

**Files to Modify**:
1. `src/components/inbox/NewMessageModal.tsx` - Add manual entry mode
2. `src/pages/Communications.tsx` - Add Email tab, Reminders filter
3. `src/components/inbox/ConversationList.tsx` - Show reminder indicators
4. `src/components/inbox/ConversationDetail.tsx` - Add snooze button
5. `supabase/functions/sms-campaign-send/index.ts` - Handle new conversations without candidate_id

---

### Feature Comparison: Before vs After

| Feature | Current | After Redesign |
|---------|---------|----------------|
| Demo data | 15 fake records | Clean slate |
| Message new contacts | Requires existing candidate | Any phone number |
| Reminders | None | Snooze + scheduled reminders |
| Keyboard shortcuts | Basic (↑↓ Enter) | Full power-user suite |
| Email | Not available | Coming Soon placeholder |
| Empty state | Generic | Helpful with CTA |
| Contact display | "Unknown" for new | Phone or custom name |

---

### Implementation Order

1. **Database Cleanup** (P0) - Delete demo data immediately
2. **Manual Entry Mode** (P0) - Enable messaging any phone
3. **Reminder Schema** (P1) - Add database columns
4. **Snooze UI** (P1) - Implement snooze buttons and shortcuts
5. **Email Placeholder** (P2) - Add coming soon tab
6. **Polish** (P2) - Empty states, keyboard hints

This redesign transforms the Communication Hub from a basic inbox into a recruiter power tool that matches industry standards from Salesloft, Outreach, and Superhuman.

