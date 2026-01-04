import { type ReactNode } from "react";
import { NoteRepositoryContext } from "./noteRepositoryContext";
import type { UseNoteRepositoryReturn } from "../hooks/useNoteRepository";

interface NoteRepositoryProviderProps {
  value: UseNoteRepositoryReturn;
  children: ReactNode;
}

export function NoteRepositoryProvider({
  value,
  children,
}: NoteRepositoryProviderProps) {
  return (
    <NoteRepositoryContext.Provider value={value}>
      {children}
    </NoteRepositoryContext.Provider>
  );
}
