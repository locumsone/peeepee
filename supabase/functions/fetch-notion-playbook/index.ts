import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchRequest {
  page_id?: string;
  campaign_id?: string;
  search_query?: string;
  raw_content?: string; // For MCP-fetched content to be parsed
}

interface NotionSearchResult {
  id: string;
  title: string;
  url: string;
  parent_type?: string;
}

// ============================================
// STRUCTURED PLAYBOOK CACHE INTERFACE
// Target: ~4,200 characters total (under 5K limit)
// ============================================

interface StructuredPlaybookCache {
  // Metadata (~200 chars)
  notion_id: string;
  notion_url?: string;
  title: string;
  synced_at: string;
  content_length: number; // Original playbook size for reference
  
  // Section 1: Structured Data (~1,500 chars)
  compensation: {
    hourly: string | null;       // "$500"
    daily: string | null;        // "$4,500"
    weekly: string | null;       // "$22,500"
    annual: string | null;       // "$1,170,000"
    salary_range: string | null; // "$110K-$160K" for perm roles
  };
  
  position: {
    title: string | null;
    facility_name: string | null;
    facility_type: string | null;     // trauma, non-trauma, academic, community, ASC
    location_city: string | null;
    location_state: string | null;
    location_metro: string | null;    // "Los Angeles County"
    contract_type: string | null;     // locums, perm, travel, PRN
  };
  
  clinical: {
    procedures: string | null;        // comma-separated, max 500 chars
    case_types: string | null;        // inpatient, outpatient, stat, routine
    case_mix: string | null;          // "Non-trauma, routine IR"
    volume: string | null;            // "50 RVUs/shift" or "20 patients/day"
    call_status: string | null;       // "Zero call" or "1:5 call"
    schedule_days: string | null;     // "Monday-Friday"
    schedule_hours: string | null;    // "8am-5pm PST"
    duration: string | null;          // "Long-term" or "13 weeks"
    tech_stack: string | null;        // "RPCE, PowerScribe"
  };
  
  credentialing: {
    required_license: string | null;      // "California"
    days_to_credential: number | null;    // 40
    temps_available: boolean | null;
    requirements: string | null;          // "Board Certified, DEA, BLS"
  };
  
  // Section 2: Positioning Content (~2,500 chars)
  positioning: {
    selling_points: string | null;        // max 800 chars
    pain_points_solved: string | null;    // max 500 chars
    ideal_candidate: string | null;       // max 500 chars
    differentiators: string | null;       // max 400 chars
    messaging_tone: string | null;        // max 300 chars
    objection_responses: string | null;   // max 500 chars
    facility_context: string | null;      // max 500 chars
  };
}

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

function extractCompensation(content: string): StructuredPlaybookCache['compensation'] {
  // Hourly rate patterns
  const hourlyPatterns = [
    /\$(\d{2,4})(?:\.00)?(?:\s*)?(?:\/\s*hour|\/hour|\/hr|per hour)/i,
    /Hourly Rate:\*?\*?\s*\$(\d{2,4})/i,
    /Pay Rate:\*?\*?\s*\$(\d{2,4})/i,
    /Rate:\*?\*?\s*\$(\d{2,4})\/hr/i,
  ];
  
  // Daily rate patterns
  const dailyPatterns = [
    /Daily (?:Rate|Earnings|Potential):\*?\*?\s*\$([\d,]+)/i,
    /\$([\d,]+)(?:\s*)?(?:\/\s*day|\/day|per day)/i,
    /\$([\d,]+)\s*daily/i,
  ];
  
  // Weekly rate patterns
  const weeklyPatterns = [
    /Weekly (?:Rate|Earnings|Potential):\*?\*?\s*\$([\d,]+)/i,
    /\$([\d,]+)(?:\s*)?(?:\/\s*week|\/week|per week)/i,
    /\$([\d,]+)\s*weekly/i,
  ];
  
  // Annual rate patterns
  const annualPatterns = [
    /Annual (?:Potential|Earnings|Salary):\*?\*?\s*\$([\d,]+)/i,
    /\$([\d,]+(?:,\d{3})*)\s*(?:annual|annually|per year)/i,
    /\$([\d.]+)M\s*(?:annual|potential)/i,
  ];
  
  // Salary range (for perm/non-hourly roles)
  const salaryPatterns = [
    /Salary(?:\s*Range)?:\*?\*?\s*\$([\d,]+K?\s*-\s*\$?[\d,]+K?)/i,
    /\$([\d,]+K)\s*-\s*\$([\d,]+K)/i,
    /Base(?:\s*Salary)?:\*?\*?\s*\$([\d,]+)/i,
  ];
  
  const findMatch = (patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) return match[1].replace(/,/g, '');
    }
    return null;
  };
  
  let hourly = findMatch(hourlyPatterns);
  let annual = findMatch(annualPatterns);
  
  // Handle $1.17M format
  if (!annual) {
    const millionMatch = content.match(/\$([\d.]+)M/i);
    if (millionMatch) {
      const millions = parseFloat(millionMatch[1]);
      annual = (millions * 1000000).toLocaleString();
    }
  }
  
  // Salary range extraction
  let salaryRange: string | null = null;
  const salaryMatch = content.match(/\$?([\d,]+K?\s*-\s*\$?[\d,]+K)/i);
  if (salaryMatch) {
    salaryRange = salaryMatch[1];
  }
  
  return {
    hourly: hourly ? `$${hourly}` : null,
    daily: findMatch(dailyPatterns) ? `$${findMatch(dailyPatterns)}` : null,
    weekly: findMatch(weeklyPatterns) ? `$${findMatch(weeklyPatterns)}` : null,
    annual: annual ? `$${annual}` : null,
    salary_range: salaryRange,
  };
}

