import { useState, useCallback, useEffect, useRef } from "react";

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 300;

export function useUndoHistory<T>(initialState: T) {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [pointer, setPointer] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUndoingRef = useRef(false);

  const current = history[pointer];

  const pushState = useCallback((newState: T) => {
    if (isUndoingRef.current) {
      isUndoingRef.current = false;
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setHistory(prev => {
        const trimmed = prev.slice(0, pointer + 1);
        const updated = [...trimmed, newState];
        if (updated.length > MAX_HISTORY) {
          updated.shift();
          return updated;
        }
        return updated;
      });
      setPointer(prev => Math.min(prev + 1, MAX_HISTORY - 1));
    }, DEBOUNCE_MS);
  }, [pointer]);

  const undo = useCallback(() => {
    if (pointer > 0) {
      isUndoingRef.current = true;
      setPointer(prev => prev - 1);
      return history[pointer - 1];
    }
    return undefined;
  }, [pointer, history]);

  const redo = useCallback(() => {
    if (pointer < history.length - 1) {
      isUndoingRef.current = true;
      setPointer(prev => prev + 1);
      return history[pointer + 1];
    }
    return undefined;
  }, [pointer, history]);

  const canUndo = pointer > 0;
  const canRedo = pointer < history.length - 1;

  const reset = useCallback((state: T) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setHistory([state]);
    setPointer(0);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { current, pushState, undo, redo, canUndo, canRedo, reset };
}
