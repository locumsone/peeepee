import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import StepIndicator from "./StepIndicator";
import { UserMenu } from "./UserMenu";
import { AutoSaveIndicator } from "@/components/campaign-review/AutoSaveIndicator";

interface LayoutProps {
  children: ReactNode;
  currentStep?: number;
  showSteps?: boolean;
  // Auto-save state props
  lastSaved?: Date | null;
  isDirty?: boolean;
  isSaving?: boolean;
}

const steps = [
  { number: 1, label: "Job Entry" },
  { number: 2, label: "Match Candidates" },
  { number: 3, label: "Build Campaign" },
  { number: 4, label: "Launch" },
];

const Layout = ({ children, currentStep = 1, showSteps = true, lastSaved, isDirty, isSaving }: LayoutProps) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Xbox-style header with clean lines */}
          <header className="sticky top-0 z-50 h-14 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded-md" />
              <div className="h-4 w-px bg-border" />
              <span className="text-sm font-medium text-muted-foreground">Campaign Builder</span>
              {/* Auto-save indicator in header */}
              {lastSaved !== undefined && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <AutoSaveIndicator 
                    lastSaved={lastSaved} 
                    isDirty={isDirty ?? false}
                    isSaving={isSaving}
                  />
                </>
              )}
            </div>
            <UserMenu />
          </header>
          
          <main className="flex-1 p-6 bg-background">
            {showSteps && (
              <StepIndicator currentStep={currentStep} steps={steps} />
            )}
            
            <div className="animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
