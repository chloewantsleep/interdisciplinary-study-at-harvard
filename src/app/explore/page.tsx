import { promises as fs } from "fs";
import path from "path";
import { Suspense } from "react";
import CourseExplorer from "@/components/CourseExplorer";
import type { Course } from "@/lib/types";

export default async function Page() {
  const raw = await fs.readFile(path.join(process.cwd(), "data", "courses.json"), "utf-8");
  const { courses } = JSON.parse(raw) as { courses: Course[] };
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading courses...</div>}>
      <CourseExplorer courses={courses} />
    </Suspense>
  );
}
