import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Job, ChannelConfig, SelectedCandidate } from "@/components/campaign-review/types";
import { useDraftPersistence } from "./useDraftPersistence";

// Unified storage key - replaces all legacy keys
const DRAFT_KEY = "campaign_draft_v1";
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const DB_SYNC_INTERVAL = 60000; // 60 seconds for database sync

export interface CampaignDraft {
  // Core data
  jobId: string | null;
  job: Job | null;
  candidates: SelectedCandidate[];
  channels: ChannelConfig;
  campaignName: string;
  
  // Database tracking
  databaseCampaignId: string | null;
  
  // Playbook/personalization data
  playbookData?: Record<string, unknown>;
  generatedMessages?: Record<string, unknown>;
  
  // Metadata
  lastSavedAt: string;
  currentStep: number;
  version: number;
}

const EMPTY_DRAFT: CampaignDraft = {
  jobId: null,
  job: null,
  candidates: [],
  channels: {},
  campaignName: "",
  databaseCampaignId: null,
  playbookData: undefined,
  generatedMessages: undefined,
  lastSavedAt: new Date().toISOString(),
  currentStep: 1,
  version: 1,
};

// Legacy key migration - reads from old keys and consolidates
function migrateLegacyData(): CampaignDraft | null {
  try {
    const legacyJobId = sessionStorage.getItem("campaign_job_id");
    const legacyJob = sessionStorage.getItem("campaign_job") || sessionStorage.getItem("currentJob");
    const legacyCandidates = 
      sessionStorage.getItem("campaign_candidates") || 
      sessionStorage.getItem("selectedCandidates") ||
      sessionStorage.getItem("tieredCandidates");
    const legacyChannels = 
      sessionStorage.getItem("campaign_channels") || 
      sessionStorage.getItem("channelConfig") ||
      sessionStorage.getItem("channels");
    const legacyPlaybook = sessionStorage.getItem("campaign_playbook_data");

    // Only migrate if we have meaningful data
    if (!legacyJobId && !legacyCandidates) {
      return null;
    }

    const draft: CampaignDraft = {
      jobId: legacyJobId,
      job: legacyJob ? JSON.parse(legacyJob) : null,
      candidates: legacyCandidates ? JSON.parse(legacyCandidates) : [],
      channels: legacyChannels ? normalizeChannelConfig(JSON.parse(legacyChannels)) : {},
      campaignName: "",
      databaseCampaignId: null,
      playbookData: legacyPlaybook ? JSON.parse(legacyPlaybook) : undefined,
      lastSavedAt: new Date().toISOString(),
      currentStep: determineStep(legacyJobId, legacyCandidates, legacyChannels),
      version: 1,
    };

    // Generate campaign name from job
    if (draft.job) {
      draft.campaignName = `${draft.job.specialty || draft.job.job_name || "Campaign"} - ${draft.job.facility_name || "Facility"} - ${new Date().toLocaleDateString()}`;
    }

    return draft;
  } catch (e) {
    console.error("Failed to migrate legacy data:", e);
    return null;
  }
}

// Normalize channel config from various formats
function normalizeChannelConfig(config: Record<string, unknown>): ChannelConfig {
  if (!config) return {};

  // Handle legacy format with "enabled" flags
  if (config.email && typeof config.email === "object" && "enabled" in (config.email as Record<string, unknown>)) {
    const legacy = config as {
      email?: { enabled: boolean; sender?: string; sequenceCount?: number };
      sms?: { enabled: boolean; sequenceCount?: number };
      aiCalls?: { enabled: boolean; callDay?: number };
      linkedin?: { enabled: boolean };
      schedule?: Record<string, unknown>;
    };
    
    return {
      email: legacy.email?.enabled ? {
        sender: legacy.email.sender || "",
        sequenceLength: legacy.email.sequenceCount || 4,
        gapDays: 3,
      } : undefined,
      sms: legacy.sms?.enabled ? {
        fromNumber: "",
        sequenceLength: legacy.sms.sequenceCount || 2,
      } : undefined,
      aiCall: legacy.aiCalls?.enabled ? {
        fromNumber: "",
        callDay: legacy.aiCalls.callDay || 1,
        transferTo: "",
      } : undefined,
      linkedin: legacy.linkedin?.enabled || false,
      schedule: legacy.schedule as ChannelConfig["schedule"],
    };
  }

  // Already in new format
  return config as ChannelConfig;
}

function determineStep(jobId: string | null, candidates: string | null, channels: string | null): number {
  if (channels) return 4;
  if (candidates) return 3;
  if (jobId) return 2;
  return 1;
}

// Clear all legacy keys after successful migration
function clearLegacyKeys() {
  const legacyKeys = [
    "campaign_job_id",
    "campaign_job",
    "currentJob",
    "job",
    "campaign_candidates",
    "campaign_candidate_ids",
    "selectedCandidates",
    "tieredCandidates",
    "campaign_channels",
    "channelConfig",
    "channels",
    "campaign_playbook_data",
  ];
  legacyKeys.forEach(key => sessionStorage.removeItem(key));
}

