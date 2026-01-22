import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QualityIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  candidate_name?: string;
  description: string;
  suggestion?: string;
}

interface CandidateData {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  specialty?: string;
  personalization_hook?: string;
}

interface ChannelConfig {
  email?: { sender: string; sequenceLength: number; gapDays: number } | null;
  sms?: { fromNumber: string; sequenceLength: number } | null;
  aiCall?: { fromNumber: string; callDay: number; transferTo: string } | null;
  linkedin?: boolean;
  schedule?: {
    startDate: string;
    sendWindowStart: string;
    sendWindowEnd: string;
    timezone: string;
    weekdaysOnly: boolean;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid JWT" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      job_id,
      campaign_name,
      candidates,
      channels,
      sender_email,
      email_sequence_count,
      sms_sequence_count,
    } = body as {
      job_id: string;
      campaign_name: string;
      candidates: CandidateData[];
      channels: ChannelConfig;
      sender_email?: string;
      email_sequence_count?: number;
      sms_sequence_count?: number;
    };

    const issues: QualityIssue[] = [];

    // === Critical Checks ===
    
    // Check if campaign has any candidates
    if (!candidates || candidates.length === 0) {
      issues.push({
        severity: 'critical',
        category: 'Candidates',
        description: 'No candidates selected for campaign',
        suggestion: 'Select at least one candidate to launch the campaign',
      });
    }

    // Check if at least one channel is enabled
    const hasChannel = channels?.email || channels?.sms || channels?.aiCall;
    if (!hasChannel) {
      issues.push({
        severity: 'critical',
        category: 'Channels',
        description: 'No outreach channels configured',
        suggestion: 'Enable at least one channel (Email, SMS, or AI Call)',
      });
    }

    // Check email channel requirements
    if (channels?.email) {
      if (!sender_email) {
        issues.push({
          severity: 'critical',
          category: 'Email',
          description: 'No sender email selected',
          suggestion: 'Select a sender account for email outreach',
        });
      }

      // Check candidates have email addresses
      const candidatesWithoutEmail = candidates.filter(c => !c.email);
      if (candidatesWithoutEmail.length > 0 && candidatesWithoutEmail.length === candidates.length) {
        issues.push({
          severity: 'critical',
          category: 'Email',
          description: 'No candidates have email addresses',
          suggestion: 'Enrich candidates or select different candidates with email addresses',
        });
      } else if (candidatesWithoutEmail.length > 0) {
        issues.push({
          severity: 'warning',
          category: 'Email',
          description: `${candidatesWithoutEmail.length} of ${candidates.length} candidates missing email`,
          suggestion: 'Consider enriching these candidates before launch',
        });
      }
    }

    // Check SMS/AI Call channel requirements
    if (channels?.sms || channels?.aiCall) {
      const candidatesWithoutPhone = candidates.filter(c => !c.phone);
      if (candidatesWithoutPhone.length > 0 && candidatesWithoutPhone.length === candidates.length) {
        issues.push({
          severity: 'critical',
          category: 'Phone',
          description: 'No candidates have phone numbers',
          suggestion: 'Enrich candidates or select different candidates with phone numbers',
        });
      } else if (candidatesWithoutPhone.length > 0) {
        issues.push({
          severity: 'warning',
          category: 'Phone',
          description: `${candidatesWithoutPhone.length} of ${candidates.length} candidates missing phone`,
          suggestion: 'These candidates will be skipped for SMS/Call channels',
        });
      }
    }

    // === Warning Checks ===

    // Check for personalization hooks
    const candidatesWithoutHook = candidates.filter(c => !c.personalization_hook);
    if (candidatesWithoutHook.length > candidates.length * 0.5) {
      issues.push({
        severity: 'warning',
        category: 'Personalization',
        description: `${candidatesWithoutHook.length} candidates missing personalization hooks`,
        suggestion: 'Run Sherlock AI to generate personalized openers for better response rates',
      });
    }

    // Check campaign name
    if (!campaign_name || campaign_name.trim().length < 5) {
      issues.push({
        severity: 'warning',
        category: 'Campaign',
        description: 'Campaign name is too short or missing',
        suggestion: 'Use a descriptive campaign name for easier tracking',
      });
    }

    // Check schedule if present
    if (channels?.schedule?.startDate) {
      const startDate = new Date(channels.schedule.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (startDate < today) {
        issues.push({
          severity: 'warning',
          category: 'Schedule',
          description: 'Start date is in the past',
          suggestion: 'Update the start date to today or a future date',
        });
      }

      // Check day of week
      const dayOfWeek = startDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        issues.push({
          severity: 'info',
          category: 'Schedule',
          description: 'Campaign scheduled to start on a weekend',
          suggestion: 'Weekday launches typically have better response rates',
        });
      } else if (dayOfWeek === 1) {
        issues.push({
          severity: 'info',
          category: 'Schedule',
          description: 'Campaign scheduled to start on Monday',
          suggestion: 'Tuesday-Thursday typically have better response rates',
        });
      }
    }

    // === Info Checks ===

    // Large candidate count
    if (candidates.length > 100) {
      issues.push({
        severity: 'info',
        category: 'Scale',
        description: `Large campaign with ${candidates.length} candidates`,
        suggestion: 'Consider staggering outreach over multiple days for better deliverability',
      });
    }

    // Fetch job details for additional validation
    const { data: jobData } = await supabase
      .from('jobs')
      .select('specialty, state, facility')
      .eq('id', job_id)
      .single();

    if (jobData) {
      // Check specialty match
      const mismatchedSpecialty = candidates.filter(
        c => c.specialty && jobData.specialty && 
        !c.specialty.toLowerCase().includes(jobData.specialty.toLowerCase()) &&
        !jobData.specialty.toLowerCase().includes(c.specialty.toLowerCase())
      );
      
      if (mismatchedSpecialty.length > candidates.length * 0.2) {
        issues.push({
          severity: 'warning',
          category: 'Match Quality',
          description: `${mismatchedSpecialty.length} candidates may not match job specialty`,
          suggestion: 'Review candidate selection to ensure good specialty fit',
        });
      }
    }

    // Calculate summary
    const summary = {
      critical: issues.filter(i => i.severity === 'critical').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
    };

    const canLaunch = summary.critical === 0;

    return new Response(
      JSON.stringify({
        can_launch: canLaunch,
        issues,
        summary,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Quality check error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