function extractPosition(content: string): StructuredPlaybookCache['position'] {
  // Title
  const titlePatterns = [
    /(?:Position|Title|Role):\*?\*?\s*([^\n]+)/i,
    /^#\s*([^\n]+)/m,
  ];
  
  // Facility
  const facilityPatterns = [
    /(?:Facility|Hospital|Site|Client)(?:\s*Name)?:\*?\*?\s*([^\n]+)/i,
  ];
  
  // Facility type - PRIORITY ORDER MATTERS
  // Non-trauma and community should be checked FIRST because playbooks often mention 
  // "NOT Level I trauma" or compare to trauma centers - we want to capture the actual facility type
  const facilityTypePatterns = [
    // Explicit non-trauma statements (highest priority)
    /(Non-?trauma(?:\s+(?:community\s+)?hospital)?)/i,
    /(Community(?:\s+hospital)?)/i,
    // Then check for specific trauma levels only if explicitly stated AS the facility
    /(?:This is a|Facility is a?|Hospital is a?)\s*(Level\s*[IV]+\s*Trauma)/i,
    /Trauma Level:\s*(Level\s*[IV]+)/i,
    // Other facility types
    /(ASC|Ambulatory\s*Surgery\s*Center)/i,
    /(Academic(?:\s+Medical\s+Center)?)/i,
    /(Teaching(?:\s+Hospital)?)/i,
    /(Critical\s+Access)/i,
  ];
  
  // Location
  const locationPatterns = [
    /(?:Location|City):\*?\*?\s*([^,\n]+),?\s*([A-Z]{2})?/i,
    /([A-Za-z\s]+),\s*([A-Z]{2})\s*(?:\d{5})?/,
  ];
  
  // Metro area
  const metroPatterns = [
    /(?:Metro|Area|Region):\*?\*?\s*([^\n]+)/i,
    /(\w+\s*County)/i,
  ];
  
  // Contract type
  const contractPatterns = [
    /(Locums|Locum Tenens)/i,
    /(Permanent|Perm)/i,
    /(Travel)/i,
    /(PRN|Per Diem)/i,
    /(Contract)/i,
  ];
  
  const findFirst = (patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) return match[1]?.trim() || null;
    }
    return null;
  };
  
  // Parse location
  let city: string | null = null;
  let state: string | null = null;
  for (const pattern of locationPatterns) {
    const match = content.match(pattern);
    if (match) {
      city = match[1]?.trim() || null;
      state = match[2]?.trim() || null;
      break;
    }
  }
  
  return {
    title: findFirst(titlePatterns),
    facility_name: findFirst(facilityPatterns),
    facility_type: findFirst(facilityTypePatterns),
    location_city: city,
    location_state: state,
    location_metro: findFirst(metroPatterns),
    contract_type: findFirst(contractPatterns),
  };
}

