import { useNavigate } from "react-router-dom";
import { Users, Rocket, Pencil, Copy, Share2, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

interface JobQuickActionsProps {
  jobId: string;
  jobName: string;
  onRefresh?: () => void;
}

export const JobQuickActions = ({ jobId, jobName, onRefresh }: JobQuickActionsProps) => {
  const navigate = useNavigate();

  const handleClone = async () => {
    try {
      // Fetch current job data
      const { data: job, error: fetchError } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (fetchError || !job) throw new Error("Failed to fetch job");

      // Create a copy with modified name - exclude id and created_at
      const { id: _id, created_at: _created, ...jobData } = job;
      const { data: newJob, error: insertError } = await supabase
        .from("jobs")
        .insert({
          ...jobData,
          job_name: `${job.job_name} (Copy)`,
          status: "draft",
        })
        .select()
        .single();

      if (insertError || !newJob) throw new Error("Failed to clone job");

      toast({
        title: "Job Cloned",
        description: `Created "${newJob.job_name}"`,
      });

      navigate(`/jobs/${newJob.id}`);
    } catch (err) {
      console.error("Clone error:", err);
      toast({
        title: "Error",
        description: "Failed to clone job",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied",
      description: "Job link copied to clipboard",
    });
  };

  const handleArchive = async () => {
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "closed" })
        .eq("id", jobId);

      if (error) throw error;

      toast({
        title: "Job Archived",
        description: "Job has been moved to closed status",
      });

      onRefresh?.();
    } catch (err) {
      console.error("Archive error:", err);
      toast({
        title: "Error",
        description: "Failed to archive job",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        onClick={() => navigate(`/candidates/search?jobId=${jobId}`)}
      >
        <Users className="h-4 w-4 mr-2" />
        Find Candidates
      </Button>
      
      <Button
        className="bg-success hover:bg-success/90 text-success-foreground"
        onClick={() => navigate(`/candidates/matching?jobId=${jobId}`)}
      >
        <Rocket className="h-4 w-4 mr-2" />
        Create Campaign
      </Button>

      <Button
        variant="outline"
        onClick={() => navigate(`/edit-job/${jobId}`)}
      >
        <Pencil className="h-4 w-4 mr-2" />
        Edit
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <Share2 className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
          <DropdownMenuItem onClick={handleClone}>
            <Copy className="h-4 w-4 mr-2" />
            Clone Job
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Copy Link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleArchive}
            className="text-destructive focus:text-destructive"
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive Job
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default JobQuickActions;
