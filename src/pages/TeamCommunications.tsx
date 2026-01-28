import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Users, MessageSquare, Phone, Clock, ArrowUpRight, Shield, ChevronRight } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { cn } from "@/lib/utils";

const TeamCommunications = () => {
  const { user } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sms" | "calls">("sms");

  // Redirect non-admins
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/communications");
    }
  }, [isAdmin, roleLoading, navigate]);

  // Fetch all team members
  const { data: teamMembers = [], isLoading: teamLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email")
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Fetch all SMS conversations (admin sees all via RLS)
  const { data: allConversations = [], isLoading: convsLoading } = useQuery({
    queryKey: ["team-sms-conversations", selectedRecruiterId],
    queryFn: async () => {
      let query = supabase
        .from("sms_conversations")
        .select(`
          id,
          candidate_phone,
          contact_name,
          last_message_at,
          last_message_preview,
          unread_count,
          recruiter_id,
          interest_detected,
          candidates (
            first_name,
            last_name
          )
        `)
        .order("last_message_at", { ascending: false })
        .limit(200);

      if (selectedRecruiterId) {
        query = query.eq("recruiter_id", selectedRecruiterId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Fetch all AI call logs (admin sees all via RLS)
  const { data: allCalls = [], isLoading: callsLoading } = useQuery({
    queryKey: ["team-ai-calls", selectedRecruiterId],
    queryFn: async () => {
      let query = supabase
        .from("ai_call_logs")
        .select(`
          id,
          candidate_name,
          phone_number,
          call_result,
          created_at,
          duration_seconds,
          call_type,
          recruiter_id,
          recruiter_name
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (selectedRecruiterId) {
        query = query.eq("recruiter_id", selectedRecruiterId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Group conversations by recruiter
  const conversationsByRecruiter = allConversations.reduce((acc: Record<string, any[]>, conv: any) => {
    const recruiterId = conv.recruiter_id || "unassigned";
    if (!acc[recruiterId]) acc[recruiterId] = [];
    acc[recruiterId].push(conv);
    return acc;
  }, {});

  // Group calls by recruiter
  const callsByRecruiter = allCalls.reduce((acc: Record<string, any[]>, call: any) => {
    const recruiterId = call.recruiter_id || "unassigned";
    if (!acc[recruiterId]) acc[recruiterId] = [];
    acc[recruiterId].push(call);
    return acc;
  }, {});

  // Stats per recruiter
  const recruiterStats = teamMembers.map((member: any) => {
    const convs = conversationsByRecruiter[member.id] || [];
    const calls = callsByRecruiter[member.id] || [];
    const unread = convs.reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0);
    const interested = convs.filter((c: any) => c.interest_detected).length +
                       calls.filter((c: any) => c.call_result === "interested").length;
    
    return {
      ...member,
      totalConversations: convs.length,
      totalCalls: calls.length,
      unreadCount: unread,
      interestedCount: interested,
    };
  });

  const getRecruiterName = (id: string | null) => {
    if (!id) return "Unassigned";
    const member = teamMembers.find((m: any) => m.id === id);
    return member?.name || member?.email?.split("@")[0] || "Unknown";
  };

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Skeleton className="h-12 w-48" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const isLoading = teamLoading || convsLoading || callsLoading;

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-foreground">
                  Team Communications
                </h1>
                <p className="text-sm text-muted-foreground">
                  Monitor all recruiter messaging activity
                </p>
              </div>
            </div>

            {/* Recruiter filter */}
            <Select
              value={selectedRecruiterId || "all"}
              onValueChange={(v) => setSelectedRecruiterId(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[200px]">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All recruiters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Recruiters</SelectItem>
                {teamMembers.map((member: any) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name || member.email?.split("@")[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Recruiter stats */}
          <div className="w-[280px] flex-shrink-0 border-r border-border p-4 overflow-auto">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Team Overview</h3>
            <div className="space-y-2">
              {recruiterStats.map((stat: any) => (
                <Card
                  key={stat.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/50",
                    selectedRecruiterId === stat.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => setSelectedRecruiterId(selectedRecruiterId === stat.id ? null : stat.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm truncate">
                        {stat.name || stat.email?.split("@")[0]}
                      </span>
                      {stat.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5">
                          {stat.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {stat.totalConversations}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {stat.totalCalls}
                      </span>
                      {stat.interestedCount > 0 && (
                        <Badge variant="outline" className="text-[10px] border-success/30 text-success">
                          {stat.interestedCount} interested
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Right: Activity feed */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sms" | "calls")} className="flex flex-col h-full">
              <div className="flex-shrink-0 px-4 pt-4">
                <TabsList>
                  <TabsTrigger value="sms" className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    SMS ({allConversations.length})
                  </TabsTrigger>
                  <TabsTrigger value="calls" className="gap-2">
                    <Phone className="h-4 w-4" />
                    Calls ({allCalls.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="sms" className="flex-1 overflow-hidden m-0 p-4">
                <ScrollArea className="h-full">
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : allConversations.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No SMS conversations found</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allConversations.map((conv: any) => {
                        const candidate = conv.candidates;
                        const name = candidate
                          ? `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim()
                          : conv.contact_name || formatPhoneNumber(conv.candidate_phone);

                        return (
                          <Card
                            key={conv.id}
                            className="hover:border-primary/50 transition-colors cursor-pointer"
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm truncate">
                                      {name || "Unknown"}
                                    </span>
                                    {conv.unread_count > 0 && (
                                      <Badge variant="destructive" className="text-[10px] px-1.5">
                                        {conv.unread_count}
                                      </Badge>
                                    )}
                                    {conv.interest_detected && (
                                      <Badge variant="outline" className="text-[10px] border-success/30 text-success">
                                        Interested
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate mb-1">
                                    {conv.last_message_preview || "No messages"}
                                  </p>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <Badge variant="secondary" className="text-[10px]">
                                      {getRecruiterName(conv.recruiter_id)}
                                    </Badge>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-2.5 w-2.5" />
                                      {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                                    </span>
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="calls" className="flex-1 overflow-hidden m-0 p-4">
                <ScrollArea className="h-full">
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : allCalls.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Phone className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No call logs found</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allCalls.map((call: any) => {
                        const duration = call.duration_seconds
                          ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, "0")}`
                          : null;

                        return (
                          <Card
                            key={call.id}
                            className="hover:border-primary/50 transition-colors cursor-pointer"
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm truncate">
                                      {call.candidate_name || formatPhoneNumber(call.phone_number) || "Unknown"}
                                    </span>
                                    {call.call_result === "interested" && (
                                      <Badge variant="outline" className="text-[10px] border-success/30 text-success">
                                        Interested
                                      </Badge>
                                    )}
                                    {call.call_result === "callback_requested" && (
                                      <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
                                        Callback
                                      </Badge>
                                    )}
                                    {duration && (
                                      <span className="text-xs text-muted-foreground">
                                        {duration}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground capitalize mb-1">
                                    {call.call_result?.replace(/_/g, " ") || call.call_type || "Call"}
                                  </p>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <Badge variant="secondary" className="text-[10px]">
                                      {call.recruiter_name || getRecruiterName(call.recruiter_id)}
                                    </Badge>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-2.5 w-2.5" />
                                      {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                                    </span>
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TeamCommunications;
