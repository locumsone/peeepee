import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  number: number;
  label: string;
}

interface StepIndicatorProps {
  currentStep: number;
  steps: Step[];
}

const StepIndicator = ({ currentStep, steps }: StepIndicatorProps) => {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-center">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-all duration-300",
                  currentStep > step.number
                    ? "gradient-primary border-transparent text-primary-foreground shadow-md"
                    : currentStep === step.number
                    ? "border-primary bg-primary/10 text-primary shadow-glow"
                    : "border-muted bg-muted text-muted-foreground"
                )}
              >
                {currentStep > step.number ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={cn(
                  "mt-2 text-xs font-medium transition-colors duration-300",
                  currentStep >= step.number
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 w-12 sm:w-20 md:w-32 rounded-full transition-all duration-500",
                  currentStep > step.number
                    ? "gradient-primary"
                    : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StepIndicator;
