import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";
import type { Course } from "@/lib/types";

export async function POST(req: Request) {
  const { userInput, savedCourseIds, apiKey } = await req.json() as {
    userInput: string;
    savedCourseIds: string[];
    apiKey: string;
  };

  if (!apiKey?.startsWith("sk-")) {
    return new Response("Invalid API key", { status: 400 });
  }

  const raw = await fs.readFile(path.join(process.cwd(), "data", "courses.json"), "utf-8");
  const { courses } = JSON.parse(raw) as { courses: Course[] };

  // Extract keywords from user input to pre-filter courses
  const inputLower = userInput.toLowerCase();
  const allKeywords = Array.from(new Set(courses.flatMap((c) => c.keywordList)));
  const matchedKeywords = allKeywords.filter((kw) => inputLower.includes(kw.toLowerCase()));

  // Score courses by keyword match
  const scored = courses.map((c) => {
    let score = 0;
    for (const kw of matchedKeywords) {
      if (c.keywordList.includes(kw)) score += 1;
    }
    // Bonus for description match
    if (c.description.toLowerCase().includes(inputLower.slice(0, 30))) score += 0.5;
    return { course: c, score };
  });

  // Take top 60 scoring courses, ensuring school diversity
  const schoolBuckets: Record<string, Course[]> = {};
  const topScored = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 120);

  for (const { course } of topScored) {
    if (!schoolBuckets[course.school]) schoolBuckets[course.school] = [];
    schoolBuckets[course.school].push(course);
  }

  // Balance: up to 10 per school
  const candidateCourses: Course[] = [];
  for (const list of Object.values(schoolBuckets)) {
    candidateCourses.push(...list.slice(0, 10));
  }

  // If we have saved courses, add context about them
  const saved = courses.filter((c) => savedCourseIds.includes(c.id)).slice(0, 10);
  const savedContext = saved.length > 0
    ? `\n\nThe student has already saved these courses:\n${saved.map((c) => `- [${c.school}] ${c.name} (topics: ${c.keywordList.join(", ")})`).join("\n")}`
    : "";

  const courseList = candidateCourses.map((c) =>
    `ID:${c.id} | ${c.school} | "${c.name}" | Topics: ${c.keywordList.join(", ")} | ${c.semester} ${c.year} | ${c.credits} credits`
  ).join("\n");

  const prompt = `You are an academic advisor helping Harvard students discover cross-registration opportunities that promote interdisciplinary learning across schools.

Student's background and goals:
${userInput}
${savedContext}

Available courses (from various Harvard schools — FAS, GSD, HBS, HDS, HGSE, HKS, HLS, HSPH):
${courseList}

Please suggest 6–8 specific courses from the list above that would best serve this student's interdisciplinary goals. For each course:
1. State the course ID, school, and name
2. Explain in 2–3 sentences why it fits their goals and how it connects to other disciplines
3. Note if it bridges multiple schools or topics in an unexpected way

Emphasize courses from schools *different* from the student's likely home school, to promote cross-registration. Format each as a numbered recommendation.`;

  const client = new Anthropic({ apiKey });

  const stream = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    stream: true,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
