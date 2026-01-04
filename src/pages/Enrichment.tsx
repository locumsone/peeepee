import { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Loader2, CheckCircle, CreditCard, Zap, Trash2, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow, startOfDay } from "date-fns";

interface EnrichmentQueueItem {
  id: string;
  candidate_id: string;
  status: string;
  signal_type: string;
  priority: number;
  created_at: string;
  processed_at: string | null;
  error_message: string | null;
  cost: number | null;
  api_response: any;
  candidate?: {
    first_name: string | null;
    last_name: string | null;
    specialty: string | null;
    state: string | null;
    city: string | null;
  };
}

export default function Enrichment() {
  const [activeTab, setActiveTab] = useState("queue");
  const [queueItems, setQueueItems] = useState<EnrichmentQueueItem[]>([]);
  const [historyItems, setHistoryItems] = useState<EnrichmentQueueItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkAction, setBulkAction] = useState<"selected" | "all">("selected");
  
  // Stats
  const [pendingCount, setPendingCount] = useState(0);
  const [processingCount, setProcessingCount] = useState(0);
  const [completedTodayCount, setCompletedTodayCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch queue items (pending, processing, failed)
      const { data: queueData, error: queueError } = await supabase
        .from("enrichment_queue")
        .select(`
          *,
          candidate:candidates(first_name, last_name, specialty, state, city)
        `)
        .in("status", ["pending", "processing", "failed"])
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });

      if (queueError) throw queueError;
      setQueueItems((queueData as any[]) || []);

      // Fetch history items (completed)
      const { data: historyData, error: historyError } = await supabase
        .from("enrichment_queue")
        .select(`
          *,
          candidate:candidates(first_name, last_name, specialty, state, city)
        `)
        .eq("status", "completed")
        .order("processed_at", { ascending: false })
        .limit(100);

      if (historyError) throw historyError;
      setHistoryItems((historyData as any[]) || []);

      // Fetch stats
      const { count: pending } = await supabase
        .from("enrichment_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      setPendingCount(pending || 0);

      const { count: processing } = await supabase
        .from("enrichment_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "processing");
      setProcessingCount(processing || 0);

      const todayStart = startOfDay(new Date()).toISOString();
      const { count: completedToday } = await supabase
        .from("enrichment_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("processed_at", todayStart);
      setCompletedTodayCount(completedToday || 0);

    } catch (error) {
      console.error("Error fetching enrichment data:", error);
      toast.error("Failed to load enrichment data");
    } finally {
      setLoading(false);
    }
  };

  const handleEnrichNow = async (item: EnrichmentQueueItem) => {
    if (!item.candidate) {
      toast.error("Candidate data not found");
      return;
    }

    setEnrichingIds(prev => new Set(prev).add(item.id));
    
    try {
      const { data, error } = await supabase.functions.invoke("enrich-contact", {
        body: {
          physician_id: item.candidate_id,
          first_name: item.candidate.first_name || "",
          last_name: item.candidate.last_name || "",
          city: item.candidate.city || "",
          state: item.candidate.state || "",
          specialty: item.candidate.specialty || "",
        },
      });

      if (error) throw error;
      
      toast.success("Enrichment completed successfully");
      fetchData();
    } catch (error: any) {
      console.error("Enrichment error:", error);
      toast.error(error.message || "Enrichment failed");
    } finally {
      setEnrichingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("enrichment_queue")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Removed from queue");
      setQueueItems(prev => prev.filter(item => item.id !== id));
      setSelectedItems(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setPendingCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error removing item:", error);
      toast.error("Failed to remove item");
    }
  };

  const handleBulkEnrich = async () => {
    const itemsToEnrich = bulkAction === "all" 
      ? queueItems.filter(i => i.status === "pending")
      : queueItems.filter(i => selectedItems.has(i.id) && i.status === "pending");

    setShowBulkConfirm(false);
    
    for (const item of itemsToEnrich) {
      await handleEnrichNow(item);
    }
    
    setSelectedItems(new Set());
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === queueItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(queueItems.map(i => i.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pending</Badge>;
      case "processing":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Processing</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Failed</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCandidateName = (item: EnrichmentQueueItem) => {
    if (!item.candidate) return "Unknown";
    return `${item.candidate.first_name || ""} ${item.candidate.last_name || ""}`.trim() || "Unknown";
  };

  const pendingItemsCount = queueItems.filter(i => i.status === "pending").length;
  const selectedPendingCount = queueItems.filter(i => selectedItems.has(i.id) && i.status === "pending").length;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contact Enrichment</h1>
            <p className="text-muted-foreground">Manage contact data enrichment queue</p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
              <Loader2 className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{processingCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedTodayCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Check Whitepages</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="queue">Queue ({queueItems.length})</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            {activeTab === "queue" && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedPendingCount === 0}
                  onClick={() => {
                    setBulkAction("selected");
                    setShowBulkConfirm(true);
                  }}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Enrich Selected ({selectedPendingCount})
                </Button>
                <Button
                  size="sm"
                  disabled={pendingItemsCount === 0}
                  onClick={() => {
                    setBulkAction("all");
                    setShowBulkConfirm(true);
                  }}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Enrich All Pending
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="queue" className="mt-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={queueItems.length > 0 && selectedItems.size === queueItems.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Candidate Name</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : queueItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No items in queue
                      </TableCell>
                    </TableRow>
                  ) : (
                    queueItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleSelectItem(item.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{getCandidateName(item)}</TableCell>
                        <TableCell>{item.candidate?.specialty || "-"}</TableCell>
                        <TableCell>{item.candidate?.state || "-"}</TableCell>
                        <TableCell>{getStatusBadge(item.status || "pending")}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={enrichingIds.has(item.id) || item.status === "processing"}
                              onClick={() => handleEnrichNow(item)}
                            >
                              {enrichingIds.has(item.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Zap className="h-4 w-4 mr-1" />
                                  Enrich Now
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRemove(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate Name</TableHead>
                    <TableHead>Phone Found</TableHead>
                    <TableHead>Email Found</TableHead>
                    <TableHead>Enriched At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : historyItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No enrichment history
                      </TableCell>
                    </TableRow>
                  ) : (
                    historyItems.map((item) => {
                      const response = item.api_response || {};
                      const phoneFound = response.phone || response.personal_mobile || "-";
                      const emailFound = response.email || response.personal_email || "-";
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{getCandidateName(item)}</TableCell>
                          <TableCell>
                            {phoneFound !== "-" ? (
                              <span className="text-green-600">{phoneFound}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {emailFound !== "-" ? (
                              <span className="text-green-600">{emailFound}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.processed_at ? format(new Date(item.processed_at), "MMM d, yyyy h:mm a") : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Bulk Confirm Dialog */}
        <AlertDialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Bulk Enrichment</AlertDialogTitle>
              <AlertDialogDescription>
                This will use {bulkAction === "all" ? pendingItemsCount : selectedPendingCount} credits to enrich {bulkAction === "all" ? "all pending" : "selected"} candidates. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkEnrich}>
                Enrich {bulkAction === "all" ? pendingItemsCount : selectedPendingCount} Candidates
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
