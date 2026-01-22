import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedJob {
  specialty: string;
  location: string;
  city: string;
  state: string;
  facility: string;
  dates: string;
  startDate: string | null;
  endDate: string | null;
  billRate: number;
  payRate: number;
  schedule: string | null;
  requirements: string | null;
  description: string | null;
  jobTitle: string;
  onCall: boolean;
  onCallDetails: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobText } = await req.json();
    
    if (!jobText || typeof jobText !== 'string') {
      throw new Error('Job text is required');
    }

    console.log('Parsing job text with AI:', jobText.substring(0, 200));

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Use AI to extract structured data
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a job posting parser. Extract structured data from healthcare job postings. Be precise with locations - extract the actual city name, not random words.`
          },
          {
            role: 'user',
            content: `Parse this job posting and extract the details:\n\n${jobText}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'parse_job',
              description: 'Extract structured job details from a job posting',
              parameters: {
                type: 'object',
                properties: {
                  specialty: { 
                    type: 'string', 
                    description: 'Medical specialty (e.g., Interventional Radiology, Cardiology)' 
                  },
                  facility: { 
                    type: 'string', 
                    description: 'Facility or hospital name' 
                  },
                  city: { 
                    type: 'string', 
                    description: 'City where the job is located' 
                  },
                  state: { 
                    type: 'string', 
                    description: 'Two-letter state abbreviation (e.g., TX, CA)' 
                  },
                  startDate: { 
                    type: 'string', 
                    description: 'Start date in MM/DD/YYYY format, or null if not specified' 
                  },
                  endDate: { 
                    type: 'string', 
                    description: 'End date in MM/DD/YYYY format. Use "Open" or null if ongoing/not specified' 
                  },
                  billRate: { 
                    type: 'number', 
                    description: 'Bill rate per hour in dollars (just the number)' 
                  },
                  payRate: { 
                    type: 'number', 
                    description: 'Pay rate per hour in dollars. If not specified, calculate as 73% of bill rate' 
                  },
                  schedule: { 
                    type: 'string', 
                    description: 'Work schedule (e.g., M-F 8a-5p, 5 days/week). Keep it brief.' 
                  },
                  onCall: { 
                    type: 'boolean', 
                    description: 'Whether on-call is required' 
                  },
                  onCallDetails: { 
                    type: 'string', 
                    description: 'On-call schedule details (e.g., 1 week in 5 weeks)' 
                  },
                  requirements: { 
                    type: 'string', 
                    description: 'License and credential requirements, comma-separated' 
                  },
                },
                required: ['specialty', 'facility', 'city', 'state', 'billRate'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'parse_job' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add credits to continue.');
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error('Failed to parse job with AI');
    }

    const aiResponse = await response.json();
    console.log('AI response:', JSON.stringify(aiResponse));

    // Extract the tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'parse_job') {
      throw new Error('AI did not return expected structured data');
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    console.log('Extracted data:', JSON.stringify(extracted));

    // Build the parsed job object
    const location = extracted.city && extracted.state 
      ? `${extracted.city}, ${extracted.state}` 
      : extracted.state || extracted.city || '';

    const dates = extracted.startDate 
      ? `${extracted.startDate}${extracted.endDate === 'Open' || !extracted.endDate ? ' - Ongoing' : ` - ${extracted.endDate}`}`
      : '';

    const payRate = extracted.payRate || Math.round((extracted.billRate || 0) * 0.73);

    const parsed: ParsedJob = {
      specialty: extracted.specialty || '',
      location,
      city: extracted.city || '',
      state: extracted.state || '',
      facility: extracted.facility || '',
      dates,
      startDate: extracted.startDate || null,
      endDate: extracted.endDate === 'Open' ? null : extracted.endDate || null,
      billRate: extracted.billRate || 0,
      payRate,
      schedule: extracted.schedule || null,
      requirements: extracted.requirements || null,
      description: jobText.substring(0, 2000),
      jobTitle: `${extracted.specialty || 'Position'} - ${extracted.city || ''}, ${extracted.state || ''}`.trim(),
      onCall: extracted.onCall || false,
      onCallDetails: extracted.onCallDetails || null,
    };

    console.log('Final parsed job:', JSON.stringify(parsed));

    return new Response(
      JSON.stringify({ success: true, job: parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to parse job';
    console.error('Parse job error:', message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
