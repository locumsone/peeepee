import { useEffect, useState } from "react";
import { Users, Clock, MessageSquare, ThumbsUp, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PipelineStage {
  name: string;
  count: number;
  icon: React.ElementType;
  color: string;
}

export function DashboardPipeline() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPipeline();
  }, []);

  const fetchPipeline = async () => {
    try {
      const { data } = await supabase
        .from("campaign_leads_v2")
        .select("status");

      const statusCounts: Record<string, number> = {
        pending: 0,
        contacted: 0,
        interested: 0,
        placed: 0,
      };

      data?.forEach(lead => {
        const status = lead.status?.toLowerCase() || "pending";
        if (status in statusCounts) {
          statusCounts[status]++;
        } else if (status === "replied" || status === "engaged") {
          statusCounts.interested++;
        } else {
          statusCounts.pending++;
        }
      });

      setStages([
        { name: "Pending", count: statusCounts.pending, icon: Clock, color: "text-muted-foreground" },
        { name: "Contacted", count: statusCounts.contacted, icon: MessageSquare, color: "text-blue-500" },
        { name: "Interested", count: statusCounts.interested, icon: ThumbsUp, color: "text-emerald-500" },
        { name: "Placed", count: statusCounts.placed, icon: Award, color: "text-amber-500" },
      ]);
    } catch (error) {
      console.error("Error fetching pipeline:", error);
    } finally {
      setLoading(false);
    }
  };

  const total = stages.reduce((sum, s) => sum + s.count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[120px] text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[120px] text-muted-foreground">
        <Users className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">No leads in pipeline</p>
        <p className="text-xs mt-1">Launch a campaign to start tracking</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Visual bar */}
      <div className="h-3 flex rounded-full overflow-hidden bg-secondary">
        {stages.map((stage, i) => {
          const width = total > 0 ? (stage.count / total) * 100 : 0;
          if (width === 0) return null;
          const colors = ["bg-muted", "bg-blue-500", "bg-emerald-500", "bg-amber-500"];
          return (
            <div
              key={stage.name}
              className={`${colors[i]} transition-all duration-500`}
              style={{ width: `${width}%` }}
            />
          );
        })}
      </div>

      {/* Stage counts */}
      <div className="grid grid-cols-4 gap-2">
        {stages.map((stage) => (
          <div key={stage.name} className="text-center">
            <div className="flex items-center justify-center mb-1">
              <stage.icon className={`h-4 w-4 ${stage.color}`} />
            </div>
            <p className="text-lg font-bold text-foreground">{stage.count}</p>
            <p className="text-xs text-muted-foreground">{stage.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
