"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X, BookOpen, ChevronDown, ExternalLink, CheckCircle, LayoutGrid, Network } from "lucide-react";
import type { Course } from "@/lib/types";
import { SCHOOL_COLORS, SCHOOL_FULL } from "@/lib/types";
import { useSaved } from "@/lib/useSaved";
import { useTaken } from "@/lib/useTaken";
import dynamic from "next/dynamic";

const ExploreGraph = dynamic(() => import("./ExploreGraph"), { ssr: false });

const SEMESTERS = ["Fall", "Spring", "Summer", "Winter", "Fall-Spring", "Fall-Winter", "Winter-Spring"];
const PAGE_SIZE = 30;

const CLUSTER_COLORS: Record<string, string> = {
  "Policy & Governance": "#3b82f6",
  "Law & Justice": "#6366f1",
  "Science & Tech": "#8b5cf6",
  "Health": "#10b981",
  "Arts & Culture": "#f59e0b",
  "Design & Environment": "#84cc16",
  "Society & Economics": "#f97316",
  "Cross-cutting": "#ec4899",
};

const LABEL_CLUSTER: Record<string, string> = Object.fromEntries(
  Object.entries({
    "Policy & Governance": ["policy analysis","regulatory policy","public policy","governance","democracy","comparative politics","political science","international relations","global governance","immigration","human rights","data governance","energy policy","environmental policy","housing policy"],
    "Law & Justice": ["constitutional law","civil rights law","international law","administrative law","corporate law","criminal justice","environmental law","property law","legal technology","social justice","racial equity","gender equity"],
    "Science & Tech": ["mathematics","physics","chemistry","biology & genetics","computer science","artificial intelligence","neuroscience","quantitative methods","biostatistics","cybersecurity","digital media"],
    "Health": ["public health","global health","health policy","infectious disease","epidemiology","mental health","nutrition & health","environmental health"],
    "Arts & Culture": ["arts & humanities","cultural heritage","linguistics","theology","religion","religious history","Hebrew Bible","history","philosophy","anthropology","sociology"],
    "Design & Environment": ["ecology","climate change","architecture","urban design","landscape architecture","urban planning","design research","sustainability","water resources","infrastructure","historic preservation"],
    "Society & Economics": ["economics","inequality","leadership","psychology","learning sciences","education policy","entrepreneurship","finance","marketing","behavioral economics","organizational behavior","operations management","strategy","economic development","urban economics","community development","global development","public finance","curriculum design","qualitative research","negotiation","accounting"],
    "Cross-cutting": ["interdisciplinary studies","ethics"],
  }).flatMap(([cl, labels]) => labels.map((l) => [l, cl]))
);

function getLabelColor(label: string) {
  return CLUSTER_COLORS[LABEL_CLUSTER[label] ?? "Cross-cutting"] ?? "#94a3b8";
}

function SchoolBadge({ school }: { school: string }) {
  const c = SCHOOL_COLORS[school] ?? { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      {school}
    </span>
  );
}

