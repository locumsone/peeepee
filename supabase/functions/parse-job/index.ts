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

// Extract bill rate from text
function extractBillRate(text: string): number {
  // Look for patterns like "$625", "$625/hr", "Bill rate: $625"
  const patterns = [
    /bill\s*rate[:\s]*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /\$(\d{3,4})(?:\s*[-–]\s*\$?\d+)?\s*(?:\/?\s*h(?:ou)?r|hr)/i,
    /(\d{3,4})\s*(?:\/?\s*h(?:ou)?r|hr)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ''));
    }
  }
  return 0;
}

// Extract pay rate from text
function extractPayRate(text: string, billRate: number): number {
  const pattern = /pay\s*rate[:\s]*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i;
  const match = text.match(pattern);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  // Default to 73% of bill rate if not specified
  return Math.round(billRate * 0.73);
}

// Extract state from text
function extractState(text: string): string {
  const statePatterns = [
    /,\s*([A-Z]{2})\s*(?:\d{5}|$)/,
    /,\s*(Texas|California|Florida|New York|Pennsylvania|Illinois|Ohio|Georgia|Michigan|North Carolina|New Jersey|Virginia|Washington|Arizona|Massachusetts|Tennessee|Indiana|Missouri|Maryland|Wisconsin|Colorado|Minnesota|South Carolina|Alabama|Louisiana|Kentucky|Oregon|Oklahoma|Connecticut|Iowa|Utah|Nevada|Arkansas|Mississippi|Kansas|New Mexico|Nebraska|Idaho|West Virginia|Hawaii|New Hampshire|Maine|Montana|Rhode Island|Delaware|South Dakota|North Dakota|Alaska|Vermont|Wyoming)\s*(?:,|\d{5}|$)/i,
  ];
  
  const stateAbbreviations: Record<string, string> = {
    'texas': 'TX', 'california': 'CA', 'florida': 'FL', 'new york': 'NY',
    'pennsylvania': 'PA', 'illinois': 'IL', 'ohio': 'OH', 'georgia': 'GA',
    'michigan': 'MI', 'north carolina': 'NC', 'new jersey': 'NJ', 'virginia': 'VA',
    'washington': 'WA', 'arizona': 'AZ', 'massachusetts': 'MA', 'tennessee': 'TN',
    'indiana': 'IN', 'missouri': 'MO', 'maryland': 'MD', 'wisconsin': 'WI',
    'colorado': 'CO', 'minnesota': 'MN', 'south carolina': 'SC', 'alabama': 'AL',
    'louisiana': 'LA', 'kentucky': 'KY', 'oregon': 'OR', 'oklahoma': 'OK',
    'connecticut': 'CT', 'iowa': 'IA', 'utah': 'UT', 'nevada': 'NV',
    'arkansas': 'AR', 'mississippi': 'MS', 'kansas': 'KS', 'new mexico': 'NM',
    'nebraska': 'NE', 'idaho': 'ID', 'west virginia': 'WV', 'hawaii': 'HI',
    'new hampshire': 'NH', 'maine': 'ME', 'montana': 'MT', 'rhode island': 'RI',
    'delaware': 'DE', 'south dakota': 'SD', 'north dakota': 'ND', 'alaska': 'AK',
    'vermont': 'VT', 'wyoming': 'WY'
  };
  
  for (const pattern of statePatterns) {
    const match = text.match(pattern);
    if (match) {
      const state = match[1];
      if (state.length === 2) {
        return state.toUpperCase();
      }
      return stateAbbreviations[state.toLowerCase()] || state;
    }
  }
  return '';
}