function extractClinical(content: string): StructuredPlaybookCache['clinical'] {
  // Procedures
  const proceduresPatterns = [
    /(?:Procedures?|Scope|Services):\*?\*?\s*([^\n]+(?:\n(?![\*#]).*)*)/i,
    /(?:Case Types?):\*?\*?\s*([^\n]+)/i,
  ];
  
  // Call status - prioritize explicit statements
  const callPatterns = [
    /(Zero call|NO CALL|no on-?call)/i,
    /On-?Call:\*?\*?\s*(NO|None|Zero|YES|[\d:]+)/i,
    /Call(?:\s*Status)?:\*?\*?\s*([^\n]+)/i,
    /(1:\d+\s*call)/i,
  ];
  
  // Volume
  const volumePatterns = [
    /(\d+\s*RVU[s]?(?:\s*\/\s*(?:shift|day|month))?)/i,
    /(\d+\s*(?:patients?|cases?)(?:\s*\/\s*(?:shift|day))?)/i,
    /Volume:\*?\*?\s*([^\n]+)/i,
  ];
  
  // Schedule
  const schedulePatterns = [
    /Schedule:\*?\*?\s*([^\n]+)/i,
    /(Monday\s*-?\s*Friday|M-F|Mon-Fri)/i,
    /(\d+:\d+\s*(?:AM|PM)\s*-\s*\d+:\d+\s*(?:AM|PM))/i,
  ];
  
  // Duration
  const durationPatterns = [
    /Duration:\*?\*?\s*([^\n]+)/i,
    /(Long[- ]?term|Short[- ]?term)/i,
    /(\d+\s*weeks?)/i,
    /(\d+\s*months?)/i,
    /(Ongoing)/i,
  ];
  
  // Tech/EMR
  const techPatterns = [
    /(?:EMR|Tech|System):\*?\*?\s*([^\n]+)/i,
    /(Epic|Cerner|RPCE|PowerScribe)/gi,
  ];
  
  const findFirst = (patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) return match[1]?.trim()?.substring(0, 200) || null;
    }
    return null;
  };
  
  // Combine tech matches
  const techMatches = content.match(/(Epic|Cerner|RPCE|PowerScribe|Meditech|Athena)/gi);
  const tech = techMatches ? [...new Set(techMatches)].join(', ') : findFirst(techPatterns);
  
  // Case mix
  const caseMixPatterns = [
    /Case Mix:\*?\*?\s*([^\n]+)/i,
    /(Non-?trauma[,\s]+routine)/i,
    /(Mix of inpatient and outpatient)/i,
  ];
  
  return {
    procedures: findFirst(proceduresPatterns)?.substring(0, 500) || null,
    case_types: findFirst([/Case Types?:\*?\*?\s*([^\n]+)/i]),
    case_mix: findFirst(caseMixPatterns),
    volume: findFirst(volumePatterns),
    call_status: findFirst(callPatterns),
    schedule_days: findFirst([/(Monday\s*-?\s*Friday|M-F|Mon-Fri|7\s*on\s*7\s*off)/i]),
    schedule_hours: findFirst([/(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\s*-\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/i]),
    duration: findFirst(durationPatterns),
    tech_stack: tech?.substring(0, 200) || null,
  };
}

function extractCredentialing(content: string): StructuredPlaybookCache['credentialing'] {
  // License requirements
  const licensePatterns = [
    /(?:Required\s*)?License:\*?\*?\s*([A-Z]{2}|[A-Za-z]+\s*(?:license)?)/i,
    /([A-Z]{2})\s*license\s*(?:required|needed)/i,
    /Must have\s*([A-Z]{2})\s*license/i,
  ];
  
  // Credentialing time
  const credDaysPatterns = [
    /(\d+)\s*(?:-?\s*\d+)?\s*days?\s*(?:to\s*)?credential/i,
    /Credential(?:ing)?(?:\s*Time)?:\*?\*?\s*(\d+)/i,
    /(\d+)\s*day\s*credential/i,
  ];
  
  // Temps
  const tempsPatterns = [
    /Temps?:\*?\*?\s*(Available|YES|NO)/i,
    /(Temp privileges available)/i,
    /(No temps?)/i,
  ];
  
  // Requirements
  const reqPatterns = [
    /Requirements?:\*?\*?\s*([^\n]+)/i,
    /(?:Must have|Required):\*?\*?\s*([^\n]+)/i,
  ];
  
  const findFirst = (patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) return match[1]?.trim() || null;
    }
    return null;
  };
  
  // Credential days
  let credDays: number | null = null;
  const daysMatch = content.match(/(\d+)\s*(?:-?\s*\d+)?\s*days?\s*(?:to\s*)?credential/i);
  if (daysMatch) {
    credDays = parseInt(daysMatch[1], 10);
  }
  
  // Temps available
  let temps: boolean | null = null;
  if (/temps?\s*(?:are\s*)?available/i.test(content)) temps = true;
  if (/no\s*temps?/i.test(content)) temps = false;
  
  return {
    required_license: findFirst(licensePatterns),
    days_to_credential: credDays,
    temps_available: temps,
    requirements: findFirst(reqPatterns)?.substring(0, 300) || null,
  };
}

function extractPositioning(content: string): StructuredPlaybookCache['positioning'] {
  // Section header patterns for each positioning field
  const sectionPatterns: Record<string, RegExp[]> = {
    selling_points: [
      /##\s*Selling Points?\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Key Advantages?\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Why This Role\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Value Proposition\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*What Makes This Attractive\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /\*\*Selling Points?\*\*:?\s*([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    ],
    pain_points_solved: [
      /##\s*Pain Points?\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Problems? Solved\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Candidate Motivations?\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /\*\*Pain Points?\*\*:?\s*([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    ],
    ideal_candidate: [
      /##\s*Ideal Candidate\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Who Fits?\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Target Profile\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Best Fit\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /\*\*Ideal Candidate\*\*:?\s*([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    ],
    differentiators: [
      /##\s*Differentiators?\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Competitive Advantage\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*What'?s Unique\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Stand Out\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /\*\*Differentiators?\*\*:?\s*([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    ],
    messaging_tone: [
      /##\s*Messaging Approach\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Tone\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*How to Position\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Outreach Strategy\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /\*\*Messaging Tone\*\*:?\s*([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    ],
    objection_responses: [
      /##\s*Objections?\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Common Concerns?\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*FAQ\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Pushback\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /\*\*Objections?\*\*:?\s*([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    ],
    facility_context: [
      /##\s*Facility Overview\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*About the Facility\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Culture\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /##\s*Work Environment\s*\n([\s\S]*?)(?=\n##|\n#|$)/i,
      /\*\*Facility\*\*:?\s*([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    ],
  };
  
  const maxLengths: Record<string, number> = {
    selling_points: 800,
    pain_points_solved: 500,
    ideal_candidate: 500,
    differentiators: 400,
    messaging_tone: 300,
    objection_responses: 500,
    facility_context: 500,
  };
  
  const result: StructuredPlaybookCache['positioning'] = {
    selling_points: null,
    pain_points_solved: null,
    ideal_candidate: null,
    differentiators: null,
    messaging_tone: null,
    objection_responses: null,
    facility_context: null,
  };
  
  for (const [field, patterns] of Object.entries(sectionPatterns)) {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]?.trim()) {
        const extracted = match[1].trim().substring(0, maxLengths[field]);
        (result as any)[field] = extracted;
        break;
      }
    }
  }
  
  return result;
}

// Main parsing function
function parsePlaybookContent(content: string, notionId: string, title: string): StructuredPlaybookCache {
  console.log("=== PARSING PLAYBOOK CONTENT ===");
  console.log("Content length:", content.length);
  
  const cache: StructuredPlaybookCache = {
    notion_id: notionId,
    notion_url: `https://notion.so/${notionId.replace(/-/g, '')}`,
    title,
    synced_at: new Date().toISOString(),
    content_length: content.length,
    compensation: extractCompensation(content),
    position: extractPosition(content),
    clinical: extractClinical(content),
    credentialing: extractCredentialing(content),
    positioning: extractPositioning(content),
  };
  
  // Log what was extracted
  console.log("Extracted compensation:", cache.compensation);
  console.log("Extracted clinical:", cache.clinical);
  console.log("Extracted positioning:", {
    selling_points: cache.positioning.selling_points?.substring(0, 50) + "...",
    differentiators: cache.positioning.differentiators?.substring(0, 50) + "...",
    messaging_tone: cache.positioning.messaging_tone?.substring(0, 50) + "...",
  });
  
  // Calculate approximate cache size
  const cacheSize = JSON.stringify(cache).length;
  console.log("Cache size:", cacheSize, "characters (limit: 5000)");
  
  if (cacheSize > 5000) {
    console.warn("Cache exceeds 5K limit, trimming positioning content...");
    // Trim positioning content if needed
    if (cache.positioning.selling_points && cache.positioning.selling_points.length > 500) {
      cache.positioning.selling_points = cache.positioning.selling_points.substring(0, 500);
    }
    if (cache.positioning.objection_responses && cache.positioning.objection_responses.length > 300) {
      cache.positioning.objection_responses = cache.positioning.objection_responses.substring(0, 300);
    }
  }
  
  return cache;
}

// ============================================
// NOTION API FUNCTIONS
// ============================================

async function searchNotionPlaybooks(query: string): Promise<NotionSearchResult[]> {
  const notionApiKey = Deno.env.get("NOTION_API_KEY");
  
  if (!notionApiKey) {
    throw new Error("NOTION_API_KEY not configured");
  }
  
  try {
    const response = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${notionApiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query,
        filter: { property: "object", value: "page" },
        page_size: 10,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("Notion search error:", error);
      throw new Error(`Notion search failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    const results: NotionSearchResult[] = [];
    for (const page of data.results || []) {
      let title = "Untitled";
      const titleProp = page.properties?.title || page.properties?.Name;
      if (titleProp?.title?.[0]?.plain_text) {
        title = titleProp.title[0].plain_text;
      }
      
      results.push({
        id: page.id,
        title: title,
        url: page.url || `https://notion.so/${page.id.replace(/-/g, '')}`,
        parent_type: page.parent?.type,
      });
    }
    
    console.log(`Found ${results.length} playbooks for query "${query}"`);
    return results;
  } catch (error) {
    console.error("Notion search failed:", error);
    throw error;
  }
}

async function fetchAllBlocks(blockId: string, notionApiKey: string): Promise<any[]> {
  const allBlocks: any[] = [];
  let cursor: string | undefined = undefined;
  let hasMore = true;
  
  while (hasMore) {
    const requestUrl: string = cursor 
      ? `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100&start_cursor=${cursor}`
      : `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`;
    
    const res: Response = await fetch(requestUrl, {
      headers: {
        "Authorization": `Bearer ${notionApiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Notion API error:", errorText);
      throw new Error(`Notion API error: ${res.status}`);
    }
    
    const json: { results?: any[]; has_more?: boolean; next_cursor?: string | null } = await res.json();
    allBlocks.push(...(json.results || []));
    
    hasMore = json.has_more === true;
    cursor = json.next_cursor || undefined;
    
    console.log(`Fetched ${json.results?.length || 0} blocks, has_more: ${hasMore}`);
  }
  
  return allBlocks;
}

function extractBlockText(block: any): string {
  const type = block.type;
  const blockData = block[type];
  
  if (!blockData) return "";
  
  if (blockData.rich_text) {
    const text = blockData.rich_text
      .map((t: any) => {
        let content = t.plain_text || "";
        if (t.annotations?.bold) content = `**${content}**`;
        if (t.annotations?.italic) content = `*${content}*`;
        return content;
      })
      .join("");
    
    switch (type) {
      case "heading_1":
        return `# ${text}`;
      case "heading_2":
        return `## ${text}`;
      case "heading_3":
        return `### ${text}`;
      case "bulleted_list_item":
        return `- ${text}`;
      case "numbered_list_item":
        return `1. ${text}`;
      case "paragraph":
      default:
        return text;
    }
  }
  
  if (type === "divider") {
    return "---";
  }
  
  return "";
}

async function fetchNotionPage(pageId: string): Promise<string> {
  const notionApiKey = Deno.env.get("NOTION_API_KEY");
  
  if (!notionApiKey) {
    console.warn("NOTION_API_KEY not set");
    return "";
  }
  
  const cleanPageId = pageId.replace(/-/g, "");
  
  try {
    const allBlocks = await fetchAllBlocks(cleanPageId, notionApiKey);
    console.log(`Total blocks fetched: ${allBlocks.length}`);
    
    let content = "";
    for (const block of allBlocks) {
      content += extractBlockText(block) + "\n";
      
      if (block.has_children) {
        try {
          const childBlocks = await fetchAllBlocks(block.id, notionApiKey);
          for (const childBlock of childBlocks) {
            content += "  " + extractBlockText(childBlock) + "\n";
          }
        } catch (e) {
          console.warn(`Failed to fetch children for block ${block.id}:`, e);
        }
      }
    }
    
    return content;
  } catch (error) {
    console.error("Failed to fetch from Notion:", error);
    throw error;
  }
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
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

    const { page_id, campaign_id, search_query, raw_content }: FetchRequest = await req.json();
    
    // MODE 1: Search for playbooks
    if (search_query) {
      console.log("=== SEARCHING NOTION PLAYBOOKS ===");
      console.log("Query:", search_query);
      
      const results = await searchNotionPlaybooks(search_query);
      
      return new Response(
        JSON.stringify({ 
          results,
          query: search_query,
          count: results.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // MODE 2: Parse raw content (from MCP fetch)
    if (raw_content && page_id) {
      console.log("=== PARSING MCP-FETCHED CONTENT ===");
      console.log("Content length:", raw_content.length);
      
      // Extract title from content or use default
      const titleMatch = raw_content.match(/^#\s*(.+)$/m);
      const title = titleMatch?.[1] || "Recruitment Playbook";
      
      const structuredCache = parsePlaybookContent(raw_content, page_id, title);
      
      // Save to campaign if provided
      if (campaign_id) {
        const { error } = await supabase
          .from("campaigns")
          .update({
            playbook_data: JSON.parse(JSON.stringify(structuredCache)),
            playbook_notion_id: page_id,
            playbook_synced_at: new Date().toISOString(),
          })
          .eq("id", campaign_id);
        
        if (error) {
          console.error("Failed to save to campaign:", error);
        } else {
          console.log("Structured cache saved to campaign:", campaign_id);
        }
      }
      
      return new Response(
        JSON.stringify({ 
          structured_cache: structuredCache,
          raw_length: raw_content.length,
          cache_size: JSON.stringify(structuredCache).length,
          saved_to_campaign: !!campaign_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // MODE 3: Fetch specific page and parse
    if (!page_id) {
      throw new Error("Either page_id, search_query, or raw_content is required");
    }
    
    console.log("=== FETCHING AND PARSING NOTION PLAYBOOK ===");
    console.log("Page ID:", page_id);
    console.log("Campaign ID:", campaign_id);
    
    // Try to fetch from Notion API
    let content = await fetchNotionPage(page_id);
    
    if (!content || content.length < 100) {
      // If Notion API fails, check for existing cache
      if (campaign_id) {
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("playbook_data")
          .eq("id", campaign_id)
          .maybeSingle();
        
        if (campaign?.playbook_data) {
          console.log("Returning existing structured cache");
          return new Response(
            JSON.stringify({ 
              structured_cache: campaign.playbook_data,
              from_cache: true,
              message: "Using cached structured data"
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Notion API not configured or page not accessible",
          message: "Use MCP to fetch content, then call with raw_content parameter",
          page_id: page_id,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Fetched content length:", content.length);
    
    // Extract title from content
    const titleMatch = content.match(/^#\s*(.+)$/m);
    const title = titleMatch?.[1] || "Recruitment Playbook";
    
    // Parse into structured cache
    const structuredCache = parsePlaybookContent(content, page_id, title);
    
    // Save to campaign if provided
    if (campaign_id) {
      const { error } = await supabase
        .from("campaigns")
        .update({
          playbook_data: JSON.parse(JSON.stringify(structuredCache)),
          playbook_notion_id: page_id,
          playbook_synced_at: new Date().toISOString(),
        })
        .eq("id", campaign_id);
      
      if (error) {
        console.error("Failed to save to campaign:", error);
      } else {
        console.log("Structured cache saved to campaign");
      }
    }
    
    // Validate compensation exists
    const hasCompensation = structuredCache.compensation.hourly || structuredCache.compensation.salary_range;
    const hasPositioning = structuredCache.positioning.selling_points || structuredCache.positioning.differentiators;
    
    return new Response(
      JSON.stringify({ 
        structured_cache: structuredCache,
        raw_length: content.length,
        cache_size: JSON.stringify(structuredCache).length,
        validation: {
          has_compensation: hasCompensation,
          has_positioning: hasPositioning,
          ready_for_generation: hasCompensation,
        },
        saved_to_campaign: !!campaign_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Fetch playbook error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
