import { createContext, useContext } from "react";
import type { UseAppModeReturn } from "../hooks/useAppMode";

const AppModeContext = createContext<UseAppModeReturn | null>(null);

export function useAppModeContext(): UseAppModeReturn {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error("useAppModeContext must be used within AppModeProvider");
  }
  return context;
}

export { AppModeContext };
