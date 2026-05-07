import { promises as fs } from "fs";
import path from "path";
import Dashboard from "@/components/Dashboard";
import type { Course } from "@/lib/types";

export default async function Page() {
  const raw = await fs.readFile(path.join(process.cwd(), "data", "courses.json"), "utf-8");
  const { courses } = JSON.parse(raw) as { courses: Course[] };
  return <Dashboard courses={courses} />;
}
