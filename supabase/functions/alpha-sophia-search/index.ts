import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlphaSophiaHCP {
  id: string;
  npi: string;
  name: string;
  taxonomy?: {
    code: string;
    description: string;
  };
  licensure?: string[];
  contact?: {
    email?: string[];
    phone?: string[];
    linkedin?: string;
    doximity?: string;
  };
  location?: {
    city: string;
    state: string;
  };
}

interface SearchParams {
  specialty?: string;
  state?: string;
  city?: string;
  name?: string;
  pageSize?: number;
  page?: number;
  hasEmail?: boolean;
  hasPhone?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ALPHA_SOPHIA_API_KEY = Deno.env.get('ALPHA_SOPHIA_API_KEY');
    
    if (!ALPHA_SOPHIA_API_KEY) {
      throw new Error('Alpha Sophia API key not configured');
    }

    const params: SearchParams = await req.json();
    
    // Build query parameters for Alpha Sophia API
    const queryParams = new URLSearchParams();
    
    // Pagination
    queryParams.set('pageSize', String(params.pageSize || 25));
    queryParams.set('page', String(params.page || 1));
    
    // Name search (with + prefix for inclusion)
    if (params.name) {
      queryParams.set('name', `+"${params.name}"`);
    }
    
    // State filter (with + prefix)
    if (params.state) {
      queryParams.set('state', `+${params.state}`);
    }
    
    // City filter
    if (params.city) {
      queryParams.set('city', `+"${params.city}"`);
    }
    
    // Taxonomy/specialty filter - needs to use classification IDs
    // For now, pass as taxonomy search
    if (params.specialty) {
      queryParams.set('taxonomy', `+"${params.specialty}"`);
    }
    
    // Contact filters
    if (params.hasEmail) {
      queryParams.set('contact', 'email');
    } else if (params.hasPhone) {
      queryParams.set('contact', 'phone');
    }

    console.log('Calling Alpha Sophia API with params:', queryParams.toString());
    
    const apiUrl = `https://api.alphasophia.com/v1/search/hcp?${queryParams.toString()}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': ALPHA_SOPHIA_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Alpha Sophia API error:', response.status, errorText);
      throw new Error(`Alpha Sophia API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Alpha Sophia response:', JSON.stringify(data).substring(0, 500));
    
    // Transform Alpha Sophia data to match our candidate format
    const candidates = (data.data || []).map((hcp: AlphaSophiaHCP) => {
      // Parse name (usually "LAST, FIRST" format)
      const nameParts = (hcp.name || '').split(',').map((s: string) => s.trim());
      const lastName = nameParts[0] || '';
      const firstName = nameParts[1] || '';
      
      return {
        id: `as_${hcp.id}`, // Prefix to identify Alpha Sophia records
        npi: hcp.npi,
        first_name: firstName,
        last_name: lastName,
        email: hcp.contact?.email?.[0] || null,
        phone: hcp.contact?.phone?.[0] || null,
        specialty: hcp.taxonomy?.description || null,
        city: hcp.location?.city || null,
        state: hcp.location?.state || null,
        licenses: hcp.licensure || [],
        enrichment_tier: 'Alpha Sophia', // Mark as external source
        source: 'alpha_sophia',
        linkedin: hcp.contact?.linkedin || null,
        doximity: hcp.contact?.doximity || null,
      };
    });

    return new Response(
      JSON.stringify({
        candidates,
        total: data.total || candidates.length,
        page: params.page || 1,
        pageSize: params.pageSize || 25,
        source: 'alpha_sophia',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to search Alpha Sophia';
    console.error('Error in alpha-sophia-search:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        candidates: [],
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});