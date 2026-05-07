import { promises as fs } from "fs";
import path from "path";
import KnowledgeGraph from "@/components/KnowledgeGraph";
import type { Course } from "@/lib/types";

export type CoOccurrence = Record<string, Record<string, number>>;

export interface CourseSlim {
  id: string;
  name: string;
  school: string;
  semester: string;
  year: string;
  credits: string;
  url: string;
  keywordList: string[];
}

export interface GraphPageData {
  courseSlim: CourseSlim[];
  allLabels: string[];
  coOccurrence: CoOccurrence;
}

function buildCoOccurrence(courses: Course[]): CoOccurrence {
  const co: CoOccurrence = {};
  for (const c of courses) {
    const kws = c.keywordList;
    for (let i = 0; i < kws.length; i++) {
      for (let j = i + 1; j < kws.length; j++) {
        const [a, b] = kws[i] < kws[j] ? [kws[i], kws[j]] : [kws[j], kws[i]];
        if (!co[a]) co[a] = {};
        co[a][b] = (co[a][b] ?? 0) + 1;
      }
    }
  }
  return co;
}

export default async function Page() {
  const raw = await fs.readFile(path.join(process.cwd(), "data", "courses.json"), "utf-8");
  const { courses } = JSON.parse(raw) as { courses: Course[] };
  const courseSlim: CourseSlim[] = courses.map((c) => ({
    id: c.id, name: c.name, school: c.school,
    semester: c.semester, year: c.year, credits: c.credits,
    url: c.url, keywordList: c.keywordList,
  }));
  const allLabels = Array.from(new Set(courses.flatMap((c) => c.keywordList))).sort();
  const coOccurrence = buildCoOccurrence(courses);
  return <KnowledgeGraph data={{ courseSlim, allLabels, coOccurrence }} />;
}
