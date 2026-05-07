"use client";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import type { Course } from "./types";

const KEY = "harvard-planner-saved";

export function useSaved() {
  const { user, isLoaded } = useUser();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoaded) return;

    if (user) {
      // Signed in: load from API (cloud source of truth)
      fetch("/api/user-courses?type=saved")
        .then((r) => r.json())
        .then(({ ids }: { ids: string[] }) => {
          setSavedIds(new Set(ids));
        })
        .catch(() => {
          // Fallback to localStorage on network error
          try {
            const raw = localStorage.getItem(KEY);
            if (raw) setSavedIds(new Set(JSON.parse(raw)));
          } catch {}
        });
    } else {
      // Not signed in: use localStorage
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) setSavedIds(new Set(JSON.parse(raw)));
      } catch {}
    }
  }, [user, isLoaded]);

  const toggle = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      const adding = !next.has(id);
      adding ? next.add(id) : next.delete(id);

      if (user) {
        // Sync to cloud (fire-and-forget)
        fetch("/api/user-courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "saved", id, action: adding ? "add" : "remove" }),
        });
      } else {
        // Persist locally
        try { localStorage.setItem(KEY, JSON.stringify(Array.from(next))); } catch {}
      }

      return next;
    });
  }, [user]);

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
