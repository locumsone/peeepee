import { useState } from "react";
import { Plus, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";

interface JobNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
  isPinned?: boolean;
}

interface JobNotesPanelProps {
  jobId: string;
}

// Mock notes for now - would connect to database in production
const MOCK_NOTES: JobNote[] = [
  {
    id: "1",
    content: "Client prefers candidates with fellowship training. Must have at least 2 years of locums experience.",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    createdBy: "John Smith",
    isPinned: true,
  },
  {
    id: "2",
    content: "Spoke with facility - they are flexible on start date if right candidate is found.",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: "Jane Doe",
  },
];

export const JobNotesPanel = ({ jobId }: JobNotesPanelProps) => {
  const [notes, setNotes] = useState<JobNote[]>(MOCK_NOTES);
  const [newNote, setNewNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    
    const note: JobNote = {
      id: Date.now().toString(),
      content: newNote.trim(),
      createdAt: new Date().toISOString(),
      createdBy: "Current User", // Would use actual user
    };
    
    setNotes([note, ...notes]);
    setNewNote("");
    setIsAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Internal Notes</h3>
          <p className="text-sm text-muted-foreground">
            Private notes about this job (visible to team only)
          </p>
        </div>
        <Button 
          size="sm" 
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Note
        </Button>
      </div>

      {/* Add Note Form */}
      {isAdding && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Textarea
            placeholder="Type your note here..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="min-h-[100px] resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setNewNote("");
              }}
            >
              Cancel
            </Button>
            <Button 
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote.trim()}
            >
              Save Note
            </Button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Notes Yet</h3>
          <p>Add internal notes about this job for your team</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 pr-4">
            {notes.map(note => (
              <div
                key={note.id}
                className="rounded-xl border border-border bg-card p-4 space-y-2 hover:border-primary/30 transition-colors"
              >
                {note.isPinned && (
                  <Badge variant="secondary" className="text-xs">
                    📌 Pinned
                  </Badge>
                )}
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {note.content}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-medium">{note.createdBy}</span>
                  <span>•</span>
                  <span 
                    className="flex items-center gap-1"
                    title={format(new Date(note.createdAt), "PPpp")}
                  >
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default JobNotesPanel;
