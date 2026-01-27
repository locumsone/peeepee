import { useState } from "react";
import { Search, LayoutGrid, LayoutList, GitBranch, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "./CampaignHealthIndicator";

export type FilterTab = "all" | "active" | "paused" | "completed" | "draft";
export type ViewMode = "list" | "kanban" | "pipeline";

interface CampaignFiltersProps {
  activeFilter: FilterTab;
  onFilterChange: (filter: FilterTab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  healthFilter: HealthStatus | null;
  onHealthFilterChange: (health: HealthStatus | null) => void;
  channelFilter: string | null;
  onChannelFilterChange: (channel: string | null) => void;
}

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "completed", label: "Completed" },
  { key: "draft", label: "Draft" },
];

export const CampaignFilters = ({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  healthFilter,
  onHealthFilterChange,
  channelFilter,
  onChannelFilterChange,
}: CampaignFiltersProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      {/* Left: View Mode Toggle + Filter Tabs */}
      <div className="flex items-center gap-4">
        {/* View Mode Toggle */}
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/50">
          <button
            onClick={() => onViewModeChange("list")}
            className={cn(
              "p-2 rounded-md transition-all",
              viewMode === "list"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="List View"
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            onClick={() => onViewModeChange("kanban")}
            className={cn(
              "p-2 rounded-md transition-all",
              viewMode === "kanban"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Kanban View"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => onViewModeChange("pipeline")}
            className={cn(
              "p-2 rounded-md transition-all",
              viewMode === "pipeline"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Pipeline View"
          >
            <GitBranch className="h-4 w-4" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/50">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onFilterChange(tab.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                activeFilter === tab.key
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Search + Additional Filters */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {/* Additional Filters Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9",
                (healthFilter || channelFilter) && "border-primary text-primary"
              )}
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
              {(healthFilter || channelFilter) && (
                <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5">
                  {[healthFilter, channelFilter].filter(Boolean).length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Health Status</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onHealthFilterChange(null)}>
              All Health
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onHealthFilterChange("healthy")}>
              <span className="w-2 h-2 rounded-full bg-success mr-2" />
              Healthy
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onHealthFilterChange("warning")}>
              <span className="w-2 h-2 rounded-full bg-warning mr-2" />
              Needs Attention
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onHealthFilterChange("critical")}>
              <span className="w-2 h-2 rounded-full bg-destructive mr-2" />
              Critical
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuLabel>Channel</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onChannelFilterChange(null)}>
              All Channels
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onChannelFilterChange("email")}>
              Email Only
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onChannelFilterChange("sms")}>
              SMS Only
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onChannelFilterChange("multi")}>
              Multi-channel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns or jobs..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
      </div>
    </div>
  );
};
