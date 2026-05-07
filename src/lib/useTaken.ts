"use client";
import { useState, useEffect, useCallback } from "react";

const KEY = "harvard-planner-taken";

export function useTaken() {
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setTakenIds(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  const toggle = useCallback((id: string) => {
    setTakenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }, []);

  const isTaken = useCallback((id: string) => takenIds.has(id), [takenIds]);

  return { takenIds, toggle, isTaken };
}
