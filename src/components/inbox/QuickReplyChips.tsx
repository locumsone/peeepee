import { cn } from "@/lib/utils";

interface QuickReplyChipsProps {
  onSelect: (text: string) => void;
  rate?: string | null;
}

const defaultChips = [
  { label: "Availability?", text: "What does your availability look like over the next few weeks?" },
  { label: "Schedule call", text: "Would you have 10 minutes for a quick call to discuss the details?" },
  { label: "Let me check", text: "Let me check on that and get back to you shortly." },
  { label: "Send details", text: "I'll send over the full details via email. What's the best address?" },
];

export const QuickReplyChips = ({ onSelect, rate }: QuickReplyChipsProps) => {
  const chips = rate 
    ? [{ label: `Rate: ${rate}`, text: `The rate for this position is ${rate}.` }, ...defaultChips]
    : defaultChips;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2 border-t border-border bg-muted/30">
      {chips.map((chip) => (
        <button
          key={chip.label}
          onClick={() => onSelect(chip.text)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-full",
            "bg-secondary text-secondary-foreground",
            "hover:bg-primary/10 hover:text-primary",
            "transition-colors border border-border hover:border-primary/30"
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
};
