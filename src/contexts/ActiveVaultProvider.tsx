import { type ReactNode } from "react";
import { ActiveVaultContext } from "./activeVaultContext";
import type { UseActiveVaultReturn } from "../hooks/useActiveVault";

interface ActiveVaultProviderProps {
  value: UseActiveVaultReturn;
  children: ReactNode;
}

export function ActiveVaultProvider({
  value,
  children,
}: ActiveVaultProviderProps) {
  return (
    <ActiveVaultContext.Provider value={value}>
      {children}
    </ActiveVaultContext.Provider>
  );
}
