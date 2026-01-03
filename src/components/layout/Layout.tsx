import { ReactNode } from "react";
import Header from "./Header";
import StepIndicator from "./StepIndicator";

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
    <div className="min-h-screen gradient-subtle">
      <Header />
      
      <main className="container mx-auto px-4 pb-12">
        {showSteps && (
          <StepIndicator currentStep={currentStep} steps={steps} />
        )}
        
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
