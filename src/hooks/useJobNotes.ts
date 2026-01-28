import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";

export interface JobNote {
  id: string;
  job_id: string;
  content: string;
  created_by: string;
  created_by_name: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export function useJobNotes(jobId: string) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!jobId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("job_notes")
        .select("*")
        .eq("job_id", jobId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes((data as JobNote[]) || []);
    } catch (err) {
      console.error("Error fetching job notes:", err);
      toast({
        title: "Error",
        description: "Failed to load notes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = async (content: string): Promise<boolean> => {
    if (!user || !jobId) return false;

    try {
      // Get user's display name
      const userName = user.user_metadata?.full_name || 
                       user.user_metadata?.name || 
                       user.email?.split("@")[0] || 
                       "Unknown User";

      const { data, error } = await supabase
        .from("job_notes")
        .insert({
          job_id: jobId,
          content,
          created_by: user.id,
          created_by_name: userName,
        })
        .select()
        .single();

      if (error) throw error;

      setNotes((prev) => [data as JobNote, ...prev]);
      toast({
        title: "Note added",
        description: "Your note has been saved",
      });
      return true;
    } catch (err) {
      console.error("Error adding note:", err);
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateNote = async (noteId: string, content: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("job_notes")
        .update({ content })
        .eq("id", noteId);

      if (error) throw error;

      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, content } : n))
      );
      return true;
    } catch (err) {
      console.error("Error updating note:", err);
      toast({
        title: "Error",
        description: "Failed to update note",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteNote = async (noteId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("job_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast({
        title: "Note deleted",
        description: "The note has been removed",
      });
      return true;
    } catch (err) {
      console.error("Error deleting note:", err);
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
      return false;
    }
  };

  const togglePin = async (noteId: string): Promise<boolean> => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return false;

    try {
      const { error } = await supabase
        .from("job_notes")
        .update({ is_pinned: !note.is_pinned })
        .eq("id", noteId);

      if (error) throw error;

      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId ? { ...n, is_pinned: !n.is_pinned } : n
        )
      );
      return true;
    } catch (err) {
      console.error("Error toggling pin:", err);
      return false;
    }
  };

  return {
    notes,
    isLoading,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
    refetch: fetchNotes,
    currentUserId: user?.id,
  };
}
