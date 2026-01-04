import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import StepIndicator from "./StepIndicator";
import { UserMenu } from "./UserMenu";

interface LayoutProps {
  children: ReactNode;
  currentStep?: number;
  showSteps?: boolean;
}

const steps = [
  { number: 1, label: "Job Entry" },
  { number: 2, label: "Match Candidates" },
  { number: 3, label: "Build Campaign" },
  { number: 4, label: "Launch" },
];

const Layout = ({ children, currentStep = 1, showSteps = true }: LayoutProps) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full gradient-subtle">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-50 h-14 flex items-center justify-between border-b border-border/50 bg-card/80 backdrop-blur-xl px-4">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4" />
              <span className="text-sm text-muted-foreground">Campaign Builder</span>
            </div>
            <UserMenu />
          </header>
          
          <main className="flex-1 p-6">
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
