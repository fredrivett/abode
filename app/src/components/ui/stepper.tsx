"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StepperContextValue = {
  currentStep: number;
  direction: number;
  totalSteps: number;
  handleNext: () => void;
  handleBack: () => void;
  handleComplete: () => void;
};

const StepperContext = createContext<StepperContextValue | null>(null);

function useStepper() {
  const context = useContext(StepperContext);
  if (!context) {
    throw new Error("useStepper must be used within a Stepper");
  }
  return context;
}

type StepperProps = {
  children: React.ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onComplete?: () => void;
  className?: string;
};

function Stepper({
  children,
  initialStep = 0,
  onStepChange,
  onComplete,
  className,
}: StepperProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(0);

  const { steps, otherChildren } = useMemo(() => {
    const stepArray: React.ReactNode[] = [];
    const otherArray: React.ReactNode[] = [];

    // Flatten the children array - .map() in JSX returns nested arrays
    const childArray = Array.isArray(children) ? children.flat() : [children];

    for (const child of childArray) {
      if (
        child &&
        typeof child === "object" &&
        "type" in child &&
        child.type === Step
      ) {
        stepArray.push(child);
      } else if (child) {
        otherArray.push(child);
      }
    }

    return { steps: stepArray, otherChildren: otherArray };
  }, [children]);

  const totalSteps = steps.length;

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setDirection(1);
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep);
    }
  }, [currentStep, totalSteps, onStepChange]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1);
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep);
    }
  }, [currentStep, onStepChange]);

  const handleComplete = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  const contextValue = useMemo(
    () => ({
      currentStep,
      direction,
      totalSteps,
      handleNext,
      handleBack,
      handleComplete,
    }),
    [
      currentStep,
      direction,
      totalSteps,
      handleNext,
      handleBack,
      handleComplete,
    ],
  );

  return (
    <StepperContext.Provider value={contextValue}>
      <div className={cn("flex flex-col", className)}>
        <StepperIndicator />
        <StepperContent>{steps[currentStep]}</StepperContent>
        {otherChildren}
      </div>
    </StepperContext.Provider>
  );
}

function StepperIndicator() {
  const { currentStep, totalSteps } = useStepper();

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: totalSteps }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Static array of step indicators
        <div key={index} className="flex items-center gap-2">
          <motion.div
            className={cn(
              "flex size-2.5 items-center justify-center rounded-full transition-colors",
              index === currentStep
                ? "bg-primary"
                : index < currentStep
                  ? "bg-primary/60"
                  : "bg-muted-foreground/30",
            )}
            initial={false}
            animate={{
              scale: index === currentStep ? 1.2 : 1,
            }}
            transition={{ duration: 0.2 }}
          />
          {index < totalSteps - 1 && (
            <div
              className={cn(
                "h-0.5 w-6 rounded-full transition-colors",
                index < currentStep
                  ? "bg-primary/60"
                  : "bg-muted-foreground/30",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function StepperContent({ children }: { children: React.ReactNode }) {
  const { direction, currentStep } = useStepper();

  const variants = {
    enter: (direction: number) => ({
      x: direction >= 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction >= 0 ? -50 : 50,
      opacity: 0,
    }),
  };

  return (
    <motion.div
      className="relative overflow-hidden py-8"
      layout
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={currentStep}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function StepperNavigation({
  className,
  backLabel = "Back",
  nextLabel = "Next",
  completeLabel = "Complete",
}: {
  className?: string;
  backLabel?: string;
  nextLabel?: string;
  completeLabel?: string;
}) {
  const { currentStep, totalSteps, handleNext, handleBack, handleComplete } =
    useStepper();

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className={cn("flex justify-between pt-4", className)}>
      <div>
        {!isFirstStep && (
          <Button variant="ghost-subtle" onClick={handleBack}>
            {backLabel}
          </Button>
        )}
      </div>
      <Button onClick={isLastStep ? handleComplete : handleNext}>
        {isLastStep ? completeLabel : nextLabel}
      </Button>
    </div>
  );
}

export { Stepper, Step, StepperNavigation, useStepper };
