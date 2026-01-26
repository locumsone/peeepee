
# Call Handling and Post-Call Features - Fix Plan

## Summary

This plan addresses multiple interconnected issues with call handling in the Communications Hub:
1. **Post-call notes failing to save** - RLS policy blocks INSERT/UPDATE on `ai_call_logs`
2. **Scheduled callbacks not working** - Missing mutation handler and UI display
3. **No AI analysis of call transcripts** - Edge function and UI needed
4. **Call notes not linked to candidate profile** - Missing data flow

---

## Root Cause Analysis

### 1. Call Notes Save Failure
The `ai_call_logs` table has RLS enabled but only has a SELECT policy for authenticated users:
```sql
-- Current: Only allows reading
"Authenticated users can view ai_call_logs" - SELECT only
```
The `PostCallModal.tsx` attempts to INSERT new records, which fails silently due to missing INSERT policy.

### 2. Scheduled Callbacks Not Working
- The "Confirm" button in `ConversationDetail.tsx` (line 332) has no `onClick` handler
- The `scheduled_callbacks` table has RLS disabled, but no UI displays the callbacks
- The `RemindersList` component only shows `sms_conversations.reminder_at`, not `scheduled_callbacks`

### 3. Missing AI Analysis
- The `ai_call_logs` table has an `ai_analysis` JSONB column (ready for use)
- No edge function exists to analyze transcripts
- The call detail view doesn't display AI insights

---

## Implementation Steps

### Phase 1: Database Policy Fixes

**Migration: Add INSERT/UPDATE policies for ai_call_logs**
```sql
-- Allow authenticated users to insert call logs
CREATE POLICY "Authenticated users can insert ai_call_logs"
ON public.ai_call_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update their call logs
CREATE POLICY "Authenticated users can update ai_call_logs"
ON public.ai_call_logs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
```

### Phase 2: Fix PostCallModal Save Logic

**File: `src/components/softphone/PostCallModal.tsx`**

Current issue: The mutation tries to INSERT a new record, but the call was already created by the `voice-incoming` webhook. Instead, we need to UPDATE the existing record.

Changes:
1. Find the existing call log by matching `phone_number` and recent timestamp
2. UPDATE instead of INSERT to add notes, outcome, and callback info
3. Handle the case where no existing record is found (manual call without webhook)

```typescript
const saveMutation = useMutation({
  mutationFn: async () => {
    // First, try to find the existing call log (created by webhook)
    const { data: existingCall } = await supabase
      .from("ai_call_logs")
      .select("id")
      .eq("phone_number", callData.phoneNumber)
      .gte("created_at", new Date(Date.now() - 300000).toISOString()) // Within last 5 mins
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingCall) {
      // Update existing record
      const { error } = await supabase
        .from("ai_call_logs")
        .update({
          call_summary: notes,
          call_result: outcome,
          duration_seconds: callData.duration,
          status: "completed",
        })
        .eq("id", existingCall.id);
      if (error) throw error;
    } else {
      // Create new record (fallback for manual calls)
      const { error } = await supabase
        .from("ai_call_logs")
        .insert({ /* existing fields */ });
      if (error) throw error;
    }

    // Schedule callback if requested
    if (scheduleCallback && callbackTime) {
      const { error } = await supabase
        .from("scheduled_callbacks")
        .insert({
          candidate_id: callData.candidateId || null,
          candidate_name: callData.candidateName || null,
          phone: callData.phoneNumber,
          scheduled_time: callbackTime,
          status: "pending",
        });
      if (error) throw error;
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["ai-call-logs"] });
    queryClient.invalidateQueries({ queryKey: ["scheduled-callbacks"] });
    toast.success("Call notes saved");
    handleClose();
  },
  onError: (err) => {
    console.error("Save error:", err);
    toast.error("Failed to save call notes");
  },
});
```

### Phase 3: Wire Up Scheduled Callback Button

**File: `src/components/inbox/ConversationDetail.tsx`**

Add mutation and connect the "Confirm" button:

```typescript
// Inside CallDetailView component
const scheduleCallbackMutation = useMutation({
  mutationFn: async () => {
    if (!callbackDate) throw new Error("No date selected");
    
    const { error } = await supabase
      .from("scheduled_callbacks")
      .insert({
        candidate_id: conversation.candidateId || null,
        candidate_name: conversation.candidateName,
        phone: conversation.candidatePhone,
        scheduled_time: callbackDate,
        status: "pending",
        created_from_call_id: conversation.id,
      });
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["scheduled-callbacks"] });
    toast.success("Callback scheduled");
    setCallbackDate("");
  },
  onError: () => {
    toast.error("Failed to schedule callback");
  },
});

// Update the Confirm button
<Button 
  size="sm" 
  className="w-full"
  onClick={() => scheduleCallbackMutation.mutate()}
  disabled={!callbackDate || scheduleCallbackMutation.isPending}
>
  {scheduleCallbackMutation.isPending ? "Scheduling..." : "Confirm"}
</Button>
```

