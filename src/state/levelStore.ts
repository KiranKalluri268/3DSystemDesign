import { create } from 'zustand';

export interface LevelState {
  /** null means no level chosen yet — the level-select screen shows instead of the board. */
  currentLevelId: string | null;
  selectLevel: (id: string) => void;
  exitToLevelSelect: () => void;
}

/**
 * Just an id, not the Level object itself — components look it up via
 * getLevel so this store doesn't duplicate level data or need updating
 * whenever a level's content changes.
 */
export const useLevel = create<LevelState>((set) => ({
  currentLevelId: null,
  selectLevel: (id) => set({ currentLevelId: id }),
  exitToLevelSelect: () => set({ currentLevelId: null }),
}));