export function useCampaignDraft() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<CampaignDraft>(EMPTY_DRAFT);
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dbSyncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Database persistence hook
  const { debouncedPersist } = useDraftPersistence();

  // Load draft on mount
  useEffect(() => {
    loadDraft();
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Setup auto-save interval
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setInterval(() => {
      if (isDirty) {
        saveDraft();
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [isDirty, draft]);

  const loadDraft = useCallback(() => {
    setIsLoading(true);
    try {
      // *** FIX: Check sessionStorage FIRST (current session has priority) ***
      const sessionDraft = sessionStorage.getItem(DRAFT_KEY);
      const storedDraft = localStorage.getItem(DRAFT_KEY);
      
      let sessionData: CampaignDraft | null = null;
      let localData: CampaignDraft | null = null;
      
      if (sessionDraft) {
        try {
          sessionData = JSON.parse(sessionDraft) as CampaignDraft;
        } catch (e) {
          console.error("Failed to parse session draft:", e);
        }
      }
      
      if (storedDraft) {
        try {
          localData = JSON.parse(storedDraft) as CampaignDraft;
        } catch (e) {
          console.error("Failed to parse local draft:", e);
        }
      }
      
      // Determine which draft to use based on timestamp and data freshness
      let selectedDraft: CampaignDraft | null = null;
      
      if (sessionData && localData) {
        const sessionTime = new Date(sessionData.lastSavedAt).getTime();
        const localTime = new Date(localData.lastSavedAt).getTime();
        
        // Use whichever is more recent
        if (sessionTime >= localTime) {
          selectedDraft = sessionData;
          console.log("[useCampaignDraft] Using sessionStorage (newer):", sessionData.candidates.length, "candidates");
        } else {
          // Check if localStorage is stale (older than 1 hour compared to session)
          const hoursDiff = (localTime - sessionTime) / (1000 * 60 * 60);
          if (hoursDiff < 1 && sessionData.candidates.length > 0) {
            // Session has candidates but local doesn't - prefer session
            selectedDraft = sessionData;
            console.log("[useCampaignDraft] Using sessionStorage (has candidates):", sessionData.candidates.length);
          } else {
            selectedDraft = localData;
            console.log("[useCampaignDraft] Using localStorage:", localData.candidates.length, "candidates");
          }
        }
      } else if (sessionData) {
        selectedDraft = sessionData;
        console.log("[useCampaignDraft] Using sessionStorage only:", sessionData.candidates.length, "candidates");
      } else if (localData) {
        const savedTime = new Date(localData.lastSavedAt);
        const hoursSinceSave = (Date.now() - savedTime.getTime()) / (1000 * 60 * 60);
        
        // Only use localStorage if less than 24 hours old
        if (hoursSinceSave < 24 && (localData.jobId || localData.candidates.length > 0)) {
          selectedDraft = localData;
          console.log("[useCampaignDraft] Using localStorage (within 24h):", localData.candidates.length, "candidates");
        }
      }
      
      if (selectedDraft && (selectedDraft.jobId || selectedDraft.candidates.length > 0)) {
        setDraft(selectedDraft);
        setLastSaved(new Date(selectedDraft.lastSavedAt));
        syncToLegacyKeys(selectedDraft);
        setIsLoading(false);
        return;
      }

      // Try to migrate legacy data as fallback
      const migrated = migrateLegacyData();
      if (migrated && (migrated.jobId || migrated.candidates.length > 0)) {
        console.log("[useCampaignDraft] Migrated legacy data:", migrated.candidates.length, "candidates");
        setDraft(migrated);
        setShowRecoveryPrompt(true);
        saveDraftToStorage(migrated);
        clearLegacyKeys();
      }
    } catch (e) {
      console.error("Failed to load draft:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveDraftToStorage = useCallback((draftToSave: CampaignDraft) => {
    const updated = {
      ...draftToSave,
      lastSavedAt: new Date().toISOString(),
    };
    
    // Save to both storages
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
    localStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
    
    // Sync to legacy keys for backward compatibility
    syncToLegacyKeys(updated);
    
    setLastSaved(new Date());
    setIsDirty(false);
  }, []);

  const saveDraft = useCallback(() => {
    saveDraftToStorage(draft);
    console.log("[useCampaignDraft] Auto-saved draft");
  }, [draft, saveDraftToStorage]);

  // Sync to legacy keys for backward compatibility with other pages
  const syncToLegacyKeys = (d: CampaignDraft) => {
    if (d.jobId) {
      sessionStorage.setItem("campaign_job_id", d.jobId);
    }
    if (d.job) {
      sessionStorage.setItem("campaign_job", JSON.stringify(d.job));
    }
    if (d.candidates.length > 0) {
      sessionStorage.setItem("campaign_candidates", JSON.stringify(d.candidates));
      sessionStorage.setItem("campaign_candidate_ids", JSON.stringify(d.candidates.map(c => c.id)));
    }
    if (Object.keys(d.channels).length > 0) {
      sessionStorage.setItem("campaign_channels", JSON.stringify(d.channels));
    }
    if (d.playbookData) {
      sessionStorage.setItem("campaign_playbook_data", JSON.stringify(d.playbookData));
    }
  };

  // Update functions
  const updateJob = useCallback((job: Job | null, jobId?: string) => {
    setDraft(prev => ({
      ...prev,
      job,
      jobId: jobId || job?.id || prev.jobId,
      campaignName: job 
        ? `${job.specialty || job.job_name || "Campaign"} - ${job.facility_name || "Facility"} - ${new Date().toLocaleDateString()}`
        : prev.campaignName,
      currentStep: Math.max(prev.currentStep, 1),
    }));
    setIsDirty(true);
  }, []);

  const updateCandidates = useCallback((candidates: SelectedCandidate[]) => {
    setDraft(prev => {
      const updated = {
        ...prev,
        candidates,
        currentStep: Math.max(prev.currentStep, 2),
      };
      // Trigger database sync when candidates change
      if (updated.jobId && candidates.length > 0) {
        debouncedPersist({
          jobId: updated.jobId,
          candidates,
          campaignName: updated.campaignName,
          databaseCampaignId: updated.databaseCampaignId,
        }, (campaignId) => {
          if (campaignId && !updated.databaseCampaignId) {
            setDraft(d => ({ ...d, databaseCampaignId: campaignId }));
          }
        });
      }
      return updated;
    });
    setIsDirty(true);
  }, [debouncedPersist]);

  const updateChannels = useCallback((channels: ChannelConfig) => {
    setDraft(prev => ({
      ...prev,
      channels,
      currentStep: Math.max(prev.currentStep, 3),
    }));
    setIsDirty(true);
  }, []);

  const updateCampaignName = useCallback((name: string) => {
    setDraft(prev => ({ ...prev, campaignName: name }));
    setIsDirty(true);
  }, []);

  const updatePlaybookData = useCallback((data: Record<string, unknown>) => {
    setDraft(prev => ({ ...prev, playbookData: data }));
    setIsDirty(true);
  }, []);

  const updateGeneratedMessages = useCallback((messages: Record<string, unknown>) => {
    setDraft(prev => ({ ...prev, generatedMessages: messages }));
    setIsDirty(true);
  }, []);

  const setCurrentStep = useCallback((step: number) => {
    setDraft(prev => ({ ...prev, currentStep: step }));
    setIsDirty(true);
  }, []);

  const clearDraft = useCallback(() => {
    // Clear unified storage
    sessionStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_KEY);
    
    // Clear legacy keys
    clearLegacyKeys();
    
    // Reset state
    setDraft(EMPTY_DRAFT);
    setIsDirty(false);
    setLastSaved(null);
  }, []);

  const dismissRecovery = useCallback(() => {
    setShowRecoveryPrompt(false);
  }, []);

  const recoverDraft = useCallback(() => {
    setShowRecoveryPrompt(false);
    toast.success("Draft recovered! Continuing where you left off.");
    
    // Navigate to the appropriate step
    const routes = ["/campaigns/new", "/campaigns/new/candidates", "/campaigns/new/channels", "/campaigns/new/review"];
    const targetRoute = routes[Math.min(draft.currentStep - 1, routes.length - 1)];
    navigate(targetRoute);
  }, [draft.currentStep, navigate]);

  const discardAndStartFresh = useCallback(() => {
    clearDraft();
    setShowRecoveryPrompt(false);
    toast.info("Starting fresh campaign");
    navigate("/campaigns/new");
  }, [clearDraft, navigate]);

  // Force save (for manual save button)
  const forceSave = useCallback(() => {
    saveDraftToStorage(draft);
    toast.success("Draft saved");
  }, [draft, saveDraftToStorage]);

  return {
    // State
    draft,
    isLoading,
    isDirty,
    lastSaved,
    showRecoveryPrompt,
    
    // Update functions
    updateJob,
    updateCandidates,
    updateChannels,
    updateCampaignName,
    updatePlaybookData,
    updateGeneratedMessages,
    setCurrentStep,
    
    // Actions
    saveDraft: forceSave,
    clearDraft,
    dismissRecovery,
    recoverDraft,
    discardAndStartFresh,
    
    // Convenience getters
    job: draft.job,
    jobId: draft.jobId,
    candidates: draft.candidates,
    channels: draft.channels,
    campaignName: draft.campaignName,
    currentStep: draft.currentStep,
  };
}
