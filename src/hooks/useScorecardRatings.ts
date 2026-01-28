import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ScorecardRating {
  id: string;
  job_id: string;
  candidate_id: string;
  attribute_id: string;
  value: number | boolean;
  evaluated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface UseScorecardRatingsResult {
  ratings: Record<string, Record<string, number | boolean>>;
  isLoading: boolean;
  setRating: (candidateId: string, attributeId: string, value: number | boolean) => Promise<void>;
  resetRatings: (candidateId: string) => Promise<void>;
  resetAllRatings: () => Promise<void>;
}

export const useScorecardRatings = (jobId: string): UseScorecardRatingsResult => {
  const [ratings, setRatings] = useState<Record<string, Record<string, number | boolean>>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Fetch ratings on mount
  useEffect(() => {
    if (!jobId) return;

    const fetchRatings = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("candidate_scorecard_ratings")
          .select("*")
          .eq("job_id", jobId);

        if (error) throw error;

        // Transform to nested map
        const ratingsMap: Record<string, Record<string, number | boolean>> = {};
        (data || []).forEach((rating) => {
          if (!ratingsMap[rating.candidate_id]) {
            ratingsMap[rating.candidate_id] = {};
          }
          // Parse JSONB value
          const val = rating.value as { v: number | boolean };
          ratingsMap[rating.candidate_id][rating.attribute_id] = val.v;
        });

        setRatings(ratingsMap);
      } catch (err) {
        console.error("Error fetching scorecard ratings:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRatings();
  }, [jobId]);

  const setRating = useCallback(async (
    candidateId: string, 
    attributeId: string, 
    value: number | boolean
  ) => {
    // Optimistic update
    setRatings(prev => ({
      ...prev,
      [candidateId]: {
        ...prev[candidateId],
        [attributeId]: value,
      },
    }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("candidate_scorecard_ratings")
        .upsert({
          job_id: jobId,
          candidate_id: candidateId,
          attribute_id: attributeId,
          value: { v: value },
          evaluated_by: user?.id || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "job_id,candidate_id,attribute_id",
        });

      if (error) throw error;
    } catch (err) {
      console.error("Error saving rating:", err);
      // Revert optimistic update
      setRatings(prev => {
        const updated = { ...prev };
        if (updated[candidateId]) {
          delete updated[candidateId][attributeId];
        }
        return updated;
      });
      toast({
        title: "Error",
        description: "Failed to save rating",
        variant: "destructive",
      });
    }
  }, [jobId]);

  const resetRatings = useCallback(async (candidateId: string) => {
    try {
      const { error } = await supabase
        .from("candidate_scorecard_ratings")
        .delete()
        .eq("job_id", jobId)
        .eq("candidate_id", candidateId);

      if (error) throw error;

      setRatings(prev => {
        const updated = { ...prev };
        delete updated[candidateId];
        return updated;
      });

      toast({ title: "Ratings reset for candidate" });
    } catch (err) {
      console.error("Error resetting ratings:", err);
      toast({
        title: "Error",
        description: "Failed to reset ratings",
        variant: "destructive",
      });
    }
  }, [jobId]);

  const resetAllRatings = useCallback(async () => {
    try {
      const { error } = await supabase
        .from("candidate_scorecard_ratings")
        .delete()
        .eq("job_id", jobId);

      if (error) throw error;

      setRatings({});
      toast({ title: "All scorecard ratings reset" });
    } catch (err) {
      console.error("Error resetting all ratings:", err);
      toast({
        title: "Error",
        description: "Failed to reset ratings",
        variant: "destructive",
      });
    }
  }, [jobId]);

  return {
    ratings,
    isLoading,
    setRating,
    resetRatings,
    resetAllRatings,
  };
};
