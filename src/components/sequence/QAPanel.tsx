import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Edit3,
  Mail,
  MessageSquare,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CandidateMessage {
  id: string;
  first_name?: string;
  last_name?: string;
  specialty?: string;
  email_subject?: string;
  email_body?: string;
  sms_message?: string;
  approved?: boolean;
}

interface QAPanelProps {
  candidates: CandidateMessage[];
  onApprove: (candidateId: string) => void;
  onApproveAll: () => void;
  onUpdateMessage: (candidateId: string, field: 'email_subject' | 'email_body' | 'sms_message', value: string) => void;
}

// Banned words for spam detection
const BANNED_WORDS = [
  'urgent', 'limited time', 'act now', 'don\'t miss', 'exclusive offer',
  'amazing', 'incredible', 'exciting', 'fantastic', 'rockstar', 'ninja',
  '!!!', '???', '💰', '🔥', '🚀'
];

function detectSpamIssues(text: string): string[] {
  if (!text) return [];
  const issues: string[] = [];
  const lowerText = text.toLowerCase();
  
  BANNED_WORDS.forEach(word => {
    if (lowerText.includes(word.toLowerCase())) {
      issues.push(`Contains "${word}"`);
    }
  });

  // Check for excessive punctuation
  if ((text.match(/!/g) || []).length > 1) {
    issues.push("Multiple exclamation marks");
  }

  return issues;
}

function getMessageStatus(candidate: CandidateMessage): {
  status: 'ready' | 'warning' | 'missing';
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check for missing content
  if (!candidate.email_body && !candidate.sms_message) {
    return { status: 'missing', issues: ['No messages generated'] };
  }

  // Check email
  if (candidate.email_body) {
    const emailIssues = detectSpamIssues(candidate.email_body);
    if (candidate.email_subject) {
      emailIssues.push(...detectSpamIssues(candidate.email_subject));
    }
    issues.push(...emailIssues);
  }

  // Check SMS
  if (candidate.sms_message) {
    const smsIssues = detectSpamIssues(candidate.sms_message);
    if (candidate.sms_message.length > 160) {
      smsIssues.push(`SMS too long (${candidate.sms_message.length}/160)`);
    }
    issues.push(...smsIssues);
  }

  if (issues.length > 0) {
    return { status: 'warning', issues };
  }

  return { status: 'ready', issues: [] };
}

export function QAPanel({
  candidates,
  onApprove,
  onApproveAll,
  onUpdateMessage,
}: QAPanelProps) {
  const [editingCandidate, setEditingCandidate] = useState<CandidateMessage | null>(null);
  const [previewCandidate, setPreviewCandidate] = useState<CandidateMessage | null>(null);

  const approvedCount = candidates.filter(c => c.approved).length;
  const readyCount = candidates.filter(c => getMessageStatus(c).status === 'ready').length;
  const warningCount = candidates.filter(c => getMessageStatus(c).status === 'warning').length;

  const handleSaveEdit = () => {
    setEditingCandidate(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                QA Review Queue
              </CardTitle>
              <CardDescription className="mt-1">
                Review and approve messages before sending
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {readyCount} ready
                </span>
                {warningCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    {warningCount} warnings
                  </span>
                )}
              </div>
              <Button
                size="sm"
                onClick={onApproveAll}
                disabled={approvedCount === candidates.length}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve All ({approvedCount}/{candidates.length})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>SMS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => {
                  const { status, issues } = getMessageStatus(candidate);
                  
                  return (
                    <TableRow key={candidate.id}>
                      <TableCell>
                        <Checkbox
                          checked={candidate.approved}
                          onCheckedChange={() => onApprove(candidate.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            Dr. {candidate.last_name}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {candidate.specialty}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {candidate.email_body ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {candidate.email_subject || 'No subject'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {candidate.sms_message ? (
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-green-500" />
                            <span className={cn(
                              "text-xs",
                              candidate.sms_message.length > 160 
                                ? "text-destructive" 
                                : "text-muted-foreground"
                            )}>
                              {candidate.sms_message.length}/160
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge
                                variant={
                                  status === 'ready' ? 'default' :
                                  status === 'warning' ? 'secondary' : 'destructive'
                                }
                                className={cn(
                                  "text-xs",
                                  status === 'ready' && "bg-green-500/10 text-green-600 border-green-500/30",
                                  status === 'warning' && "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                )}
                              >
                                {status === 'ready' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                {status === 'warning' && <AlertTriangle className="h-3 w-3 mr-1" />}
                                {status === 'missing' && <XCircle className="h-3 w-3 mr-1" />}
                                {status === 'ready' ? 'Ready' : status === 'warning' ? 'Review' : 'Missing'}
                              </Badge>
                            </TooltipTrigger>
                            {issues.length > 0 && (
                              <TooltipContent>
                                <ul className="text-xs space-y-1">
                                  {issues.map((issue, i) => (
                                    <li key={i}>• {issue}</li>
                                  ))}
                                </ul>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setPreviewCandidate(candidate)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingCandidate(candidate)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewCandidate} onOpenChange={() => setPreviewCandidate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Message Preview - Dr. {previewCandidate?.last_name}
            </DialogTitle>
            <DialogDescription>
              Review the generated messages for this candidate
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {previewCandidate?.email_body && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  Email
                </Label>
                <div className="p-4 rounded-lg bg-secondary/30 border space-y-2">
                  <p className="font-medium text-sm">
                    Subject: {previewCandidate.email_subject}
                  </p>
                  <div className="text-sm whitespace-pre-wrap">
                    {previewCandidate.email_body}
                  </div>
                </div>
              </div>
            )}

            {previewCandidate?.sms_message && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-500" />
                  SMS ({previewCandidate.sms_message.length}/160)
                </Label>
                <div className="p-4 rounded-lg bg-secondary/30 border">
                  <p className="text-sm">{previewCandidate.sms_message}</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCandidate} onOpenChange={() => setEditingCandidate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Messages - Dr. {editingCandidate?.last_name}
            </DialogTitle>
            <DialogDescription>
              Modify the generated messages before approval
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Email Subject</Label>
              <Input
                value={editingCandidate?.email_subject || ''}
                onChange={(e) => editingCandidate && onUpdateMessage(
                  editingCandidate.id, 
                  'email_subject', 
                  e.target.value
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Email Body</Label>
              <Textarea
                value={editingCandidate?.email_body || ''}
                onChange={(e) => editingCandidate && onUpdateMessage(
                  editingCandidate.id, 
                  'email_body', 
                  e.target.value
                )}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>SMS Message</Label>
                <span className={cn(
                  "text-xs",
                  (editingCandidate?.sms_message?.length || 0) > 160 
                    ? "text-destructive" 
                    : "text-muted-foreground"
                )}>
                  {editingCandidate?.sms_message?.length || 0}/160
                </span>
              </div>
              <Textarea
                value={editingCandidate?.sms_message || ''}
                onChange={(e) => editingCandidate && onUpdateMessage(
                  editingCandidate.id, 
                  'sms_message', 
                  e.target.value
                )}
                className="min-h-[80px] font-mono text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditingCandidate(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
