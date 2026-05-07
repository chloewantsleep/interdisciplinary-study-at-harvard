"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Network, Search, Sparkles, ArrowRight, BookMarked } from "lucide-react";
import type { Course } from "@/lib/types";
import { SCHOOL_COLORS, SCHOOL_FULL } from "@/lib/types";
import { useSaved, getSavedCourses } from "@/lib/useSaved";

export default function Dashboard({ courses }: { courses: Course[] }) {
  const { savedIds, toggle } = useSaved();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const saved = mounted ? getSavedCourses(courses, savedIds) : [];
  const schoolsSeen = new Set(saved.map((c) => c.school));
  const labelsSeen = new Set(saved.flatMap((c) => c.keywordList));

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">

      {/* Hero */}
      <section>
        <p className="text-xs font-semibold text-red-700 uppercase tracking-widest mb-2">Harvard University · Course Registration</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Discover learning beyond your school.
        </h1>
        <p className="text-gray-500 max-w-lg leading-relaxed">
          Browse 6,042 courses across 8 Harvard Schools, visualize your interdisciplinary journey, and get AI-powered recommendations for courses.
        </p>
      </section>

      {/* Feature cards */}
      <section className="grid sm:grid-cols-3 gap-4">
        {[
          {
            href: "/explore",
            icon: Search,
            label: "Explore Courses",
            desc: "Search and filter 6,042 courses across FAS, GSD, HBS, HDS, HGSE, HKS, HLS, and HSPH.",
            accent: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            href: "/graph",
            icon: Network,
            label: "Knowledge Graph",
            desc: "See how your course labels connect. Add courses you've taken to visualize your learning map.",
            accent: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            href: "/suggest",
            icon: Sparkles,
            label: "AI Advisor",
            desc: "Describe your goals and get personalized interdisciplinary course recommendations from Claude.",
            accent: "text-amber-600",
            bg: "bg-amber-50",
          },
        ].map(({ href, icon: Icon, label, desc, accent, bg }) => (
          <Link key={href} href={href}
            className="group bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all">
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-4`}>
              <Icon className={`w-4 h-4 ${accent}`} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-red-700 transition-colors">{label}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${accent}`}>
              Open <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        ))}
      </section>

      {/* Saved courses */}
      {mounted && saved.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Saved Courses</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {schoolsSeen.size} school{schoolsSeen.size !== 1 ? "s" : ""} · {labelsSeen.size} topic labels
              </p>
            </div>
            <Link href="/graph" className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:underline">
              <Network className="w-3.5 h-3.5" /> View as graph
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((c) => {
              const col = SCHOOL_COLORS[c.school];
              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${col?.bg} ${col?.text} ${col?.border}`}>
                      {c.school}
                    </span>
                    <button onClick={() => toggle(c.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">
                      ×
                    </button>
                  </div>
                  <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">{c.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{[c.semester, c.year].filter(Boolean).join(" ")} · {c.credits} cr</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state nudge */}
      {mounted && saved.length === 0 && (
        <section className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <BookMarked className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600 mb-1">No saved courses yet</p>
          <p className="text-xs text-gray-400 mb-4">Save courses from Explore to build your knowledge graph</p>
          <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline">
            <Search className="w-3.5 h-3.5" /> Browse courses
          </Link>
        </section>
      )}

      {/* Schools */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Schools Open for Cross-Registration</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(SCHOOL_FULL).map(([code, name]) => {
            const c = SCHOOL_COLORS[code];
            const count = courses.filter((x) => x.school === code).length;
            return (
              <Link key={code} href={`/explore?school=${code}`}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm hover:border-gray-300 transition-all">
                <div className={`text-lg font-bold ${c?.text ?? "text-gray-700"} mb-0.5`}>{code}</div>
                <div className="text-xs text-gray-500 mb-1 leading-tight">{name}</div>
                <div className="text-xs text-gray-400">{count.toLocaleString()} courses</div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
