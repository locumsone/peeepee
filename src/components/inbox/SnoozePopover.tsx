import { useState } from "react";
import { Clock, Sun, Calendar as CalendarIcon, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addHours, addDays, setHours, setMinutes, nextMonday, format } from "date-fns";

interface SnoozePopoverProps {
  onSnooze: (date: Date, note?: string) => void;
  trigger?: React.ReactNode;
  currentReminder?: Date | null;
}

export const SnoozePopover = ({ onSnooze, trigger, currentReminder }: SnoozePopoverProps) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [customTime, setCustomTime] = useState("09:00");
  const [isOpen, setIsOpen] = useState(false);

  const handleQuickSnooze = (date: Date) => {
    onSnooze(date);
    setIsOpen(false);
  };

  const handleCustomSnooze = () => {
    if (!customDate) return;
    const [hours, minutes] = customTime.split(":").map(Number);
    const finalDate = setMinutes(setHours(customDate, hours), minutes);
    onSnooze(finalDate);
    setIsOpen(false);
    setShowCustom(false);
  };

  const getLaterToday = () => {
    const now = new Date();
    return addHours(now, 3);
  };

  const getTomorrowMorning = () => {
    const tomorrow = addDays(new Date(), 1);
    return setMinutes(setHours(tomorrow, 9), 0);
  };

  const getNextWeek = () => {
    const monday = nextMonday(new Date());
    return setMinutes(setHours(monday, 9), 0);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            <Clock className="h-3 w-3" />
            {currentReminder ? format(currentReminder, "MMM d") : "Snooze"}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        {!showCustom ? (
          <div className="space-y-1">
            <button
              onClick={() => handleQuickSnooze(getLaterToday())}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left text-sm transition-colors"
            >
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">Later Today</div>
                <div className="text-xs text-muted-foreground">
                  {format(getLaterToday(), "h:mm a")}
                </div>
              </div>
              <kbd className="text-[10px] px-1.5 py-0.5 bg-muted rounded">H</kbd>
            </button>

            <button
              onClick={() => handleQuickSnooze(getTomorrowMorning())}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left text-sm transition-colors"
            >
              <Sun className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">Tomorrow Morning</div>
                <div className="text-xs text-muted-foreground">
                  {format(getTomorrowMorning(), "EEE, MMM d")} at 9:00 AM
                </div>
              </div>
              <kbd className="text-[10px] px-1.5 py-0.5 bg-muted rounded">T</kbd>
            </button>

            <button
              onClick={() => handleQuickSnooze(getNextWeek())}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left text-sm transition-colors"
            >
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">Next Week</div>
                <div className="text-xs text-muted-foreground">
                  {format(getNextWeek(), "EEE, MMM d")} at 9:00 AM
                </div>
              </div>
              <kbd className="text-[10px] px-1.5 py-0.5 bg-muted rounded">W</kbd>
            </button>

            <div className="border-t border-border my-1" />

            <button
              onClick={() => setShowCustom(true)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left text-sm transition-colors"
            >
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 font-medium">Custom...</div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => setShowCustom(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
            
            <Calendar
              mode="single"
              selected={customDate}
              onSelect={setCustomDate}
              disabled={(date) => date < new Date()}
              className={cn("p-0 pointer-events-auto")}
            />
            
            <div className="flex gap-2">
              <Input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                onClick={handleCustomSnooze}
                disabled={!customDate}
                className="h-8"
              >
                Set
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
