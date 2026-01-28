import { useState } from "react";
import { Plus, FileText, Clock, Pin, Trash2, Edit2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, format } from "date-fns";
import { useJobNotes } from "@/hooks/useJobNotes";
import { cn } from "@/lib/utils";

interface JobNotesPanelProps {
  jobId: string;
}

export const JobNotesPanel = ({ jobId }: JobNotesPanelProps) => {
  const { notes, isLoading, addNote, updateNote, deleteNote, togglePin, currentUserId } = useJobNotes(jobId);
  const [newNote, setNewNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    const success = await addNote(newNote.trim());
    if (success) {
      setNewNote("");
      setIsAdding(false);
    }
  };

  const handleStartEdit = (noteId: string, content: string) => {
    setEditingId(noteId);
    setEditContent(content);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    
    const success = await updateNote(editingId, editContent.trim());
    if (success) {
      setEditingId(null);
      setEditContent("");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

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
            {notes.map(note => {
              const isOwner = note.created_by === currentUserId;
              const isEditing = editingId === note.id;

              return (
                <div
                  key={note.id}
                  className={cn(
                    "rounded-xl border border-border bg-card p-4 space-y-2 hover:border-primary/30 transition-colors",
                    note.is_pinned && "border-warning/30 bg-warning/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    {note.is_pinned && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        <Pin className="h-3 w-3 mr-1" />
                        Pinned
                      </Badge>
                    )}
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1 ml-auto">
                      {isOwner && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => togglePin(note.id)}
                          >
                            <Pin className={cn(
                              "h-3 w-3",
                              note.is_pinned && "text-warning"
                            )} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleStartEdit(note.id, note.content)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deleteNote(note.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[80px] resize-none"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingId(null);
                            setEditContent("");
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit}>
                          <Check className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {note.content}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-medium">{note.created_by_name || "Unknown"}</span>
                    <span>•</span>
                    <span 
                      className="flex items-center gap-1"
                      title={format(new Date(note.created_at), "PPpp")}
                    >
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default JobNotesPanel;
