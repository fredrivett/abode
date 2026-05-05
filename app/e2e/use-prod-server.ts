export const useProdServer =
  process.env.E2E_USE_BUILD === "1" || !!process.env.CI;
