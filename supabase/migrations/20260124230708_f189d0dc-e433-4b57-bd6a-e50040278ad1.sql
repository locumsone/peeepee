-- Add playbook cache to campaigns
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS playbook_data jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS playbook_notion_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS playbook_synced_at timestamp with time zone DEFAULT NULL;

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_playbook_notion_id ON public.campaigns(playbook_notion_id);

-- Comment for documentation
COMMENT ON COLUMN public.campaigns.playbook_data IS 'Cached playbook content and extracted rates from Notion';
COMMENT ON COLUMN public.campaigns.playbook_notion_id IS 'Notion page ID for sync';
COMMENT ON COLUMN public.campaigns.playbook_synced_at IS 'Last sync timestamp';