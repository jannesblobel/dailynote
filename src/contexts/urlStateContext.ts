import { createContext, useContext } from "react";
import type { UrlState } from "../hooks/useUrlState";

const UrlStateContext = createContext<UrlState | null>(null);

export function useUrlStateContext(): UrlState {
  const context = useContext(UrlStateContext);
  if (!context) {
    throw new Error("useUrlStateContext must be used within UrlStateProvider");
  }
  return context;
}

export { UrlStateContext };
