import { createContext, useContext } from "react";
import type { UseActiveVaultReturn } from "../hooks/useActiveVault";

const ActiveVaultContext = createContext<UseActiveVaultReturn | null>(null);

export function useActiveVaultContext(): UseActiveVaultReturn {
  const context = useContext(ActiveVaultContext);
  if (!context) {
    throw new Error(
      "useActiveVaultContext must be used within ActiveVaultProvider",
    );
  }
  return context;
}

export { ActiveVaultContext };
