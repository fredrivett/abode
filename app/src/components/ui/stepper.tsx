"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
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
  const [height, setHeight] = useState(0);

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
      className="relative overflow-hidden"
      animate={{ height: height || "auto" }}
      transition={{ type: "spring", duration: 0.4 }}
    >
      <AnimatePresence mode="sync" custom={direction} initial={false}>
        <SlideTransition
          key={currentStep}
          direction={direction}
          variants={variants}
          onHeightReady={setHeight}
        >
          {children}
        </SlideTransition>
      </AnimatePresence>
    </motion.div>
  );
}

function SlideTransition({
  children,
  direction,
  variants,
  onHeightReady,
}: {
  children: React.ReactNode;
  direction: number;
  variants: {
    enter: (direction: number) => { x: number; opacity: number };
    center: { x: number; opacity: number };
    exit: (direction: number) => { x: number; opacity: number };
  };
  onHeightReady: (height: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: children triggers re-measurement when content changes
  useLayoutEffect(() => {
    if (containerRef.current) {
      onHeightReady(containerRef.current.offsetHeight);
    }
  }, [children, onHeightReady]);

  return (
    <motion.div
      ref={containerRef}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="absolute inset-x-0 top-0 py-8"
    >
      {children}
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
  showKeyboardHints = false,
}: {
  className?: string;
  backLabel?: string;
  nextLabel?: string;
  completeLabel?: string;
  showKeyboardHints?: boolean;
}) {
  const { currentStep, totalSteps, handleNext, handleBack, handleComplete } =
    useStepper();

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && !isFirstStep) {
        e.preventDefault();
        handleBack();
      } else if (e.key === "ArrowRight" && !isLastStep) {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && isLastStep) {
        e.preventDefault();
        handleComplete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFirstStep, isLastStep, handleBack, handleNext, handleComplete]);

  return (
    <div className={cn("flex flex-col gap-4 pt-4", className)}>
      <div className="flex justify-between">
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
      {showKeyboardHints && (
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          {!isFirstStep && (
            <span className="flex items-center gap-1.5">
              <Kbd>←</Kbd> Back
            </span>
          )}
          {!isLastStep && (
            <span className="flex items-center gap-1.5">
              <Kbd>→</Kbd> Next
            </span>
          )}
          {isLastStep && (
            <span className="flex items-center gap-1.5">
              <Kbd>⌘</Kbd>
              <Kbd>↵</Kbd> Get started
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { Stepper, Step, StepperNavigation, useStepper };
