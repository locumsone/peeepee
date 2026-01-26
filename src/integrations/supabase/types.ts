export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          badge_id: string | null
          badge_name: string | null
          earned_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          badge_id?: string | null
          badge_name?: string | null
          earned_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          badge_id?: string | null
          badge_name?: string | null
          earned_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "achievements_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      active_multipliers: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          multiplier: number
          source: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          multiplier: number
          source?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          multiplier?: number
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "active_multipliers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_feed: {
        Row: {
          activity_type: string
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_highlight: boolean | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_highlight?: boolean | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_highlight?: boolean | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action_type: string
          campaign_id: string | null
          channel: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          external_id: string | null
          id: string
          job_id: string | null
          metadata: Json | null
          physician_id: string | null
          session_id: string | null
          source: string | null
          timestamp: string | null
          user_name: string
        }
        Insert: {
          action_type: string
          campaign_id?: string | null
          channel?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          external_id?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          physician_id?: string | null
          session_id?: string | null
          source?: string | null
          timestamp?: string | null
          user_name: string
        }
        Update: {
          action_type?: string
          campaign_id?: string | null
          channel?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          external_id?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          physician_id?: string | null
          session_id?: string | null
          source?: string | null
          timestamp?: string | null
          user_name?: string
        }
        Relationships: []
      }
      agent_prompts: {
        Row: {
          active: boolean | null
          agent_character: string | null
          agent_key: string
          agent_name: string
          created_at: string | null
          created_by: string | null
          id: string
          last_used_at: string | null
          prompt_text: string
          updated_at: string | null
          usage_count: number | null
          version: number | null
        }
        Insert: {
          active?: boolean | null
          agent_character?: string | null
          agent_key: string
          agent_name: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          prompt_text: string
          updated_at?: string | null
          usage_count?: number | null
          version?: number | null
        }
        Update: {
          active?: boolean | null
          agent_character?: string | null
          agent_key?: string
          agent_name?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          prompt_text?: string
          updated_at?: string | null
          usage_count?: number | null
          version?: number | null
        }
        Relationships: []
      }
      ai_call_events: {
        Row: {
          call_id: string
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          queue_id: string | null
        }
        Insert: {
          call_id: string
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          queue_id?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          queue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_events_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "ai_call_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_logs: {
        Row: {
          ai_analysis: Json | null
          call_result: string | null
          call_summary: string | null
          call_type: string | null
          callback_notes: string | null
          callback_reason: string | null
          callback_requested_time: string | null
          callback_status: string | null
          callbacks_attempted: number | null
          candidate_id: string | null
          candidate_name: string | null
          created_at: string | null
          disconnect_reason: string | null
          duration_seconds: number | null
          email_requested: string | null
          ended_at: string | null
          error_message: string | null
          from_number: string | null
          human_detected: boolean | null
          id: string
          job_id: string | null
          last_callback_attempt: string | null
          metadata: Json | null
          objection_notes: string | null
          objection_reason: string | null
          phone_number: string
          platform: string | null
          recording_url: string | null
          recruiter_id: string | null
          recruiter_name: string | null
          retell_call_id: string | null
          sentiment: string | null
          started_at: string | null
          status: string | null
          transcript_object_id: string | null
          transcript_text: string | null
          transferred_at: string | null
          transferred_to_recruiter: boolean | null
          updated_at: string | null
          voicemail_left: boolean | null
        }
        Insert: {
          ai_analysis?: Json | null
          call_result?: string | null
          call_summary?: string | null
          call_type?: string | null
          callback_notes?: string | null
          callback_reason?: string | null
          callback_requested_time?: string | null
          callback_status?: string | null
          callbacks_attempted?: number | null
          candidate_id?: string | null
          candidate_name?: string | null
          created_at?: string | null
          disconnect_reason?: string | null
          duration_seconds?: number | null
          email_requested?: string | null
          ended_at?: string | null
          error_message?: string | null
          from_number?: string | null
          human_detected?: boolean | null
          id?: string
          job_id?: string | null
          last_callback_attempt?: string | null
          metadata?: Json | null
          objection_notes?: string | null
          objection_reason?: string | null
          phone_number: string
          platform?: string | null
          recording_url?: string | null
          recruiter_id?: string | null
          recruiter_name?: string | null
          retell_call_id?: string | null
          sentiment?: string | null
          started_at?: string | null
          status?: string | null
          transcript_object_id?: string | null
          transcript_text?: string | null
          transferred_at?: string | null
          transferred_to_recruiter?: boolean | null
          updated_at?: string | null
          voicemail_left?: boolean | null
        }
        Update: {
          ai_analysis?: Json | null
          call_result?: string | null
          call_summary?: string | null
          call_type?: string | null
          callback_notes?: string | null
          callback_reason?: string | null
          callback_requested_time?: string | null
          callback_status?: string | null
          callbacks_attempted?: number | null
          candidate_id?: string | null
          candidate_name?: string | null
          created_at?: string | null
          disconnect_reason?: string | null
          duration_seconds?: number | null
          email_requested?: string | null
          ended_at?: string | null
          error_message?: string | null
          from_number?: string | null
          human_detected?: boolean | null
          id?: string
          job_id?: string | null
          last_callback_attempt?: string | null
          metadata?: Json | null
          objection_notes?: string | null
          objection_reason?: string | null
          phone_number?: string
          platform?: string | null
          recording_url?: string | null
          recruiter_id?: string | null
          recruiter_name?: string | null
          retell_call_id?: string | null
          sentiment?: string | null
          started_at?: string | null
          status?: string | null
          transcript_object_id?: string | null
          transcript_text?: string | null
          transferred_at?: string | null
          transferred_to_recruiter?: boolean | null
          updated_at?: string | null
          voicemail_left?: boolean | null
        }
        Relationships: []
      }
      ai_call_queue: {
        Row: {
          attempt_count: number | null
          campaign_id: string | null
          candidate_id: string | null
          candidate_name: string | null
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          job_id: string | null
          job_pay: string | null
          job_state: string | null
          job_title: string | null
          last_attempt_at: string | null
          max_attempts: number | null
          metadata: Json | null
          next_retry_at: string | null
          not_after: string | null
          not_before: string | null
          outcome: string | null
          phone: string
          priority: number | null
          recruiter_id: string | null
          recruiter_name: string | null
          recruiter_phone: string | null
          retell_agent_id: string | null
          retell_call_id: string | null
          scheduled_at: string | null
          source: string | null
          started_at: string | null
          status: string | null
          summary: string | null
          timezone: string | null
          transcript: string | null
          updated_at: string | null
        }
        Insert: {
          attempt_count?: number | null
          campaign_id?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          job_id?: string | null
          job_pay?: string | null
          job_state?: string | null
          job_title?: string | null
          last_attempt_at?: string | null
          max_attempts?: number | null
          metadata?: Json | null
          next_retry_at?: string | null
          not_after?: string | null
          not_before?: string | null
          outcome?: string | null
          phone: string
          priority?: number | null
          recruiter_id?: string | null
          recruiter_name?: string | null
          recruiter_phone?: string | null
          retell_agent_id?: string | null
          retell_call_id?: string | null
          scheduled_at?: string | null
          source?: string | null
          started_at?: string | null
          status?: string | null
          summary?: string | null
          timezone?: string | null
          transcript?: string | null
          updated_at?: string | null
        }
        Update: {
          attempt_count?: number | null
          campaign_id?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          job_id?: string | null
          job_pay?: string | null
          job_state?: string | null
          job_title?: string | null
          last_attempt_at?: string | null
          max_attempts?: number | null
          metadata?: Json | null
          next_retry_at?: string | null
          not_after?: string | null
          not_before?: string | null
          outcome?: string | null
          phone?: string
          priority?: number | null
          recruiter_id?: string | null
          recruiter_name?: string | null
          recruiter_phone?: string | null
          retell_agent_id?: string | null
          retell_call_id?: string | null
          scheduled_at?: string | null
          source?: string | null
          started_at?: string | null
          status?: string | null
          summary?: string | null
          timezone?: string | null
          transcript?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      alpha_sophia_config: {
        Row: {
          admin_daily_limit: number
          cost_per_lookup: number
          daily_limit: number
          enabled: boolean
          id: string
          max_results_per_search: number
          min_local_threshold: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          admin_daily_limit?: number
          cost_per_lookup?: number
          daily_limit?: number
          enabled?: boolean
          id?: string
          max_results_per_search?: number
          min_local_threshold?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          admin_daily_limit?: number
          cost_per_lookup?: number
          daily_limit?: number
          enabled?: boolean
          id?: string
          max_results_per_search?: number
          min_local_threshold?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      alpha_sophia_daily_usage: {
        Row: {
          created_at: string
          id: string
          total_cost: number
          total_imports: number
          total_results: number
          total_searches: number
          updated_at: string
          usage_date: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          total_cost?: number
          total_imports?: number
          total_results?: number
          total_searches?: number
          updated_at?: string
          usage_date?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          total_cost?: number
          total_imports?: number
          total_results?: number
          total_searches?: number
          updated_at?: string
          usage_date?: string
          user_id?: string | null
        }
        Relationships: []
      }
      alpha_sophia_usage: {
        Row: {
          campaign_id: string | null
          candidates_imported: number
          created_at: string
          estimated_cost: number
          id: string
          job_id: string | null
          results_returned: number
          search_type: string
          specialty_searched: string | null
          state_searched: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          candidates_imported?: number
          created_at?: string
          estimated_cost?: number
          id?: string
          job_id?: string | null
          results_returned?: number
          search_type?: string
          specialty_searched?: string | null
          state_searched?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          candidates_imported?: number
          created_at?: string
          estimated_cost?: number
          id?: string
          job_id?: string | null
          results_returned?: number
          search_type?: string
          specialty_searched?: string | null
          state_searched?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alpha_sophia_usage_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alpha_sophia_usage_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      badge_definitions: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          points_bonus: number | null
          rarity: string | null
          threshold: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id: string
          name: string
          points_bonus?: number | null
          rarity?: string | null
          threshold?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          points_bonus?: number | null
          rarity?: string | null
          threshold?: number | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          points_reward: number | null
          requirement_type: string | null
          requirement_value: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          points_reward?: number | null
          requirement_type?: string | null
          requirement_value?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          points_reward?: number | null
          requirement_type?: string | null
          requirement_value?: number | null
        }
        Relationships: []
      }
      campaign_configs: {
        Row: {
          ai_call_enabled: boolean | null
          created_at: string | null
          email_enabled: boolean | null
          email_template_id: string | null
          id: string
          is_default: boolean | null
          name: string
          retell_config_id: string | null
          sms_enabled: boolean | null
          sms_template_id: string | null
          timing_rules: Json | null
        }
        Insert: {
          ai_call_enabled?: boolean | null
          created_at?: string | null
          email_enabled?: boolean | null
          email_template_id?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          retell_config_id?: string | null
          sms_enabled?: boolean | null
          sms_template_id?: string | null
          timing_rules?: Json | null
        }
        Update: {
          ai_call_enabled?: boolean | null
          created_at?: string | null
          email_enabled?: boolean | null
          email_template_id?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          retell_config_id?: string | null
          sms_enabled?: boolean | null
          sms_template_id?: string | null
          timing_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_configs_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_configs_retell_config_id_fkey"
            columns: ["retell_config_id"]
            isOneToOne: false
            referencedRelation: "retell_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_configs_sms_template_id_fkey"
            columns: ["sms_template_id"]
            isOneToOne: false
            referencedRelation: "sms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_events: {
        Row: {
          campaign_id: string | null
          channel: string | null
          created_at: string
          event_type: string
          external_id: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
        }
        Insert: {
          campaign_id?: string | null
          channel?: string | null
          created_at?: string
          event_type: string
          external_id?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
        }
        Update: {
          campaign_id?: string | null
          channel?: string | null
          created_at?: string
          event_type?: string
          external_id?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "campaign_leads_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_leads: {
        Row: {
          campaign_id: string | null
          candidate_id: string | null
          created_at: string | null
          id: string
          personalization_hooks: string | null
          status: string | null
          tier: number | null
        }
        Insert: {
          campaign_id?: string | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          personalization_hooks?: string | null
          status?: string | null
          tier?: number | null
        }
        Update: {
          campaign_id?: string | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          personalization_hooks?: string | null
          status?: string | null
          tier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_leads_v2: {
        Row: {
          call_outcome: string | null
          calls_attempted: number | null
          calls_connected: number | null
          campaign_id: string | null
          candidate_email: string | null
          candidate_id: string | null
          candidate_name: string | null
          candidate_phone: string | null
          candidate_specialty: string | null
          candidate_state: string | null
          created_at: string | null
          emails_clicked: number | null
          emails_opened: number | null
          emails_replied: number | null
          emails_sent: number | null
          id: string
          interest_level: string | null
          last_contact_at: string | null
          match_concerns: string[] | null
          match_reasons: string[] | null
          match_score: number | null
          next_action: string | null
          next_action_at: string | null
          notes: string | null
          sentiment: string | null
          sms_replied: number | null
          sms_sent: number | null
          status: string | null
          tier: number | null
          touch_count: number | null
          updated_at: string | null
        }
        Insert: {
          call_outcome?: string | null
          calls_attempted?: number | null
          calls_connected?: number | null
          campaign_id?: string | null
          candidate_email?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          candidate_phone?: string | null
          candidate_specialty?: string | null
          candidate_state?: string | null
          created_at?: string | null
          emails_clicked?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          id?: string
          interest_level?: string | null
          last_contact_at?: string | null
          match_concerns?: string[] | null
          match_reasons?: string[] | null
          match_score?: number | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          sentiment?: string | null
          sms_replied?: number | null
          sms_sent?: number | null
          status?: string | null
          tier?: number | null
          touch_count?: number | null
          updated_at?: string | null
        }
        Update: {
          call_outcome?: string | null
          calls_attempted?: number | null
          calls_connected?: number | null
          campaign_id?: string | null
          candidate_email?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          candidate_phone?: string | null
          candidate_specialty?: string | null
          candidate_state?: string | null
          created_at?: string | null
          emails_clicked?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          id?: string
          interest_level?: string | null
          last_contact_at?: string | null
          match_concerns?: string[] | null
          match_reasons?: string[] | null
          match_score?: number | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          sentiment?: string | null
          sms_replied?: number | null
          sms_sent?: number | null
          status?: string | null
          tier?: number | null
          touch_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_leads_v2_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_v2_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_v2_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_v2_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          calls_attempted: number | null
          calls_connected: number | null
          channel: string | null
          created_at: string | null
          created_by: string | null
          emails_bounced: number | null
          emails_clicked: number | null
          emails_opened: number | null
          emails_replied: number | null
          emails_sent: number | null
          external_id: string | null
          id: string
          job_id: string | null
          leads_count: number | null
          name: string | null
          playbook_data: Json | null
          playbook_notion_id: string | null
          playbook_synced_at: string | null
          sender_account: string | null
          sms_delivered: number | null
          sms_replied: number | null
          sms_sent: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          calls_attempted?: number | null
          calls_connected?: number | null
          channel?: string | null
          created_at?: string | null
          created_by?: string | null
          emails_bounced?: number | null
          emails_clicked?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          external_id?: string | null
          id?: string
          job_id?: string | null
          leads_count?: number | null
          name?: string | null
          playbook_data?: Json | null
          playbook_notion_id?: string | null
          playbook_synced_at?: string | null
          sender_account?: string | null
          sms_delivered?: number | null
          sms_replied?: number | null
          sms_sent?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          calls_attempted?: number | null
          calls_connected?: number | null
          channel?: string | null
          created_at?: string | null
          created_by?: string | null
          emails_bounced?: number | null
          emails_clicked?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          external_id?: string | null
          id?: string
          job_id?: string | null
          leads_count?: number | null
          name?: string | null
          playbook_data?: Json | null
          playbook_notion_id?: string | null
          playbook_synced_at?: string | null
          sender_account?: string | null
          sms_delivered?: number | null
          sms_replied?: number | null
          sms_sent?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          candidate_id: string | null
          id: string
          reason: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          candidate_id?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          candidate_id?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_assignments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_assignments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_assignments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_documents: {
        Row: {
          candidate_id: string | null
          created_at: string | null
          document_type: string
          expiration_date: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          state: string | null
          updated_at: string | null
          uploaded_by: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string | null
          document_type: string
          expiration_date?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          state?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string | null
          document_type?: string
          expiration_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          state?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_job_matches: {
        Row: {
          candidate_id: string
          created_at: string | null
          has_required_license: boolean | null
          icebreaker: string | null
          id: string
          job_id: string
          license_path: string | null
          match_concerns: string[] | null
          match_grade: string | null
          match_reasons: string[] | null
          match_score: number | null
          research_id: string | null
          scored_at: string | null
          talking_points: string[] | null
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          has_required_license?: boolean | null
          icebreaker?: string | null
          id?: string
          job_id: string
          license_path?: string | null
          match_concerns?: string[] | null
          match_grade?: string | null
          match_reasons?: string[] | null
          match_score?: number | null
          research_id?: string | null
          scored_at?: string | null
          talking_points?: string[] | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          has_required_license?: boolean | null
          icebreaker?: string | null
          id?: string
          job_id?: string
          license_path?: string | null
          match_concerns?: string[] | null
          match_grade?: string | null
          match_reasons?: string[] | null
          match_score?: number | null
          research_id?: string | null
          scored_at?: string | null
          talking_points?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_job_matches_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_job_matches_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_job_matches_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_job_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_job_matches_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "candidate_research"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_outreach_log: {
        Row: {
          campaign_id: string | null
          candidate_id: string
          created_at: string | null
          email_clicks: number | null
          email_opens: number | null
          email_replied: boolean | null
          email_sent: boolean | null
          id: string
          last_click_date: string | null
          last_open_date: string | null
          linkedin_viewed: boolean | null
          reply_date: string | null
          sent_date: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          candidate_id: string
          created_at?: string | null
          email_clicks?: number | null
          email_opens?: number | null
          email_replied?: boolean | null
          email_sent?: boolean | null
          id?: string
          last_click_date?: string | null
          last_open_date?: string | null
          linkedin_viewed?: boolean | null
          reply_date?: string | null
          sent_date?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          candidate_id?: string
          created_at?: string | null
          email_clicks?: number | null
          email_opens?: number | null
          email_replied?: boolean | null
          email_sent?: boolean | null
          id?: string
          last_click_date?: string | null
          last_open_date?: string | null
          linkedin_viewed?: boolean | null
          reply_date?: string | null
          sent_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_outreach_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_outreach_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_outreach_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_personalization: {
        Row: {
          batch_number: number | null
          candidate_id: string | null
          created_at: string | null
          doximity_url: string | null
          email_opener: string | null
          employer_researched: string | null
          hooks: Json | null
          id: string
          job_id: string | null
          linkedin_note: string | null
          location_researched: string | null
          research_confidence: string | null
          tier: string
          updated_at: string | null
        }
        Insert: {
          batch_number?: number | null
          candidate_id?: string | null
          created_at?: string | null
          doximity_url?: string | null
          email_opener?: string | null
          employer_researched?: string | null
          hooks?: Json | null
          id?: string
          job_id?: string | null
          linkedin_note?: string | null
          location_researched?: string | null
          research_confidence?: string | null
          tier: string
          updated_at?: string | null
        }
        Update: {
          batch_number?: number | null
          candidate_id?: string | null
          created_at?: string | null
          doximity_url?: string | null
          email_opener?: string | null
          employer_researched?: string | null
          hooks?: Json | null
          id?: string
          job_id?: string | null
          linkedin_note?: string | null
          location_researched?: string | null
          research_confidence?: string | null
          tier?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_personalization_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_personalization_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_personalization_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_personalization_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_research: {
        Row: {
          candidate_id: string
          created_at: string | null
          credentials_summary: string | null
          has_imlc: boolean | null
          id: string
          imlc_inference_reason: string | null
          last_researched_at: string | null
          license_count: number | null
          npi: string | null
          npi_verification_date: string | null
          npi_verified: boolean | null
          professional_highlights: string[] | null
          research_confidence: string | null
          research_source: string | null
          researched_by: string | null
          specialty_verified: boolean | null
          updated_at: string | null
          verified_licenses: string[] | null
          verified_specialty: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          credentials_summary?: string | null
          has_imlc?: boolean | null
          id?: string
          imlc_inference_reason?: string | null
          last_researched_at?: string | null
          license_count?: number | null
          npi?: string | null
          npi_verification_date?: string | null
          npi_verified?: boolean | null
          professional_highlights?: string[] | null
          research_confidence?: string | null
          research_source?: string | null
          researched_by?: string | null
          specialty_verified?: boolean | null
          updated_at?: string | null
          verified_licenses?: string[] | null
          verified_specialty?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          credentials_summary?: string | null
          has_imlc?: boolean | null
          id?: string
          imlc_inference_reason?: string | null
          last_researched_at?: string | null
          license_count?: number | null
          npi?: string | null
          npi_verification_date?: string | null
          npi_verified?: boolean | null
          professional_highlights?: string[] | null
          research_confidence?: string | null
          research_source?: string | null
          researched_by?: string | null
          specialty_verified?: boolean | null
          updated_at?: string | null
          verified_licenses?: string[] | null
          verified_specialty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_research_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_research_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_research_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_tags: {
        Row: {
          category: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_work_history: {
        Row: {
          candidate_id: string | null
          created_at: string | null
          end_date: string | null
          facility_city: string | null
          facility_name: string | null
          facility_state: string | null
          id: string
          role_type: string | null
          source: string | null
          specialty_worked: string | null
          start_date: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string | null
          end_date?: string | null
          facility_city?: string | null
          facility_name?: string | null
          facility_state?: string | null
          id?: string
          role_type?: string | null
          source?: string | null
          specialty_worked?: string | null
          start_date?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string | null
          end_date?: string | null
          facility_city?: string | null
          facility_name?: string | null
          facility_state?: string | null
          id?: string
          role_type?: string | null
          source?: string | null
          specialty_worked?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_work_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_work_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_work_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          airline_rewards: Json | null
          assigned_recruiter_id: string | null
          assigned_to: string | null
          availability_months: string[] | null
          board_certifications: string[] | null
          board_certified: boolean | null
          call_schedule_willing: boolean | null
          cancellations_count: number | null
          candidate_status: string | null
          caqh_password: string | null
          caqh_username: string | null
          certifications: string[] | null
          churn_risk_score: number | null
          city: string | null
          clinical_competencies: string[] | null
          compact_license: boolean | null
          company_name: string | null
          contract_breaches: number | null
          covid_vaccination_status: string | null
          created_at: string | null
          current_hourly_rate: number | null
          data_quality_score: number | null
          date_available: string | null
          dea_licenses: string[] | null
          desired_hourly_max: number | null
          desired_hourly_min: number | null
          desired_regions: string[] | null
          desired_settings: string[] | null
          desired_states: string[] | null
          email: string | null
          employment_status: string | null
          emr_systems: string[] | null
          engagement_level: string | null
          enriched_at: string | null
          enrichment_needed: boolean | null
          enrichment_score: number | null
          enrichment_source: string | null
          enrichment_tier: string | null
          first_name: string | null
          graduation_year: number | null
          has_company_data: boolean | null
          has_credential_data: boolean | null
          has_preferences_data: boolean | null
          holiday_coverage_willing: boolean | null
          hotel_rewards: Json | null
          icu_experience: string | null
          id: string
          imlc_license: boolean | null
          languages: string[] | null
          last_contact_date: string | null
          last_enrichment_date: string | null
          last_name: string | null
          last_placed_rate: number | null
          last_verified_date: string | null
          lead_source: string | null
          licenses: string[] | null
          lockouts: string[] | null
          min_rate: number | null
          monthly_shift_availability: number | null
          next_available_start_date: string | null
          no_show_incidents: number | null
          notes: string | null
          npi: string | null
          npi_verified: boolean | null
          oig_excluded: boolean | null
          owned_by: string | null
          personal_address: string | null
          personal_email: string | null
          personal_mobile: string | null
          phone: string | null
          phone_enriched: string | null
          pipeline_status: string | null
          placement_probability_score: number | null
          preferred_airline: string | null
          preferred_airport: string | null
          preferred_hotel: string | null
          preferred_rate: number | null
          preferred_rental_car: string | null
          preferred_seating: string | null
          procedures: string[] | null
          provider_class: string | null
          quality_score: number | null
          rate_notes: string | null
          red_flags: string[] | null
          redeployment_probability: number | null
          relationship_quality_score: number | null
          reliability_score: number | null
          rental_car_rewards: Json | null
          risk_assessment_status: string | null
          schedule_preferences: string[] | null
          shift_preferences: string[] | null
          sms_opt_out: boolean | null
          soft_deleted: boolean | null
          solo_coverage_willing: boolean | null
          source: string | null
          specialty: string | null
          state: string | null
          status: string | null
          subspecialty: string | null
          tags: string[] | null
          trauma_level_experience: string | null
          travel_preferences_notes: string | null
          updated_at: string | null
          us_citizen: boolean | null
          weekend_coverage_willing: boolean | null
          willing_to_license: string[] | null
          work_eligibility: string | null
          years_of_experience: number | null
          zip: string | null
        }
        Insert: {
          airline_rewards?: Json | null
          assigned_recruiter_id?: string | null
          assigned_to?: string | null
          availability_months?: string[] | null
          board_certifications?: string[] | null
          board_certified?: boolean | null
          call_schedule_willing?: boolean | null
          cancellations_count?: number | null
          candidate_status?: string | null
          caqh_password?: string | null
          caqh_username?: string | null
          certifications?: string[] | null
          churn_risk_score?: number | null
          city?: string | null
          clinical_competencies?: string[] | null
          compact_license?: boolean | null
          company_name?: string | null
          contract_breaches?: number | null
          covid_vaccination_status?: string | null
          created_at?: string | null
          current_hourly_rate?: number | null
          data_quality_score?: number | null
          date_available?: string | null
          dea_licenses?: string[] | null
          desired_hourly_max?: number | null
          desired_hourly_min?: number | null
          desired_regions?: string[] | null
          desired_settings?: string[] | null
          desired_states?: string[] | null
          email?: string | null
          employment_status?: string | null
          emr_systems?: string[] | null
          engagement_level?: string | null
          enriched_at?: string | null
          enrichment_needed?: boolean | null
          enrichment_score?: number | null
          enrichment_source?: string | null
          enrichment_tier?: string | null
          first_name?: string | null
          graduation_year?: number | null
          has_company_data?: boolean | null
          has_credential_data?: boolean | null
          has_preferences_data?: boolean | null
          holiday_coverage_willing?: boolean | null
          hotel_rewards?: Json | null
          icu_experience?: string | null
          id?: string
          imlc_license?: boolean | null
          languages?: string[] | null
          last_contact_date?: string | null
          last_enrichment_date?: string | null
          last_name?: string | null
          last_placed_rate?: number | null
          last_verified_date?: string | null
          lead_source?: string | null
          licenses?: string[] | null
          lockouts?: string[] | null
          min_rate?: number | null
          monthly_shift_availability?: number | null
          next_available_start_date?: string | null
          no_show_incidents?: number | null
          notes?: string | null
          npi?: string | null
          npi_verified?: boolean | null
          oig_excluded?: boolean | null
          owned_by?: string | null
          personal_address?: string | null
          personal_email?: string | null
          personal_mobile?: string | null
          phone?: string | null
          phone_enriched?: string | null
          pipeline_status?: string | null
          placement_probability_score?: number | null
          preferred_airline?: string | null
          preferred_airport?: string | null
          preferred_hotel?: string | null
          preferred_rate?: number | null
          preferred_rental_car?: string | null
          preferred_seating?: string | null
          procedures?: string[] | null
          provider_class?: string | null
          quality_score?: number | null
          rate_notes?: string | null
          red_flags?: string[] | null
          redeployment_probability?: number | null
          relationship_quality_score?: number | null
          reliability_score?: number | null
          rental_car_rewards?: Json | null
          risk_assessment_status?: string | null
          schedule_preferences?: string[] | null
          shift_preferences?: string[] | null
          sms_opt_out?: boolean | null
          soft_deleted?: boolean | null
          solo_coverage_willing?: boolean | null
          source?: string | null
          specialty?: string | null
          state?: string | null
          status?: string | null
          subspecialty?: string | null
          tags?: string[] | null
          trauma_level_experience?: string | null
          travel_preferences_notes?: string | null
          updated_at?: string | null
          us_citizen?: boolean | null
          weekend_coverage_willing?: boolean | null
          willing_to_license?: string[] | null
          work_eligibility?: string | null
          years_of_experience?: number | null
          zip?: string | null
        }
        Update: {
          airline_rewards?: Json | null
          assigned_recruiter_id?: string | null
          assigned_to?: string | null
          availability_months?: string[] | null
          board_certifications?: string[] | null
          board_certified?: boolean | null
          call_schedule_willing?: boolean | null
          cancellations_count?: number | null
          candidate_status?: string | null
          caqh_password?: string | null
          caqh_username?: string | null
          certifications?: string[] | null
          churn_risk_score?: number | null
          city?: string | null
          clinical_competencies?: string[] | null
          compact_license?: boolean | null
          company_name?: string | null
          contract_breaches?: number | null
          covid_vaccination_status?: string | null
          created_at?: string | null
          current_hourly_rate?: number | null
          data_quality_score?: number | null
          date_available?: string | null
          dea_licenses?: string[] | null
          desired_hourly_max?: number | null
          desired_hourly_min?: number | null
          desired_regions?: string[] | null
          desired_settings?: string[] | null
          desired_states?: string[] | null
          email?: string | null
          employment_status?: string | null
          emr_systems?: string[] | null
          engagement_level?: string | null
          enriched_at?: string | null
          enrichment_needed?: boolean | null
          enrichment_score?: number | null
          enrichment_source?: string | null
          enrichment_tier?: string | null
          first_name?: string | null
          graduation_year?: number | null
          has_company_data?: boolean | null
          has_credential_data?: boolean | null
          has_preferences_data?: boolean | null
          holiday_coverage_willing?: boolean | null
          hotel_rewards?: Json | null
          icu_experience?: string | null
          id?: string
          imlc_license?: boolean | null
          languages?: string[] | null
          last_contact_date?: string | null
          last_enrichment_date?: string | null
          last_name?: string | null
          last_placed_rate?: number | null
          last_verified_date?: string | null
          lead_source?: string | null
          licenses?: string[] | null
          lockouts?: string[] | null
          min_rate?: number | null
          monthly_shift_availability?: number | null
          next_available_start_date?: string | null
          no_show_incidents?: number | null
          notes?: string | null
          npi?: string | null
          npi_verified?: boolean | null
          oig_excluded?: boolean | null
          owned_by?: string | null
          personal_address?: string | null
          personal_email?: string | null
          personal_mobile?: string | null
          phone?: string | null
          phone_enriched?: string | null
          pipeline_status?: string | null
          placement_probability_score?: number | null
          preferred_airline?: string | null
          preferred_airport?: string | null
          preferred_hotel?: string | null
          preferred_rate?: number | null
          preferred_rental_car?: string | null
          preferred_seating?: string | null
          procedures?: string[] | null
          provider_class?: string | null
          quality_score?: number | null
          rate_notes?: string | null
          red_flags?: string[] | null
          redeployment_probability?: number | null
          relationship_quality_score?: number | null
          reliability_score?: number | null
          rental_car_rewards?: Json | null
          risk_assessment_status?: string | null
          schedule_preferences?: string[] | null
          shift_preferences?: string[] | null
          sms_opt_out?: boolean | null
          soft_deleted?: boolean | null
          solo_coverage_willing?: boolean | null
          source?: string | null
          specialty?: string | null
          state?: string | null
          status?: string | null
          subspecialty?: string | null
          tags?: string[] | null
          trauma_level_experience?: string | null
          travel_preferences_notes?: string | null
          updated_at?: string | null
          us_citizen?: boolean | null
          weekend_coverage_willing?: boolean | null
          willing_to_license?: string[] | null
          work_eligibility?: string | null
          years_of_experience?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_assigned_recruiter_id_fkey"
            columns: ["assigned_recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_prizes: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          description: string | null
          id: string
          paid_at: string | null
          reason: string
          reference_id: string | null
          reference_type: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          paid_at?: string | null
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          paid_at?: string | null
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_prizes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logins: {
        Row: {
          bonus_boxes: number | null
          bonus_xp: number | null
          created_at: string | null
          id: string
          login_date: string
          user_id: string | null
        }
        Insert: {
          bonus_boxes?: number | null
          bonus_xp?: number | null
          created_at?: string | null
          id?: string
          login_date: string
          user_id?: string | null
        }
        Update: {
          bonus_boxes?: number | null
          bonus_xp?: number | null
          created_at?: string | null
          id?: string
          login_date?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_template: string
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sequence_day: number | null
          subject_template: string
          variables: string[] | null
        }
        Insert: {
          body_template: string
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sequence_day?: number | null
          subject_template: string
          variables?: string[] | null
        }
        Update: {
          body_template?: string
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sequence_day?: number | null
          subject_template?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      enrichment_budget: {
        Row: {
          budget_limit: number | null
          created_at: string | null
          enrichments_count: number | null
          id: string
          month: string
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          budget_limit?: number | null
          created_at?: string | null
          enrichments_count?: number | null
          id?: string
          month: string
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          budget_limit?: number | null
          created_at?: string | null
          enrichments_count?: number | null
          id?: string
          month?: string
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      enrichment_log: {
        Row: {
          campaign_id: string | null
          candidate_id: string | null
          cost: number
          created_at: string | null
          enriched_by: string | null
          id: string
          job_id: string | null
          personal_email_found: string | null
          personal_mobile_found: string | null
          source: string
          status: string | null
        }
        Insert: {
          campaign_id?: string | null
          candidate_id?: string | null
          cost?: number
          created_at?: string | null
          enriched_by?: string | null
          id?: string
          job_id?: string | null
          personal_email_found?: string | null
          personal_mobile_found?: string | null
          source: string
          status?: string | null
        }
        Update: {
          campaign_id?: string | null
          candidate_id?: string | null
          cost?: number
          created_at?: string | null
          enriched_by?: string | null
          id?: string
          job_id?: string | null
          personal_email_found?: string | null
          personal_mobile_found?: string | null
          source?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_queue: {
        Row: {
          api_response: Json | null
          candidate_id: string
          cost: number | null
          created_at: string | null
          error_message: string | null
          id: string
          priority: number
          processed_at: string | null
          signal_type: string
          status: string | null
        }
        Insert: {
          api_response?: Json | null
          candidate_id: string
          cost?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          priority?: number
          processed_at?: string | null
          signal_type: string
          status?: string | null
        }
        Update: {
          api_response?: Json | null
          candidate_id?: string
          cost?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          priority?: number
          processed_at?: string | null
          signal_type?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_queue_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_queue_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_queue_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          has_used_locums: boolean | null
          id: string
          last_locum_date: string | null
          name: string | null
          notes: string | null
          source: string | null
          state: string | null
          type: string | null
        }
        Insert: {
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          has_used_locums?: boolean | null
          id?: string
          last_locum_date?: string | null
          name?: string | null
          notes?: string | null
          source?: string | null
          state?: string | null
          type?: string | null
        }
        Update: {
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          has_used_locums?: boolean | null
          id?: string
          last_locum_date?: string | null
          name?: string | null
          notes?: string | null
          source?: string | null
          state?: string | null
          type?: string | null
        }
        Relationships: []
      }
      interactions: {
        Row: {
          campaign_id: string | null
          candidate_id: string | null
          channel: string | null
          content: string | null
          direction: string | null
          id: string
          job_id: string | null
          outcome: string | null
          response: string | null
          timestamp: string | null
        }
        Insert: {
          campaign_id?: string | null
          candidate_id?: string | null
          channel?: string | null
          content?: string | null
          direction?: string | null
          id?: string
          job_id?: string | null
          outcome?: string | null
          response?: string | null
          timestamp?: string | null
        }
        Update: {
          campaign_id?: string | null
          candidate_id?: string | null
          channel?: string | null
          content?: string | null
          direction?: string | null
          id?: string
          job_id?: string | null
          outcome?: string | null
          response?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          bill_rate: number | null
          callback_rate: number | null
          city: string | null
          client_contact: string | null
          client_email: string | null
          created_at: string | null
          end_date: string | null
          facility_name: string | null
          id: string
          job_name: string | null
          pay_rate: number | null
          raw_job_text: string | null
          requirements: string | null
          schedule: string | null
          specialty: string | null
          start_date: string | null
          state: string | null
          status: string | null
        }
        Insert: {
          bill_rate?: number | null
          callback_rate?: number | null
          city?: string | null
          client_contact?: string | null
          client_email?: string | null
          created_at?: string | null
          end_date?: string | null
          facility_name?: string | null
          id?: string
          job_name?: string | null
          pay_rate?: number | null
          raw_job_text?: string | null
          requirements?: string | null
          schedule?: string | null
          specialty?: string | null
          start_date?: string | null
          state?: string | null
          status?: string | null
        }
        Update: {
          bill_rate?: number | null
          callback_rate?: number | null
          city?: string | null
          client_contact?: string | null
          client_email?: string | null
          created_at?: string | null
          end_date?: string | null
          facility_name?: string | null
          id?: string
          job_name?: string | null
          pay_rate?: number | null
          raw_job_text?: string | null
          requirements?: string | null
          schedule?: string | null
          specialty?: string | null
          start_date?: string | null
          state?: string | null
          status?: string | null
        }
        Relationships: []
      }
      loot_boxes: {
        Row: {
          common_boxes: number | null
          created_at: string | null
          epic_boxes: number | null
          legendary_boxes: number | null
          rare_boxes: number | null
          uncommon_boxes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          common_boxes?: number | null
          created_at?: string | null
          epic_boxes?: number | null
          legendary_boxes?: number | null
          rare_boxes?: number | null
          uncommon_boxes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          common_boxes?: number | null
          created_at?: string | null
          epic_boxes?: number | null
          legendary_boxes?: number | null
          rare_boxes?: number | null
          uncommon_boxes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loot_boxes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          call_script: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          job_id: string | null
          key_selling_points: string[] | null
          name: string
          outreach_cadence: Json | null
          sms_follow_up: string | null
          sms_initial: string | null
          sms_interest_response: string | null
          summary: string | null
          tier1_emails: Json | null
          tier2_emails: Json | null
          tier3_emails: Json | null
          tier4_emails: Json | null
          updated_at: string | null
        }
        Insert: {
          call_script?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          job_id?: string | null
          key_selling_points?: string[] | null
          name: string
          outreach_cadence?: Json | null
          sms_follow_up?: string | null
          sms_initial?: string | null
          sms_interest_response?: string | null
          summary?: string | null
          tier1_emails?: Json | null
          tier2_emails?: Json | null
          tier3_emails?: Json | null
          tier4_emails?: Json | null
          updated_at?: string | null
        }
        Update: {
          call_script?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          job_id?: string | null
          key_selling_points?: string[] | null
          name?: string
          outreach_cadence?: Json | null
          sms_follow_up?: string | null
          sms_initial?: string | null
          sms_interest_response?: string | null
          summary?: string | null
          tier1_emails?: Json | null
          tier2_emails?: Json | null
          tier3_emails?: Json | null
          tier4_emails?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbooks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_history: {
        Row: {
          box_tier: string
          created_at: string | null
          id: string
          prize_type: string
          prize_value: Json | null
          user_id: string | null
        }
        Insert: {
          box_tier: string
          created_at?: string | null
          id?: string
          prize_type: string
          prize_value?: Json | null
          user_id?: string | null
        }
        Update: {
          box_tier?: string
          created_at?: string | null
          id?: string
          prize_type?: string
          prize_value?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prize_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_stats: {
        Row: {
          calls_total: number | null
          created_at: string | null
          current_streak: number | null
          id: string
          interested_total: number | null
          last_active_date: string | null
          last_activity_date: string | null
          level: number | null
          longest_streak: number | null
          placements_total: number | null
          total_xp: number | null
          updated_at: string | null
          user_id: string | null
          xp: number | null
        }
        Insert: {
          calls_total?: number | null
          created_at?: string | null
          current_streak?: number | null
          id?: string
          interested_total?: number | null
          last_active_date?: string | null
          last_activity_date?: string | null
          level?: number | null
          longest_streak?: number | null
          placements_total?: number | null
          total_xp?: number | null
          updated_at?: string | null
          user_id?: string | null
          xp?: number | null
        }
        Update: {
          calls_total?: number | null
          created_at?: string | null
          current_streak?: number | null
          id?: string
          interested_total?: number | null
          last_active_date?: string | null
          last_activity_date?: string | null
          level?: number | null
          longest_streak?: number | null
          placements_total?: number | null
          total_xp?: number | null
          updated_at?: string | null
          user_id?: string | null
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiters: {
        Row: {
          available_for_transfers: boolean | null
          calls_received: number | null
          created_at: string | null
          email: string | null
          id: string
          instantly_email: string | null
          is_active: boolean | null
          name: string
          phone: string | null
          placements: number | null
          timezone: string | null
          transfer_hours_end: string | null
          transfer_hours_start: string | null
        }
        Insert: {
          available_for_transfers?: boolean | null
          calls_received?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          instantly_email?: string | null
          is_active?: boolean | null
          name: string
          phone?: string | null
          placements?: number | null
          timezone?: string | null
          transfer_hours_end?: string | null
          transfer_hours_start?: string | null
        }
        Update: {
          available_for_transfers?: boolean | null
          calls_received?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          instantly_email?: string | null
          is_active?: boolean | null
          name?: string
          phone?: string | null
          placements?: number | null
          timezone?: string | null
          transfer_hours_end?: string | null
          transfer_hours_start?: string | null
        }
        Relationships: []
      }
      resumes: {
        Row: {
          candidate_id: string | null
          file_name: string | null
          id: string
          parsed_json: Json | null
          raw_text: string | null
          uploaded_at: string | null
        }
        Insert: {
          candidate_id?: string | null
          file_name?: string | null
          id?: string
          parsed_json?: Json | null
          raw_text?: string | null
          uploaded_at?: string | null
        }
        Update: {
          candidate_id?: string | null
          file_name?: string | null
          id?: string
          parsed_json?: Json | null
          raw_text?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resumes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resumes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resumes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      retell_agents: {
        Row: {
          avg_duration_seconds: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default_inbound: boolean | null
          is_default_outbound: boolean | null
          name: string
          purpose: string | null
          retell_agent_id: string
          retell_llm_id: string | null
          retell_phone: string | null
          successful_calls: number | null
          system_prompt: string | null
          total_calls: number | null
          updated_at: string | null
        }
        Insert: {
          avg_duration_seconds?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default_inbound?: boolean | null
          is_default_outbound?: boolean | null
          name: string
          purpose?: string | null
          retell_agent_id: string
          retell_llm_id?: string | null
          retell_phone?: string | null
          successful_calls?: number | null
          system_prompt?: string | null
          total_calls?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_duration_seconds?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default_inbound?: boolean | null
          is_default_outbound?: boolean | null
          name?: string
          purpose?: string | null
          retell_agent_id?: string
          retell_llm_id?: string | null
          retell_phone?: string | null
          successful_calls?: number | null
          system_prompt?: string | null
          total_calls?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      retell_configs: {
        Row: {
          agent_id: string
          dynamic_variables: string[] | null
          id: string
          is_active: boolean | null
          name: string
          objection_handlers: Json | null
          opening_script: string
          phone_number: string | null
          script_version: string | null
          transfer_settings: Json | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          dynamic_variables?: string[] | null
          id?: string
          is_active?: boolean | null
          name: string
          objection_handlers?: Json | null
          opening_script: string
          phone_number?: string | null
          script_version?: string | null
          transfer_settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          dynamic_variables?: string[] | null
          id?: string
          is_active?: boolean | null
          name?: string
          objection_handlers?: Json | null
          opening_script?: string
          phone_number?: string | null
          script_version?: string | null
          transfer_settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      scheduled_callbacks: {
        Row: {
          candidate_id: string | null
          candidate_name: string | null
          completed_at: string | null
          created_at: string | null
          created_from_call_id: string | null
          id: string
          job_id: string | null
          job_title: string | null
          notes: string | null
          outcome: string | null
          phone: string
          recruiter_id: string | null
          recruiter_name: string | null
          recruiter_phone: string | null
          reminder_sent_at: string | null
          requested_time_raw: string | null
          scheduled_time: string | null
          status: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_id?: string | null
          candidate_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_from_call_id?: string | null
          id?: string
          job_id?: string | null
          job_title?: string | null
          notes?: string | null
          outcome?: string | null
          phone: string
          recruiter_id?: string | null
          recruiter_name?: string | null
          recruiter_phone?: string | null
          reminder_sent_at?: string | null
          requested_time_raw?: string | null
          scheduled_time?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string | null
          candidate_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_from_call_id?: string | null
          id?: string
          job_id?: string | null
          job_title?: string | null
          notes?: string | null
          outcome?: string | null
          phone?: string
          recruiter_id?: string | null
          recruiter_name?: string | null
          recruiter_phone?: string | null
          reminder_sent_at?: string | null
          requested_time_raw?: string | null
          scheduled_time?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_conversations: {
        Row: {
          campaign_id: string | null
          candidate_id: string | null
          candidate_phone: string
          candidate_replied: boolean | null
          created_at: string | null
          id: string
          interest_detected: boolean | null
          job_id: string | null
          last_message_at: string | null
          last_message_direction: string | null
          last_message_preview: string | null
          opted_out_at: string | null
          recruiter_id: string | null
          status: string | null
          telnyx_number: string
          total_messages: number | null
          twilio_number: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          candidate_id?: string | null
          candidate_phone: string
          candidate_replied?: boolean | null
          created_at?: string | null
          id?: string
          interest_detected?: boolean | null
          job_id?: string | null
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_preview?: string | null
          opted_out_at?: string | null
          recruiter_id?: string | null
          status?: string | null
          telnyx_number: string
          total_messages?: number | null
          twilio_number?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          candidate_id?: string | null
          candidate_phone?: string
          candidate_replied?: boolean | null
          created_at?: string | null
          id?: string
          interest_detected?: boolean | null
          job_id?: string | null
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_preview?: string | null
          opted_out_at?: string | null
          recruiter_id?: string | null
          status?: string | null
          telnyx_number?: string
          total_messages?: number | null
          twilio_number?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_conversations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_conversations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_conversations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_conversations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_conversations_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_conversations_telnyx_number_fkey"
            columns: ["telnyx_number"]
            isOneToOne: false
            referencedRelation: "telnyx_numbers"
            referencedColumns: ["phone_number"]
          },
        ]
      }
      sms_messages: {
        Row: {
          body: string
          conversation_id: string | null
          created_at: string | null
          delivered_at: string | null
          direction: string
          error_message: string | null
          id: string
          read_at: string | null
          sent_at: string | null
          status: string | null
          telnyx_message_id: string | null
          template_id: string | null
        }
        Insert: {
          body: string
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          direction: string
          error_message?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          telnyx_message_id?: string | null
          template_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          telnyx_message_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sms_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_optouts: {
        Row: {
          candidate_id: string | null
          id: string
          opted_out_at: string | null
          phone_number: string
          reason: string | null
          source: string | null
        }
        Insert: {
          candidate_id?: string | null
          id?: string
          opted_out_at?: string | null
          phone_number: string
          reason?: string | null
          source?: string | null
        }
        Update: {
          candidate_id?: string | null
          id?: string
          opted_out_at?: string | null
          phone_number?: string
          reason?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_optouts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_optouts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_optouts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_queue: {
        Row: {
          attempts: number | null
          campaign_id: string | null
          candidate_id: string | null
          created_at: string | null
          id: string
          job_id: string | null
          last_error: string | null
          message_body: string
          personalization_data: Json | null
          phone_to: string
          priority: number | null
          processed_at: string | null
          recruiter_id: string | null
          scheduled_for: string | null
          status: string | null
          template_id: string | null
        }
        Insert: {
          attempts?: number | null
          campaign_id?: string | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          last_error?: string | null
          message_body: string
          personalization_data?: Json | null
          phone_to: string
          priority?: number | null
          processed_at?: string | null
          recruiter_id?: string | null
          scheduled_for?: string | null
          status?: string | null
          template_id?: string | null
        }
        Update: {
          attempts?: number | null
          campaign_id?: string | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          last_error?: string | null
          message_body?: string
          personalization_data?: Json | null
          phone_to?: string
          priority?: number | null
          processed_at?: string | null
          recruiter_id?: string | null
          scheduled_for?: string | null
          status?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_queue_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_queue_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_available_now"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_queue_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "mv_platinum_tier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_queue_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_queue_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          category: string
          character_count: number | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          performance_score: number | null
          sequence_day: number | null
          template_text: string
          times_replied: number | null
          times_used: number | null
          updated_at: string | null
          variables: string[] | null
        }
        Insert: {
          category: string
          character_count?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          performance_score?: number | null
          sequence_day?: number | null
          template_text: string
          times_replied?: number | null
          times_used?: number | null
          updated_at?: string | null
          variables?: string[] | null
        }
        Update: {
          category?: string
          character_count?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          performance_score?: number | null
          sequence_day?: number | null
          template_text?: string
          times_replied?: number | null
          times_used?: number | null
          updated_at?: string | null
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      softphone_sessions: {
        Row: {
          created_at: string | null
          device_info: Json | null
          id: string
          identity: string
          last_heartbeat: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          identity: string
          last_heartbeat?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          identity?: string
          last_heartbeat?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telnyx_numbers: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          daily_limit: number | null
          friendly_name: string | null
          id: string
          last_used_at: string | null
          messages_sent_today: number | null
          messaging_profile_id: string | null
          phone_number: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          daily_limit?: number | null
          friendly_name?: string | null
          id?: string
          last_used_at?: string | null
          messages_sent_today?: number | null
          messaging_profile_id?: string | null
          phone_number: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          daily_limit?: number | null
          friendly_name?: string | null
          id?: string
          last_used_at?: string | null
          messages_sent_today?: number | null
          messaging_profile_id?: string | null
          phone_number?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telnyx_numbers_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string | null
          earned_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          badge_id?: string | null
          earned_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          badge_id?: string | null
          earned_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_signatures: {
        Row: {
          company: string
          created_at: string
          first_name: string
          full_name: string
          id: string
          phone: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string
          created_at?: string
          first_name: string
          full_name: string
          id?: string
          phone?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          first_name?: string
          full_name?: string
          id?: string
          phone?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string
          id: string
          name: string
          phone: string | null
          raw_user_meta_data: Json | null
          role: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          phone?: string | null
          raw_user_meta_data?: Json | null
          role?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          raw_user_meta_data?: Json | null
          role?: string | null
        }
        Relationships: []
      }
      voicemail_templates: {
        Row: {
          callback_rate: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          script: string
          specialty: string | null
          times_used: number | null
          updated_at: string | null
          use_for: string[] | null
          weight: number | null
        }
        Insert: {
          callback_rate?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          script: string
          specialty?: string | null
          times_used?: number | null
          updated_at?: string | null
          use_for?: string[] | null
          weight?: number | null
        }
        Update: {
          callback_rate?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          script?: string
          specialty?: string | null
          times_used?: number | null
          updated_at?: string | null
          use_for?: string[] | null
          weight?: number | null
        }
        Relationships: []
      }
      voicemails: {
        Row: {
          assigned_to: string | null
          call_sid: string | null
          candidate_id: string | null
          created_at: string | null
          duration_seconds: number | null
          from_number: string | null
          id: string
          listened_at: string | null
          notes: string | null
          recording_sid: string | null
          recording_url: string | null
          status: string | null
          to_number: string | null
          transcription: string | null
        }
        Insert: {
          assigned_to?: string | null
          call_sid?: string | null
          candidate_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          from_number?: string | null
          id?: string
          listened_at?: string | null
          notes?: string | null
          recording_sid?: string | null
          recording_url?: string | null
          status?: string | null
          to_number?: string | null
          transcription?: string | null
        }
        Update: {
          assigned_to?: string | null
          call_sid?: string | null
          candidate_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          from_number?: string | null
          id?: string
          listened_at?: string | null
          notes?: string | null
          recording_sid?: string | null
          recording_url?: string | null
          status?: string | null
          to_number?: string | null
          transcription?: string | null
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          campaign_id: string | null
          candidate_id: string | null
          combo_multiplier: number | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
          xp_awarded: number
        }
        Insert: {
          campaign_id?: string | null
          candidate_id?: string | null
          combo_multiplier?: number | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          xp_awarded: number
        }
        Update: {
          campaign_id?: string | null
          candidate_id?: string | null
          combo_multiplier?: number | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_available_now: {
        Row: {
          city: string | null
          email: string | null
          enrichment_score: number | null
          enrichment_tier: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          licenses: string[] | null
          npi: string | null
          phone: string | null
          quality_score: number | null
          specialty: string | null
          state: string | null
          status: string | null
        }
        Relationships: []
      }
      mv_platinum_tier: {
        Row: {
          airline_rewards: Json | null
          assigned_to: string | null
          availability_months: string[] | null
          board_certifications: string[] | null
          board_certified: boolean | null
          call_schedule_willing: boolean | null
          cancellations_count: number | null
          candidate_status: string | null
          caqh_password: string | null
          caqh_username: string | null
          certifications: string[] | null
          churn_risk_score: number | null
          city: string | null
          clinical_competencies: string[] | null
          compact_license: boolean | null
          company_name: string | null
          contract_breaches: number | null
          covid_vaccination_status: string | null
          created_at: string | null
          current_hourly_rate: number | null
          data_quality_score: number | null
          date_available: string | null
          dea_licenses: string[] | null
          desired_hourly_max: number | null
          desired_hourly_min: number | null
          desired_regions: string[] | null
          desired_settings: string[] | null
          desired_states: string[] | null
          email: string | null
          employment_status: string | null
          emr_systems: string[] | null
          engagement_level: string | null
          enrichment_needed: boolean | null
          enrichment_score: number | null
          enrichment_source: string | null
          enrichment_tier: string | null
          first_name: string | null
          graduation_year: number | null
          has_company_data: boolean | null
          has_credential_data: boolean | null
          has_preferences_data: boolean | null
          holiday_coverage_willing: boolean | null
          hotel_rewards: Json | null
          icu_experience: string | null
          id: string | null
          imlc_license: boolean | null
          languages: string[] | null
          last_contact_date: string | null
          last_enrichment_date: string | null
          last_name: string | null
          last_verified_date: string | null
          lead_source: string | null
          licenses: string[] | null
          lockouts: string[] | null
          monthly_shift_availability: number | null
          next_available_start_date: string | null
          no_show_incidents: number | null
          notes: string | null
          npi: string | null
          npi_verified: boolean | null
          oig_excluded: boolean | null
          owned_by: string | null
          phone: string | null
          phone_enriched: string | null
          pipeline_status: string | null
          placement_probability_score: number | null
          preferred_airline: string | null
          preferred_airport: string | null
          preferred_hotel: string | null
          preferred_rental_car: string | null
          preferred_seating: string | null
          procedures: string[] | null
          provider_class: string | null
          quality_score: number | null
          red_flags: string[] | null
          redeployment_probability: number | null
          relationship_quality_score: number | null
          reliability_score: number | null
          rental_car_rewards: Json | null
          risk_assessment_status: string | null
          schedule_preferences: string[] | null
          shift_preferences: string[] | null
          soft_deleted: boolean | null
          solo_coverage_willing: boolean | null
          source: string | null
          specialty: string | null
          state: string | null
          status: string | null
          subspecialty: string | null
          trauma_level_experience: string | null
          travel_preferences_notes: string | null
          updated_at: string | null
          us_citizen: boolean | null
          weekend_coverage_willing: boolean | null
          willing_to_license: string[] | null
          work_eligibility: string | null
          years_of_experience: number | null
          zip: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      award_cash_prize: {
        Args: {
          p_amount: number
          p_description?: string
          p_reason: string
          p_user_id: string
        }
        Returns: string
      }
      award_loot_box: {
        Args: { p_count?: number; p_tier: string; p_user_id: string }
        Returns: undefined
      }
      award_xp: {
        Args: {
          p_campaign_id?: string
          p_candidate_id?: string
          p_combo_multiplier?: number
          p_event_type: string
          p_user_id: string
          p_xp_amount: number
        }
        Returns: number
      }
      campaign_candidate_search: {
        Args: { p_job_id: string }
        Returns: {
          already_enriched: boolean
          city: string
          email: string
          enrichment_tier: string
          first_name: string
          has_personal_contact: boolean
          has_work_contact: boolean
          id: string
          last_name: string
          license_count: number
          licenses: string[]
          needs_enrichment: boolean
          personal_email: string
          personal_mobile: string
          phone: string
          score_sort: number
          specialty: string
          state: string
          unified_score: string
        }[]
      }
      check_alpha_sophia_limit: {
        Args: { p_user_id: string }
        Returns: {
          allowed: boolean
          daily_limit: number
          is_admin: boolean
          remaining: number
          used_today: number
        }[]
      }
      get_available_telnyx_number: { Args: never; Returns: string }
      get_complete_schema: { Args: never; Returns: Json }
      get_user_by_email: {
        Args: { user_email: string }
        Returns: {
          email: string
          id: string
          name: string
          phone: string
          role: string
        }[]
      }
      import_alpha_sophia_candidate: {
        Args: {
          p_city?: string
          p_email?: string
          p_external_id: string
          p_first_name: string
          p_last_name: string
          p_licenses?: string[]
          p_npi?: string
          p_phone?: string
          p_specialty?: string
          p_state?: string
        }
        Returns: string
      }
      increment_campaign_stat: {
        Args: { p_instantly_campaign_id: string; p_stat: string }
        Returns: undefined
      }
      is_candidate_enriched: {
        Args: { p_candidate_id: string }
        Returns: boolean
      }
      is_phone_opted_out: { Args: { check_phone: string }; Returns: boolean }
      log_enrichment: {
        Args: {
          p_campaign_id?: string
          p_candidate_id: string
          p_cost?: number
          p_enriched_by?: string
          p_job_id?: string
          p_personal_email?: string
          p_personal_mobile?: string
          p_source?: string
        }
        Returns: string
      }
      process_sms_optout: {
        Args: { opt_phone: string; opt_reason?: string }
        Returns: undefined
      }
      refresh_all_candidate_views: { Args: never; Returns: string }
      reset_daily_sms_counts: { Args: never; Returns: undefined }
      smart_candidate_search: {
        Args: {
          p_availability?: string
          p_min_quality_score?: number
          p_specialty: string
          p_state: string
        }
        Returns: {
          availability_status: string
          candidate_id: string
          email: string
          enrichment_tier: string
          first_name: string
          last_name: string
          licenses: string[]
          match_score: number
          phone: string
          specialty: string
        }[]
      }
      track_alpha_sophia_usage: {
        Args: {
          p_campaign_id?: string
          p_imports_count?: number
          p_job_id?: string
          p_results_count?: number
          p_search_type?: string
          p_specialty?: string
          p_state?: string
          p_user_id: string
        }
        Returns: string
      }
      upsert_candidate_job_match: {
        Args: {
          p_candidate_id: string
          p_has_required_license?: boolean
          p_icebreaker?: string
          p_job_id: string
          p_license_path?: string
          p_match_concerns?: string[]
          p_match_grade?: string
          p_match_reasons?: string[]
          p_match_score?: number
          p_research_id?: string
          p_talking_points?: string[]
        }
        Returns: string
      }
      upsert_candidate_research: {
        Args: {
          p_candidate_id: string
          p_credentials_summary?: string
          p_has_imlc?: boolean
          p_imlc_reason?: string
          p_npi?: string
          p_npi_verified?: boolean
          p_professional_highlights?: string[]
          p_research_confidence?: string
          p_researched_by?: string
          p_specialty_verified?: boolean
          p_verified_licenses?: string[]
          p_verified_specialty?: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
