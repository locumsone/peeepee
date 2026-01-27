import type { HealthStatus } from "./CampaignHealthIndicator";

export interface CampaignWithJob {
  id: string;
  name: string | null;
  job_id: string | null;
  channel: string | null;
  status: string | null;
  leads_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  external_id: string | null;
  // Email metrics
  emails_sent: number | null;
  emails_opened: number | null;
  emails_clicked: number | null;
  emails_replied: number | null;
  emails_bounced: number | null;
  // SMS metrics
  sms_sent: number | null;
  sms_delivered: number | null;
  sms_replied: number | null;
  // Call metrics
  calls_attempted: number | null;
  calls_connected: number | null;
  // Job context
  jobs: {
    job_name: string | null;
    specialty: string | null;
    facility_name: string | null;
    city: string | null;
    state: string | null;
    pay_rate: number | null;
  } | null;
}

export interface CampaignStats {
  activeCount: number;
  pausedCount: number;
  completedCount: number;
  draftCount: number;
  totalLeads: number;
  avgOpenRate: number;
  avgReplyRate: number;
  hotLeadsCount: number;
}
