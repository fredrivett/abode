import { useEffect, useState } from "react";

import styles from "./loading-ellipsis.module.css";

interface LoadingEllipsisProps {
  // Use JavaScript version instead of CSS (default false),
  // needed for use in ShinyText which uses `background-clip: text`
  js?: boolean;
}

export const LoadingEllipsis = ({ js = false }: LoadingEllipsisProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!js) return; // Only run interval for JS version

    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % 4); // 4 states total
    }, 500);

    return () => clearInterval(interval);
  }, [js]);

  const states = [
    "\u00A0\u00A0\u00A0", // 3 non-breaking spaces
    ".\u00A0\u00A0", // dot + 2 non-breaking spaces
    "..\u00A0", // 2 dots + non-breaking space
    "...", // 3 dots
  ];

  // JavaScript version
  if (js)
    return (
      <span className={styles.loadingContainer}>{states[currentStep]}</span>
    );

  // CSS version (default)
  return (
    <span>
      <span className={`${styles.dot} ${styles["animate-dot1"]}`}>.</span>
      <span className={`${styles.dot} ${styles["animate-dot2"]}`}>.</span>
      <span className={`${styles.dot} ${styles["animate-dot3"]}`}>.</span>
    </span>
  );
};