// Extract city from text
function extractCity(text: string): string {
  // Look for common patterns
  const patterns = [
    /(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*,/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*,\s*(?:TX|CA|FL|NY|PA|IL|OH|GA|MI|NC)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return '';
}

// Extract facility name
function extractFacility(text: string): string {
  const patterns = [
    /(?:Facility|Hospital|Center|Clinic)[:\s]+([^\n,]+)/i,
    /(?:at|for)\s+(?:the\s+)?([A-Z][A-Za-z\s]+(?:Hospital|Medical Center|Health|Clinic|Center))/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  // Try to find capitalized hospital names
  const hospitalMatch = text.match(/([A-Z][A-Z\s]+(?:HOSPITAL|MEDICAL CENTER|HEALTH|CLINIC))/i);
  if (hospitalMatch) {
    // Title case it
    return hospitalMatch[1].toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).trim();
  }
  
  return '';
}

// Extract specialty
function extractSpecialty(text: string): string {
  const specialties = [
    'Interventional Radiology', 'Interventional Radiologist',
    'Diagnostic Radiology', 'Diagnostic Radiologist', 
    'Radiology', 'Radiologist',
    'Cardiology', 'Cardiologist',
    'Emergency Medicine', 'ER Physician',
    'Internal Medicine', 'Internist',
    'Family Medicine', 'Family Practice',
    'Anesthesiology', 'Anesthesiologist',
    'Orthopedics', 'Orthopedic Surgery',
    'General Surgery', 'Surgeon',
    'Psychiatry', 'Psychiatrist',
    'Neurology', 'Neurologist',
    'Oncology', 'Oncologist',
    'Hospitalist',
    'Pulmonology', 'Pulmonologist',
    'Gastroenterology', 'GI',
    'Nephrology', 'Nephrologist',
    'Urology', 'Urologist',
    'OB/GYN', 'OBGYN', 'Obstetrics',
    'Pediatrics', 'Pediatrician',
    'Critical Care', 'ICU',
  ];
  
  const lowerText = text.toLowerCase();
  
  // Check for IR specifically
  if (lowerText.includes('interventional rad') || lowerText.includes('ir rad')) {
    return 'Interventional Radiology';
  }
  
  for (const specialty of specialties) {
    if (lowerText.includes(specialty.toLowerCase())) {
      // Normalize to common names
      if (specialty.includes('Radiologist')) return 'Interventional Radiology';
      if (specialty.includes('Cardiologist')) return 'Cardiology';
      return specialty;
    }
  }
  
  // Check specialty/dept field
  const deptMatch = text.match(/Specialty(?:\/Dept\.?)?[:\s]+([^\n]+)/i);
  if (deptMatch) {
    return deptMatch[1].trim();
  }
  
  return '';
}

// Extract dates
function extractDates(text: string): { dates: string; startDate: string | null; endDate: string | null } {
  // Look for start date patterns
  const startPatterns = [
    /(?:start|begin|from)[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:[-–]|to|through)/i,
    /Start[^:]*Date[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ];
  
  let startDate: string | null = null;
  let endDate: string | null = null;
  
  for (const pattern of startPatterns) {
    const match = text.match(pattern);
    if (match) {
      startDate = match[1];
      break;
    }
  }
  
  // Check for "Open" end date
  if (text.toLowerCase().includes('open')) {
    endDate = 'Open';
  }
  
  // Format dates display
  let dates = '';
  if (startDate) {
    dates = startDate;
    if (endDate === 'Open') {
      dates += ' - Ongoing';
    } else if (endDate) {
      dates += ` - ${endDate}`;
    }
  }
  
  return { dates, startDate, endDate };
}

// Extract schedule
function extractSchedule(text: string): string | null {
  const patterns = [
    /Schedule[^:]*Type[:\s]+([^\n]+)/i,
    /(\d+)\s*days?\s*(?:\/|per)\s*w(?:ee)?k/i,
    /(M-F|Mon-Fri|Monday-Friday)\s+(\d+[ap]m?\s*[-–]\s*\d+[ap]m?)/i,
    /(\d+[ap]m?\s*[-–]\s*\d+[ap]m?)\s*(?:CST|EST|PST|MST)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  // Look for days per week
  if (text.includes('5 days') || text.includes('5days')) {
    return '5 days/week';
  }
  
  return null;
}

// Check for on-call
function extractOnCall(text: string): { onCall: boolean; details: string | null } {
  const lowerText = text.toLowerCase();
  const hasOnCall = lowerText.includes('on call') || lowerText.includes('on-call') || lowerText.includes('oncall') || 
                    (text.match(/OnCall[:\s]*Yes/i) !== null);
  
  if (!hasOnCall) {
    return { onCall: false, details: null };
  }
  
  // Extract on-call details
  const detailsMatch = text.match(/call[:\s]*(\d+\s*week[s]?\s*in\s*\d+\s*week[s]?)/i);
  if (detailsMatch) {
    return { onCall: true, details: detailsMatch[1] };
  }
  
  return { onCall: true, details: null };
}

// Extract requirements
function extractRequirements(text: string): string | null {
  const requirements: string[] = [];
  
  // License requirements
  if (text.match(/TX\s*license/i)) requirements.push('TX License');
  if (text.match(/IMLC/i)) requirements.push('IMLC accepted');
  if (text.match(/BC\/?BE/i)) requirements.push('BC/BE');
  if (text.match(/board\s*certified/i)) requirements.push('Board Certified');
  
  // Credential time
  const credMatch = text.match(/(\d+)\s*days?\s*to\s*credential/i);
  if (credMatch) {
    requirements.push(`${credMatch[1]} days to credential`);
  }
  
  return requirements.length > 0 ? requirements.join(', ') : null;
}

// Generate job title
function generateJobTitle(specialty: string, facility: string, city: string, state: string): string {
  const parts = [];
  if (specialty) parts.push(specialty);
  if (city && state) {
    parts.push(`- ${city}, ${state}`);
  } else if (facility) {
    parts.push(`at ${facility}`);
  }
  return parts.join(' ') || 'New Position';
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

    console.log('Parsing job text:', jobText.substring(0, 200));

    const billRate = extractBillRate(jobText);
    const payRate = extractPayRate(jobText, billRate);
    const state = extractState(jobText);
    const city = extractCity(jobText);
    const facility = extractFacility(jobText);
    const specialty = extractSpecialty(jobText);
    const { dates, startDate, endDate } = extractDates(jobText);
    const schedule = extractSchedule(jobText);
    const { onCall, details: onCallDetails } = extractOnCall(jobText);
    const requirements = extractRequirements(jobText);
    
    const location = city && state ? `${city}, ${state}` : state || city || '';
    const jobTitle = generateJobTitle(specialty, facility, city, state);

    const parsed: ParsedJob = {
      specialty,
      location,
      city,
      state,
      facility,
      dates,
      startDate,
      endDate: endDate === 'Open' ? null : endDate,
      billRate,
      payRate,
      schedule,
      requirements,
      description: jobText.substring(0, 2000), // Store first 2000 chars as description
      jobTitle,
      onCall,
      onCallDetails,
    };

    console.log('Parsed job:', JSON.stringify(parsed));

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
