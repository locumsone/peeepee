import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchRequest {
  page_id?: string;
  campaign_id?: string;
  search_query?: string; // NEW: Search mode
}

interface NotionSearchResult {
  id: string;
  title: string;
  url: string;
  parent_type?: string;
}

// Search Notion for playbooks
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
    
    // Extract results
    const results: NotionSearchResult[] = [];
    for (const page of data.results || []) {
      // Get title from properties
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

// Notion API to fetch page content
async function fetchNotionPage(pageId: string): Promise<string> {
  const notionApiKey = Deno.env.get("NOTION_API_KEY");
  
  if (!notionApiKey) {
    console.warn("NOTION_API_KEY not set - using fallback method");
    return "";
  }
  
  // Clean the page ID (remove dashes if present)
  const cleanPageId = pageId.replace(/-/g, "");
  
  try {
    // Fetch page blocks from Notion API
    const response = await fetch(
      `https://api.notion.com/v1/blocks/${cleanPageId}/children?page_size=100`,
      {
        headers: {
          "Authorization": `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error("Notion API error:", error);
      throw new Error(`Notion API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract text content from blocks
    let content = "";
    for (const block of data.results || []) {
      content += extractBlockText(block) + "\n";
    }
    
    return content;
  } catch (error) {
    console.error("Failed to fetch from Notion:", error);
    throw error;
  }
}

// Extract text from Notion block
function extractBlockText(block: any): string {
  const type = block.type;
  const blockData = block[type];
  
  if (!blockData) return "";
  
  // Handle rich text content
  if (blockData.rich_text) {
    const text = blockData.rich_text
      .map((t: any) => {
        let content = t.plain_text || "";
        if (t.annotations?.bold) content = `**${content}**`;
        if (t.annotations?.italic) content = `*${content}*`;
        return content;
      })
      .join("");
    
    // Add appropriate prefixes based on block type
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
  
  // Handle dividers
  if (type === "divider") {
    return "---";
  }
  
  return "";
}

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

    const { page_id, campaign_id, search_query }: FetchRequest = await req.json();
    
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
    
    // MODE 2: Fetch specific page
    if (!page_id) {
      throw new Error("Either page_id or search_query is required");
    }
    
    console.log("=== FETCHING NOTION PLAYBOOK ===");
    console.log("Page ID:", page_id);
    console.log("Campaign ID:", campaign_id);
    
    // Try to fetch from Notion API
    let content = await fetchNotionPage(page_id);
    
    if (!content || content.length < 100) {
      // If Notion API fails or no key, check if we have existing cache
      if (campaign_id) {
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("playbook_data")
          .eq("id", campaign_id)
          .maybeSingle();
        
        if (campaign?.playbook_data) {
          const cached = campaign.playbook_data as any;
          if (cached.content && cached.content.length > 500) {
            console.log("Using existing cached content (Notion API unavailable)");
            return new Response(
              JSON.stringify({ 
                content: cached.content,
                from_cache: true,
                message: "Using cached content - Notion API not configured"
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
      
      // Return guidance to use MCP or paste manually
      return new Response(
        JSON.stringify({ 
          error: "Notion API not configured",
          message: "Add NOTION_API_KEY secret or use the agent's Notion MCP to fetch content",
          page_id: page_id,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Fetched content length:", content.length);
    console.log("Content preview:", content.substring(0, 500));
    
    // Validate content has rate information
    const hourlyMatch = content.match(/\$(\d{2,4})(?:\/hour|\/hr|per hour)/i);
    if (hourlyMatch) {
      console.log("✅ Hourly rate found:", hourlyMatch[0]);
    } else {
      console.warn("⚠️ No hourly rate found in fetched content");
    }
    
    return new Response(
      JSON.stringify({ 
        content,
        length: content.length,
        page_id,
        rate_found: !!hourlyMatch,
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
