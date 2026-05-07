"use client";
import { useState, useEffect, useCallback } from "react";
import type { Course } from "./types";

const KEY = "harvard-planner-saved";

export function useSaved() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSavedIds(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  const toggle = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSavedIds(new Set());
    try { localStorage.removeItem(KEY); } catch {}
  }, []);

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  return { savedIds, toggle, clear, isSaved };
}

export function getSavedCourses(courses: Course[], savedIds: Set<string>): Course[] {
  return courses.filter((c) => savedIds.has(c.id));
}
