import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// SPECIALTY MAPS
// ============================================

const SPECIALTY_ABBREVS: Record<string, string> = {
  'Interventional Radiology': 'IR',
  'Diagnostic Radiology': 'DR',
  'Gastroenterology': 'GI',
  'Emergency Medicine': 'EM',
  'Family Medicine': 'FM',
  'Internal Medicine': 'IM',
  'Anesthesiology': 'Anes',
  'Cardiology': 'Cards',
  'Orthopedics': 'Ortho',
  'Orthopedic Surgery': 'Ortho',
  'Psychiatry': 'Psych',
  'Neurology': 'Neuro',
  'Oncology': 'Onc',
  'Urology': 'Uro',
  'OB/GYN': 'OB',
  'Obstetrics': 'OB',
  'Gynecology': 'GYN',
  'General Surgery': 'GenSurg',
  'Pulmonology': 'Pulm',
  'Nephrology': 'Neph',
  'Rheumatology': 'Rheum',
  'Dermatology': 'Derm',
  'Endocrinology': 'Endo',
  'Infectious Disease': 'ID',
  'Hospitalist': 'HM',
  'Hospital Medicine': 'HM',
  'Critical Care': 'ICU',
  'Nurse Practitioner': 'NP',
  'Physician Assistant': 'PA',
  'CRNA': 'CRNA',
};

const DEFAULT_PROCEDURES: Record<string, string[]> = {
  'Interventional Radiology': [
    'CT/US-guided biopsies',
    'Port and PICC placements',
    'Nephrostomy tubes',
    'Abscess drainage'
  ],
  'Gastroenterology': [
    'EGD and colonoscopy',
    'ERCP',
    'Capsule endoscopy',
    'Motility studies'
  ],
  'Emergency Medicine': [
    'Trauma stabilization',
    'Chest pain workup',
    'Laceration repair',
    'Fracture reduction'
  ],
  'Family Medicine': [
    'Acute care visits',
    'Chronic disease management',
    'Preventive care',
    'Minor procedures'
  ],
  'Internal Medicine': [
    'Hospital rounding',
    'Chronic disease management',
    'Discharge planning',
    'Care coordination'
  ],
  'Hospitalist': [
    'Hospital rounding',
    'Admissions and discharges',
    'Cross-cover calls',
    'Care coordination'
  ],
  'Cardiology': [
    'Stress tests',
    'Echo interpretation',
    'Device follow-up',
    'Cath lab consults'
  ],
  'Anesthesiology': [
    'General anesthesia cases',
    'Regional blocks',
    'Pre-op evaluations',
    'ICU coverage'
  ],
  'Psychiatry': [
    'Inpatient consults',
    'Med management',
    'Crisis stabilization',
    'Discharge planning'
  ],
  'default': [
    'Primary patient care',
    'Consultation services',
    'Documentation',
    'Care coordination'
  ]
};

// ============================================
// FORBIDDEN PHRASES VALIDATION
// ============================================

const FORBIDDEN_PHRASES = [
  'I noticed your', 'I saw your', "I'm excited to",
  'Your experience is impressive', 'caught my attention',
  'elite compensation', 'amazing opportunity', 'incredible opportunity',
  'dream role', 'perfect fit', 'exciting procedures',
  'just checking in', 'just following up', 'just wanted to',
  'touch base', 'circle back', 'ping you',
  'hope this finds you well', 'reaching out because',
  'would love to', "I'd love to connect",
  'rockstar', 'superstar', 'unicorn',
];