### Phase 4: Display Scheduled Callbacks in Reminders Tab

**File: `src/components/inbox/RemindersList.tsx`**

Enhance to fetch and display scheduled callbacks alongside conversation reminders:

```typescript
// Add query for scheduled callbacks
const { data: scheduledCallbacks = [] } = useQuery({
  queryKey: ["scheduled-callbacks"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("scheduled_callbacks")
      .select("*")
      .eq("status", "pending")
      .order("scheduled_time", { ascending: true });
    if (error) throw error;
    return data || [];
  },
});

// Combine with conversation reminders for unified display
```

### Phase 5: Create AI Call Analysis Edge Function

**File: `supabase/functions/analyze-call/index.ts`**

New edge function that uses Lovable AI to analyze call transcripts:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { call_id, transcript } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a recruiting call analyst. Analyze call transcripts and extract:
              1. Candidate sentiment (positive/neutral/negative)
              2. Key talking points
              3. Objections or concerns raised
              4. Next steps mentioned
              5. Interest level (1-5 scale)
              6. Recommended follow-up action
              Return as JSON.`
          },
          { role: "user", content: transcript }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_call",
            parameters: {
              type: "object",
              properties: {
                sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
                key_points: { type: "array", items: { type: "string" } },
                objections: { type: "array", items: { type: "string" } },
                next_steps: { type: "array", items: { type: "string" } },
                interest_level: { type: "number" },
                recommended_action: { type: "string" }
              }
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_call" } }
      }),
    });

    const result = await aiResponse.json();
    const analysis = JSON.parse(result.choices[0].message.tool_calls[0].function.arguments);

    // Update the call log with AI analysis
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase
      .from("ai_call_logs")
      .update({
        ai_analysis: analysis,
        sentiment: analysis.sentiment,
      })
      .eq("id", call_id);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### Phase 6: Display AI Insights in Call Detail View

**File: `src/components/inbox/ConversationDetail.tsx`**

Add AI analysis display and trigger button:

```typescript
// In CallDetailView, add analyze mutation
const analyzeMutation = useMutation({
  mutationFn: async () => {
    if (!callData?.transcript_text) throw new Error("No transcript");
    const { data, error } = await supabase.functions.invoke("analyze-call", {
      body: { call_id: conversation.id, transcript: callData.transcript_text },
    });
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["call-detail", conversation.id] });
    toast.success("AI analysis complete");
  },
});

// Add UI for AI insights
{callData?.ai_analysis && (
  <Card className="bg-primary/5 border-primary/20">
    <CardContent className="pt-4">
      <h3 className="text-xs font-medium text-primary mb-2">AI Insights</h3>
      <div className="space-y-2 text-sm">
        <p>Sentiment: <Badge>{callData.ai_analysis.sentiment}</Badge></p>
        <p>Interest Level: {callData.ai_analysis.interest_level}/5</p>
        <p>Recommended: {callData.ai_analysis.recommended_action}</p>
      </div>
    </CardContent>
  </Card>
)}

{callData?.transcript_text && !callData?.ai_analysis && (
  <Button 
    variant="outline" 
    size="sm" 
    onClick={() => analyzeMutation.mutate()}
    disabled={analyzeMutation.isPending}
  >
    <Sparkles className="h-4 w-4 mr-1" />
    {analyzeMutation.isPending ? "Analyzing..." : "Analyze with AI"}
  </Button>
)}
```

### Phase 7: Update Config.toml

Add the new edge function:
```toml
[functions.analyze-call]
verify_jwt = false
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/` | CREATE | Add RLS INSERT/UPDATE policies |
| `src/components/softphone/PostCallModal.tsx` | MODIFY | Fix save logic (UPDATE vs INSERT) |
| `src/components/inbox/ConversationDetail.tsx` | MODIFY | Wire callback button, add AI display |
| `src/components/inbox/RemindersList.tsx` | MODIFY | Display scheduled callbacks |
| `supabase/functions/analyze-call/index.ts` | CREATE | AI transcript analysis |
| `supabase/config.toml` | MODIFY | Add function config |

---

## Technical Notes

- The `scheduled_callbacks` table has RLS disabled, so inserts will work without additional policies
- The `ai_call_logs.candidate_id` is stored as TEXT, not UUID (matching the existing schema)
- Twilio transcription is already enabled in `voice-incoming` via `transcribe="true"`
- The recording URL is automatically populated by Twilio's callback

