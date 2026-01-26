

## Communication Hub Cleanup and Email Feature Plan

### Issue 1: Remove Remaining Demo Data from ai_call_logs

The previous cleanup only removed fake SMS conversations but left demo call logs. I'll delete:

**Records to Delete:**
- Sarah Mitchell (`+15551234567`) - fake demo call
- James Chen (`+15559876543`) - fake demo call  
- Unknown (`+15557890123`) - fake voicemail
- Dr. ATLAZ Test (`+16784675978`, status=initiated) - old test entry
- All "in_progress" entries with `phone_number = 'unknown'` - incomplete test data

**SQL to Execute:**
```sql
DELETE FROM ai_call_logs 
WHERE phone_number IN ('+15551234567', '+15559876543', '+15557890123', 'unknown')
   OR (status = 'initiated' AND candidate_name = 'Dr. ATLAZ Test');
```

This will leave only your real conversation (+16784675978 SMS) in the inbox.

---

### Issue 2: Verify Message Display is Working

Based on the database query, your messages ARE correctly stored:
1. **Outbound (12:50 PM)**: "Hi Dr. Test! We have an IR opportunity in Wisconsin at $474/hr..."
2. **Inbound (1:50 PM)**: "Yes I am interested! When can we talk?"

The screenshot shows these messages displaying correctly on the right side. If they're not showing for you:
- Refresh the page
- Click on the `+16784675978` conversation in the left panel
- Verify the conversation ID matches

---

### Issue 3: Add Email Inbox (New Feature)

Currently, the Communication Hub only supports SMS and Calls. To add email functionality:

**Phase 1: Database Tables**
- Create `email_conversations` table (sender, recipient, subject, thread_id)
- Create `email_messages` table (conversation_id, direction, body_html, body_text, attachments)

**Phase 2: Integration Options**
Choose one integration approach:
- **Instantly.ai Integration**: Use existing Instantly webhook for email campaign replies
- **Direct IMAP/SMTP**: Connect to info@locums.one mailbox directly
- **SendGrid/Mailgun**: Use transactional email service with inbound parsing

**Phase 3: UI Updates**
- Add "Email" tab to the Communication Hub tabs
- Create `EmailConversationDetail` component similar to SMS view
- Add compose/reply functionality with rich text editor

---

### Summary of Changes

| Task | Type | Priority |
|------|------|----------|
| Delete demo data from `ai_call_logs` | Database cleanup | P0 - Immediate |
| Verify SMS message display | Debug/verify | P0 - Immediate |
| Add Email tab with "Coming Soon" placeholder | UI | P1 - Quick win |
| Full Email integration (Instantly or IMAP) | Feature | P2 - Requires discussion |

**Recommended approach**: Clean up demo data first, then decide which email integration path makes most sense for your workflow (Instantly for campaign emails vs. direct mailbox access for general inbox).