const validateContent = (content: string): { isValid: boolean; violations: string[] } => {
  const lower = content.toLowerCase();
  const found = FORBIDDEN_PHRASES.filter(p => lower.includes(p.toLowerCase()));
  return { isValid: found.length === 0, violations: found };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getSpecialtyAbbrev = (specialty: string): string => {
  return SPECIALTY_ABBREVS[specialty] || specialty.split(' ')[0];
};

const getProcedures = (specialty: string, providedProcedures?: string[]): string[] => {
  if (providedProcedures && providedProcedures.length > 0) {
    return providedProcedures.slice(0, 4);
  }
  return DEFAULT_PROCEDURES[specialty] || DEFAULT_PROCEDURES['default'];
};

const getPrimaryDifferentiator = (job: EnhancedJob): string => {
  const callStatus = job.call_status?.toLowerCase() || '';
  if (callStatus.includes('zero') || callStatus.includes('no call')) {
    return 'ZERO CALL';
  }
  if (job.schedule?.toLowerCase().includes('m-f')) {
    return 'M-F Days';
  }
  if (job.shift_type === 'Days') {
    return 'Day Shift';
  }
  if (job.facility_type?.toLowerCase().includes('non-trauma')) {
    return 'Non-Trauma';
  }
  return 'Flexible Schedule';
};

// ============================================
// INTERFACES
// ============================================

interface EnhancedJob {
  specialty: string;
  specialty_abbrev?: string;
  facility_name: string;
  facility_type?: string;
  city: string;
  state: string;
  pay_rate: number;
  call_status?: string;
  schedule?: string;
  cred_days?: number;
  procedures?: string[];
  rvu_target?: string;
  shift_type?: string;
}

interface Candidate {
  id: string;
  first_name?: string;
  last_name: string;
  city?: string;
  state?: string;
  company_name?: string;
  specialty?: string;
}

interface SequenceRequest {
  job_id: string;
  initial_email_subject: string;
  initial_email_body: string;
  initial_sms: string;
  candidate: Candidate;
  job: EnhancedJob;
  playbook_data?: Record<string, unknown>;
}

interface EmailStep {
  day: number;
  channel: 'email';
  type: 'followup';
  angle: string;
  subject: string;
  content: string;
}

// ============================================
// DAY 3: CLINICAL SCOPE ("What will I actually do?")
// ============================================

const generateDay3Email = (job: EnhancedJob, candidate: Candidate): EmailStep => {
  const procedures = getProcedures(job.specialty, job.procedures);
  const procedureList = procedures.map(p => `• ${p}`).join('\n');
  
  // Build volume/pace line
  let paceLine = '';
  if (job.rvu_target && job.call_status) {
    paceLine = `Pace is sustainable (${job.rvu_target}), ${job.call_status.toLowerCase()}.`;
  } else if (job.call_status) {
    paceLine = `${job.call_status}, sustainable daily volume.`;
  } else {
    paceLine = 'Sustainable daily volume, manageable schedule.';
  }
  
  const subject = `Clinical scope at ${job.facility_name}`.substring(0, 55);
  
  const content = `Dr. ${candidate.last_name},

Following up on the ${job.specialty} opportunity in ${job.city}.

Daily case mix includes:
${procedureList}

${paceLine} The $${job.pay_rate}/hr rate is still available.

Happy to walk through the case distribution if helpful.`;

  return {
    day: 3,
    channel: 'email',
    type: 'followup',
    angle: 'clinical_scope',
    subject,
    content,
  };
};

// ============================================
// DAY 5: LIFESTYLE ("Will this fit my life?")
// ============================================

const generateDay5Email = (job: EnhancedJob, candidate: Candidate): EmailStep => {
  const benefits: string[] = [];
  
  // Call status (most important for lifestyle)
  const callStatus = job.call_status?.toLowerCase() || '';
  if (callStatus.includes('zero') || callStatus.includes('no call')) {
    benefits.push(`• ${job.call_status} (not "light call" - actually zero)`);
  } else if (job.call_status) {
    benefits.push(`• ${job.call_status}`);
  }
  
  // Schedule
  if (job.schedule) {
    benefits.push(`• ${job.schedule} schedule`);
  }
  
  // Credentialing speed
  if (job.cred_days) {
    benefits.push(`• ${job.cred_days}-day credentialing vs typical 90-120`);
  }
  
  // Local benefit
  if (candidate.state && candidate.state === job.state) {
    benefits.push(`• No relocating required`);
  }
  
  // Universal appeal
  benefits.push(`• No hospital politics, no admin burden`);
  
  const subject = `Schedule flexibility in ${job.city}`.substring(0, 55);
  
  const content = `Dr. ${candidate.last_name},

Circling back on the ${job.city} ${job.specialty} locums role.

What works for most physicians here:
${benefits.join('\n')}

$${job.pay_rate}/hr if timing makes sense. Happy to answer questions about the clinical environment.`;

  return {
    day: 5,
    channel: 'email',
    type: 'followup',
    angle: 'lifestyle',
    subject,
    content,
  };
};

// ============================================
// DAY 7: CURIOSITY ("Am I missing something?")
// ============================================

const generateDay7Email = (job: EnhancedJob, candidate: Candidate): EmailStep => {
  const abbrev = getSpecialtyAbbrev(job.specialty);
  
  const subject = `Quick question - ${abbrev} in ${job.state}`.substring(0, 55);
  
  const content = `Dr. ${candidate.last_name},

I realize I've sent a few notes about the ${job.specialty} position at ${job.facility_name}.

Curious if timing isn't right, or if there's something specific about the role that doesn't fit what you're looking for?

Either way, the $${job.pay_rate}/hr opportunity remains open. Happy to discuss or step back if you'd prefer.`;

  return {
    day: 7,
    channel: 'email',
    type: 'followup',
    angle: 'curiosity',
    subject,
    content,
  };
};

// ============================================
// DAY 14: BREAKUP/RESOURCE ("Can this person help me later?")
// ============================================

const generateBreakupEmail = (job: EnhancedJob, candidate: Candidate): EmailStep => {
  const resourceOffers = [
    `• Current ${job.specialty} locums rates by region`,
    `• Market conditions for ${job.specialty.toLowerCase()}`,
    `• Credentialing timelines in specific states`,
    `• General locums questions`
  ];
  
  const subject = `Closing the loop - ${job.specialty} opportunity`.substring(0, 55);
  
  const content = `Dr. ${candidate.last_name},

I'll assume the timing isn't right for the ${job.city} opportunity and won't follow up further on this role.

That said—if you ever want to discuss:
${resourceOffers.join('\n')}

Feel free to reach out anytime. No pitch, just information.

Best,`;

  return {
    day: 14,
    channel: 'email',
    type: 'followup',
    angle: 'breakup_resource',
    subject,
    content,
  };
};

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      job_id,
      initial_email_subject,
      initial_email_body,
      initial_sms,
      candidate,
      job,
      playbook_data,
    }: SequenceRequest = await req.json();

    if (!candidate || !job) {
      return new Response(
        JSON.stringify({ error: "Missing candidate or job data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build enhanced job with playbook data if available
    const enhancedJob: EnhancedJob = {
      specialty: job.specialty || 'Locum Tenens',
      specialty_abbrev: job.specialty_abbrev || getSpecialtyAbbrev(job.specialty || ''),
      facility_name: job.facility_name || 'the facility',
      facility_type: job.facility_type,
      city: job.city || '',
      state: job.state || '',
      pay_rate: job.pay_rate || 500,
      call_status: job.call_status,
      schedule: job.schedule,
      cred_days: job.cred_days,
      procedures: job.procedures,
      rvu_target: job.rvu_target,
      shift_type: job.shift_type,
    };

    // Extract from playbook_data if available
    if (playbook_data) {
      const clinical = playbook_data.clinical as Record<string, unknown> | undefined;
      const credentialing = playbook_data.credentialing as Record<string, unknown> | undefined;
      const position = playbook_data.position as Record<string, unknown> | undefined;
      
      if (clinical) {
        if (!enhancedJob.call_status && clinical.call_status) {
          enhancedJob.call_status = clinical.call_status as string;
        }
        if (!enhancedJob.procedures && clinical.procedures) {
          enhancedJob.procedures = clinical.procedures as string[];
        }
        if (!enhancedJob.rvu_target && clinical.volume) {
          enhancedJob.rvu_target = clinical.volume as string;
        }
      }
      
      if (credentialing && !enhancedJob.cred_days && credentialing.days_to_credential) {
        enhancedJob.cred_days = credentialing.days_to_credential as number;
      }
      
      if (position) {
        if (!enhancedJob.facility_type && position.facility_type) {
          enhancedJob.facility_type = position.facility_type as string;
        }
        if (!enhancedJob.schedule && position.schedule) {
          enhancedJob.schedule = position.schedule as string;
        }
      }
    }

    console.log('Generating sequence with enhanced job:', JSON.stringify(enhancedJob));

    // Generate all follow-up emails with psychological angles
    const day3 = generateDay3Email(enhancedJob, candidate);
    const day5 = generateDay5Email(enhancedJob, candidate);
    const day7 = generateDay7Email(enhancedJob, candidate);
    const day14 = generateBreakupEmail(enhancedJob, candidate);

    const sequenceSteps = [day3, day5, day7, day14];

    // Validate all content against forbidden phrases
    const validationResults = sequenceSteps.map(step => ({
      day: step.day,
      angle: step.angle,
      ...validateContent(step.content),
    }));

    const violations = validationResults.filter(r => !r.isValid);
    if (violations.length > 0) {
      console.warn('Forbidden phrases detected:', violations);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sequence_steps: sequenceSteps,
        candidate_id: candidate.id,
        job_id,
        validation: {
          all_valid: violations.length === 0,
          violations: violations,
        },
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate sequence error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