function CourseModal({ course, onClose, isSaved, onToggle, isTaken, onToggleTaken }: {
  course: Course; onClose: () => void; isSaved: boolean; onToggle: () => void;
  isTaken: boolean; onToggleTaken: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SchoolBadge school={course.school} />
              <span className="text-xs text-gray-400">{course.id}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{course.name}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onToggleTaken}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isTaken ? "bg-slate-200 text-slate-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}>
              <CheckCircle className="w-3.5 h-3.5" />
              {isTaken ? "Taken" : "Mark taken"}
            </button>
            <button
              onClick={onToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isSaved ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {isSaved ? "Saved" : "Save"}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["School", SCHOOL_FULL[course.school] ?? course.school],
              ["Semester", [course.semester, course.year].filter(Boolean).join(" ") || "—"],
              ["Credits", course.credits || "—"],
              ["Type", course.type || "—"],
              ["Mode", course.mode || "—"],
              ["Schedule", course.schedule || "—"],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                <div className="font-medium text-gray-900">{value}</div>
              </div>
            ))}
          </div>

          {course.instructor && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Instructor(s)</div>
              <p className="text-sm text-gray-700">{course.instructor}</p>
            </div>
          )}
          {course.description && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</div>
              <p className="text-sm text-gray-700 leading-relaxed">{course.description}</p>
            </div>
          )}
          {course.prerequisites && course.prerequisites !== "No" && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Prerequisites</div>
              <p className="text-sm text-gray-700">{course.prerequisites}</p>
            </div>
          )}
          {course.restrictions && course.restrictions !== "No" && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Enrollment Restrictions</div>
              <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">{course.restrictions}</p>
            </div>
          )}
          {course.keywordList?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Topic Labels</div>
              <div className="flex flex-wrap gap-1.5">
                {course.keywordList.map((kw) => (
                  <span key={kw} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{kw}</span>
                ))}
              </div>
            </div>
          )}
          {course.url && (
            <a href={course.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: "#A51C30" }}>
              <ExternalLink className="w-4 h-4" /> View on Harvard Course Catalog
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-3 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 cursor-pointer">
        <option value="">{label}: All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

export default function CourseExplorer({ courses }: { courses: Course[] }) {
  const params = useSearchParams();
  const { savedIds, toggle, isSaved } = useSaved();
  const { takenIds, toggle: toggleTaken, isTaken } = useTaken();

  const [query, setQuery] = useState("");
  const [school, setSchool] = useState(params.get("school") ?? "");
  const [semester, setSemester] = useState("");
  const [courseType, setCourseType] = useState("");
  const [selected, setSelected] = useState<Course | null>(null);
  const [page, setPage] = useState(1);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [view, setView] = useState<"grid" | "bubbles">("grid");
  const [labelFilter, setLabelFilter] = useState("");

  const allTypes = useMemo(() => Array.from(new Set(courses.map((c) => c.type).filter(Boolean))).sort(), [courses]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return courses.filter((c) => {
      if (showSavedOnly && !savedIds.has(c.id) && !takenIds.has(c.id)) return false;
      if (school && c.school !== school) return false;
      if (semester && c.semester !== semester) return false;
      if (courseType && c.type !== courseType) return false;
      if (labelFilter && !c.keywordList?.includes(labelFilter)) return false;
      if (q) {
        const hay = [c.name, c.instructor, c.description, c.keywords, c.department].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => a.school.localeCompare(b.school) || a.name.localeCompare(b.name));
  }, [courses, query, school, semester, courseType, showSavedOnly, savedIds, labelFilter]);


  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resetPage = useCallback(() => setPage(1), []);

  const clearFilters = () => { setQuery(""); setSchool(""); setSemester(""); setCourseType(""); setShowSavedOnly(false); setLabelFilter(""); setPage(1); };
  const hasFilters = query || school || semester || courseType || showSavedOnly || labelFilter;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* School pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => { setSchool(""); resetPage(); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${!school ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
          All Schools
        </button>
        {Object.keys(SCHOOL_COLORS).map((s) => {
          const c = SCHOOL_COLORS[s];
          const active = school === s;
          return (
            <button key={s} onClick={() => { setSchool(active ? "" : s); resetPage(); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? `${c.bg} ${c.text} ${c.border}` : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
              {s}
            </button>
          );
        })}
        <button onClick={() => { setShowSavedOnly(!showSavedOnly); resetPage(); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${showSavedOnly ? "bg-red-100 text-red-700 border-red-300" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
          <BookOpen className="w-3 h-3" /> Saved ({savedIds.size})
        </button>
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search courses, instructors, topics..."
            value={query} onChange={(e) => { setQuery(e.target.value); resetPage(); }}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400" />
          {query && <button onClick={() => { setQuery(""); resetPage(); }} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <FilterSelect label="Semester" value={semester} onChange={(v) => { setSemester(v); resetPage(); }} options={SEMESTERS} />
          <FilterSelect label="Type" value={courseType} onChange={(v) => { setCourseType(v); resetPage(); }} options={allTypes} />
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-xl hover:border-gray-400 transition-colors">
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          {filtered.length.toLocaleString()} course{filtered.length !== 1 ? "s" : ""}{hasFilters ? " matching" : " total"}
          {labelFilter && <span className="ml-2 text-xs px-2 py-0.5 rounded-full text-white inline-flex items-center gap-1" style={{ background: getLabelColor(labelFilter) }}>{labelFilter} <button onClick={() => { setLabelFilter(""); setPage(1); }}><X className="w-3 h-3" /></button></span>}
        </p>
        <div className="flex items-center gap-1">
          {view === "grid" && totalPages > 1 && <span className="text-xs text-gray-400 mr-2">Page {page} of {totalPages}</span>}
          <button onClick={() => setView("grid")}
            className={`p-1.5 rounded-lg transition-colors ${view === "grid" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}
            title="Grid view"><LayoutGrid className="w-4 h-4" /></button>
          <button onClick={() => setView("bubbles")}
            className={`p-1.5 rounded-lg transition-colors ${view === "bubbles" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}
            title="Topic graph"><Network className="w-4 h-4" /></button>
        </div>
      </div>

      {view === "bubbles" ? (
        <ExploreGraph
          courses={filtered}
          onSelectLabel={(label) => { setLabelFilter(label); setPage(1); setView("grid"); }}
        />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No courses found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((course) => (
            <div key={course.id} onClick={() => setSelected(course)}
              className="bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group">
              <div className="flex items-start justify-between gap-2 mb-2">
                <SchoolBadge school={course.school} />
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); toggleTaken(course.id); }}
                    title="Mark as taken"
                    className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isTaken(course.id) ? "bg-slate-200 text-slate-600" : "bg-gray-100 text-gray-300 hover:text-gray-500"}`}>
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); toggle(course.id); }}
                    title="Save for later"
                    className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isSaved(course.id) ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-400 hover:text-gray-600"}`}>
                    <BookOpen className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 leading-snug mb-1 group-hover:text-red-700 transition-colors line-clamp-2">{course.name}</h3>
              <p className="text-xs text-gray-400 mb-2">{course.id}</p>
              {course.instructor && (
                <p className="text-xs text-gray-500 mb-2 line-clamp-1">
                  {course.instructor.split(",")[0]}{course.instructor.includes(",") ? " et al." : ""}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {course.semester && <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg">{course.semester}</span>}
                {course.credits && <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg">{course.credits} cr</span>}
                {course.keywordList?.[0] && <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg truncate max-w-[140px]">{course.keywordList[0]}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "grid" && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:border-gray-400 transition-colors">
            Previous
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:border-gray-400 transition-colors">
            Next
          </button>
        </div>
      )}

      {selected && (
        <CourseModal
          course={selected}
          onClose={() => setSelected(null)}
          isSaved={isSaved(selected.id)}
          onToggle={() => toggle(selected.id)}
          isTaken={isTaken(selected.id)}
          onToggleTaken={() => toggleTaken(selected.id)}
        />
      )}
    </div>
  );
}
