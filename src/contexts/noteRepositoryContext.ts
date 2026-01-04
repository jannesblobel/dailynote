import { createContext, useContext } from "react";
import type { UseNoteRepositoryReturn } from "../hooks/useNoteRepository";

const NoteRepositoryContext = createContext<UseNoteRepositoryReturn | null>(
  null,
);

export function useNoteRepositoryContext(): UseNoteRepositoryReturn {
  const context = useContext(NoteRepositoryContext);
  if (!context) {
    throw new Error(
      "useNoteRepositoryContext must be used within NoteRepositoryProvider",
    );
  }
  return context;
}

export { NoteRepositoryContext };
