"use client";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";

const KEY = "harvard-planner-taken";

export function useTaken() {
  const { user, isLoaded } = useUser();
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoaded) return;

    if (user) {
      // Signed in: load from API (cloud source of truth)
      fetch("/api/user-courses?type=taken")
        .then((r) => r.json())
        .then(({ ids }: { ids: string[] }) => {
          setTakenIds(new Set(ids));
        })
        .catch(() => {
          try {
            const raw = localStorage.getItem(KEY);
            if (raw) setTakenIds(new Set(JSON.parse(raw)));
          } catch {}
        });
    } else {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) setTakenIds(new Set(JSON.parse(raw)));
      } catch {}
    }
  }, [user, isLoaded]);

  const toggle = useCallback((id: string) => {
    setTakenIds((prev) => {
      const next = new Set(prev);
      const adding = !next.has(id);
      adding ? next.add(id) : next.delete(id);

      if (user) {
        fetch("/api/user-courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "taken", id, action: adding ? "add" : "remove" }),
        });
      } else {
        try { localStorage.setItem(KEY, JSON.stringify(Array.from(next))); } catch {}
      }

      return next;
    });
  }, [user]);

  const isTaken = useCallback((id: string) => takenIds.has(id), [takenIds]);

  return { takenIds, toggle, isTaken };
}
