export interface Job {
  id: string;
  job_name?: string;
  specialty?: string;
  facility_name?: string;
  city?: string;
  state?: string;
  bill_rate?: number | null;
  hourly_rate?: number | null;
  pay_rate?: number | null;
  start_date?: string | null;
}

export interface ChannelConfig {
  email?: {
    sender: string;
    sequenceLength: number;
    gapDays: number;
  } | null;
  sms?: {
    fromNumber: string;
    sequenceLength: number;
  } | null;
  aiCall?: {
    fromNumber: string;
    callDay: number;
    transferTo: string;
  } | null;
  linkedin?: boolean;
  schedule?: {
    startDate: string;
    sendWindowStart: string;
    sendWindowEnd: string;
    timezone: string;
    weekdaysOnly: boolean;
  };
}

export interface SelectedCandidate {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  personal_email?: string;
  personal_mobile?: string;
  specialty?: string;
  city?: string;
  state?: string;
  tier?: number;
  unified_score?: string;
  icebreaker?: string;
  talking_points?: string[];
  email_subject?: string;
  email_body?: string;
  sms_message?: string;
  enrichment_source?: string;
  enriched_at?: string;
  enrichment_tier?: string;
}

export interface PersonalizationHook {
  candidate_id: string;
  candidate_name: string;
  icebreaker: string;
  talking_points: string[];
  confidence: string;
  isEditing?: boolean;
  editedIcebreaker?: string;
}

export interface QualityIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  candidate_name?: string;
  description: string;
  suggestion?: string;
}

export interface QualityCheckResult {
  can_launch: boolean;
  issues: QualityIssue[];
  summary: {
    critical: number;
    warnings: number;
    info: number;
  };
}

export interface IntegrationStatus {
  name: string;
  type?: 'email' | 'sms' | 'voice' | 'linkedin';
  status?: 'connected' | 'disconnected' | 'checking' | 'manual';
  connected?: boolean;
  details?: string;
  account?: string;
  error?: string;
}

export interface TierStats {
  tier1: number;
  tier2: number;
  tier3: number;
  readyCount: number;
  needsEnrichment: number;
}
