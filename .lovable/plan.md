
# Instantly v2 Email Sequence Personalization Plan

## Problem Analysis

The current `launch-campaign` edge function has a critical gap:

1. **Campaign is created without sequences**: The campaign payload only includes name, email list, and schedule - but no email templates
2. **Leads have personalization data but templates don't use it**: Each lead has `icebreaker`, `talking_points`, `email_body`, etc. in their `payload` object, but there are no sequence steps that reference these with `{{variable}}` syntax
3. **Result**: Instantly doesn't know what emails to send because no sequence templates are defined

---

## How Instantly Personalization Works

Instantly uses variable substitution with double curly braces:
- Built-in variables: `{{first_name}}`, `{{last_name}}`, `{{email}}`, `{{company_name}}`
- Custom variables: Any field in the lead's `payload` object, e.g., `{{icebreaker}}`, `{{email_body}}`

**Current lead payload structure:**
```text
leads: [
  {
    email: "dr.smith@hospital.com",
    first_name: "John",
    last_name: "Smith",
    payload: {
      icebreaker: "I noticed you trained at Mayo...",
      talking_points: "Board certified, 10+ years...",
      specialty: "Cardiology"
    }
  }
]
```

**What's missing - sequences with templates:**
```text
sequences: [{
  steps: [
    {
      subject: "{{specialty}} Opportunity - Dr. {{last_name}}",
      body: "Hi Dr. {{last_name}},\n\n{{email_body}}\n\nBest,\nRainey"
    },
    // Follow-up steps with different templates
  ]
}]
```

---

## Solution Architecture

### Option A: Pre-Rendered Emails (Current Approach - Enhanced)

Store the fully personalized email body for each candidate in `payload.email_body` and use a simple template that renders it:

```text
sequences: [{
  steps: [
    { subject: "{{email_subject}}", body: "{{email_body}}" },
    { subject: "Following up - {{specialty}} in {{state}}", body: "{{followup_day3}}" },
    // etc.
  ]
}]

leads: [{
  email: "...",
  payload: {
    email_subject: "IR Opportunity - Dr. Smith - $625/hr",
    email_body: "Hi Dr. Smith,\n\n[Full personalized email]...",
    followup_day3: "[Full Day 3 email]...",
    // Pre-render all follow-ups per candidate
  }
}]
```

**Pros:**
- Each candidate gets their specific AI-generated content
- Maximum personalization (icebreakers, talking points already baked in)
- No need to change Personalization Studio flow

**Cons:**
- Larger payload size
- Must store all sequence steps per candidate

### Option B: Template Variables (Recommended)

Use Instantly's variable substitution and pass structured data:

```text
sequences: [{
  steps: [
    {
      subject: "{{specialty}} Opportunity - Dr. {{last_name}} - ${{pay_rate}}/hr",
      body: "Hi Dr. {{last_name}},\n\n{{icebreaker}}\n\nThis {{specialty}} role in {{city}}, {{state}} offers:\n- ${{pay_rate}}/hr take-home\n- {{call_status}}\n\nWould you be available for a quick call?\n\nBest,\n{{sender_name}}"
    }
  ]
}]

leads: [{
  payload: {
    icebreaker: "I noticed you trained at Mayo...",
    pay_rate: "625",
    call_status: "Zero call",
    // etc.
  }
}]
```

**Pros:**
- Cleaner payload structure
- Instant can show the template in dashboard
- Easier to modify templates without re-generating all content

**Cons:**
- Less flexibility for truly custom content per candidate
- Follow-up emails would need templated variables too

---

## Recommended Implementation

**Hybrid Approach**: Use Option A for Day 1 (fully personalized) and Option B for follow-ups (template-based)

### Changes Required

#### 1. Update `launch-campaign` Edge Function

Add sequences array to campaign creation:

```text
// When creating Instantly campaign, include sequences
const campaignPayload = {
  name: campaign_name,
  email_list: [sender_email],
  campaign_schedule: { ... },
  sequences: [{
    steps: [
      {
        subject: "{{email_subject}}",
        body: "{{email_body}}",
        wait_time: 0  // Day 1
      },
      {
        subject: "Clinical scope at {{facility_name}}",
        body: "{{followup_day3}}",
        wait_time: 2880 // 2 days in minutes
      },
      // Additional follow-up steps...
    ]
  }],
  stop_on_reply: true
};
```

#### 2. Update Lead Payload

Pass all sequence content per candidate:

```text
const leadsPayload = candidates.map(candidate => ({
  email: candidate.email,
  first_name: candidate.first_name,
  last_name: candidate.last_name,
  payload: {
    // Day 1 - from Personalization Studio
    email_subject: candidate.email_subject,
    email_body: candidate.email_body,
    // Follow-ups - pre-generated in Sequence Studio
    followup_day3: candidate.sequence_day3,
    followup_day5: candidate.sequence_day5,
    followup_day7: candidate.sequence_day7,
    followup_day14: candidate.sequence_day14,
    // Metadata for templates
    specialty: candidate.specialty,
    icebreaker: candidate.icebreaker,
    facility_name: job.facility_name,
    state: job.state,
    pay_rate: job.pay_rate
  }
}));
```

#### 3. Update Frontend to Pass Sequence Data

Modify `LaunchStatusBar.tsx` to include sequence steps:

```text
// Get sequence from sessionStorage
const storedSequence = sessionStorage.getItem("campaign_sequence");
const sequenceSteps = storedSequence ? JSON.parse(storedSequence) : [];

// Add to launch payload
const candidatePayload = candidates.map(c => ({
  ...existingFields,
  sequence_day3: getSequenceForCandidate(c, sequenceSteps, 3),
  sequence_day5: getSequenceForCandidate(c, sequenceSteps, 5),
  // etc.
}));
```

#### 4. Persist Sequence in SequenceStudio

Save sequence steps to sessionStorage when navigating to Review:

```text
sessionStorage.setItem("campaign_sequence", JSON.stringify(sequenceSteps));
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/launch-campaign/index.ts` | Add `sequences` array to campaign creation, restructure lead payloads |
| `src/pages/SequenceStudio.tsx` | Save sequence steps to sessionStorage on continue |
| `src/components/campaign-review/LaunchStatusBar.tsx` | Pass sequence steps in launch payload |
| `src/components/campaign-review/types.ts` | Add sequence types |

---

## Technical Details

### Instantly v2 Sequence Schema

```text
sequences: [{
  steps: [
    {
      subject: string,    // Email subject with {{variables}}
      body: string,       // Email body with {{variables}}
      variants: [{...}],  // Optional A/B variants
      wait_time: number   // Minutes to wait after previous step (0 for Day 1)
    }
  ]
}]
```

### Wait Time Calculation

| Day | wait_time (minutes) |
|-----|---------------------|
| 1   | 0                   |
| 3   | 2880 (2 days)       |
| 5   | 2880 (2 days)       |
| 7   | 2880 (2 days)       |
| 14  | 10080 (7 days)      |

---

## Summary

The fix requires:
1. **Add sequences to campaign creation** - Define email templates with variable placeholders
2. **Restructure lead payloads** - Include pre-rendered content for each sequence step
3. **Pass sequence data from frontend** - Store and forward sequence steps through the launch flow

This ensures each candidate receives their specific personalized content throughout the entire 14-day sequence, not just a generic template.
