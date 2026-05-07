import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: Request) {
  const { takenCourses, savedCourses, clusterBreakdown, apiKey } = await req.json() as {
    takenCourses: { name: string; school: string; labels: string[] }[];
    savedCourses: { name: string; school: string; labels: string[] }[];
    clusterBreakdown: Record<string, { taken: string[]; saved: string[] }>;
    apiKey: string;
  };

  if (!apiKey?.startsWith("sk-")) return new Response("Invalid API key", { status: 400 });

  const takenSection = takenCourses.length > 0
    ? `Courses already taken:\n${takenCourses.map((c) => `- [${c.school}] ${c.name} → ${c.labels.join(", ")}`).join("\n")}`
    : "No courses marked as taken yet.";

  const savedSection = savedCourses.length > 0
    ? `Courses planned (saved):\n${savedCourses.map((c) => `- [${c.school}] ${c.name} → ${c.labels.join(", ")}`).join("\n")}`
    : "No courses saved yet.";

  const clusterSection = Object.entries(clusterBreakdown)
    .filter(([, v]) => v.taken.length + v.saved.length > 0)
    .map(([cluster, { taken, saved }]) => {
      const parts = [];
      if (taken.length) parts.push(`taken: ${taken.join(", ")}`);
      if (saved.length) parts.push(`planned: ${saved.join(", ")}`);
      return `${cluster}: ${parts.join(" | ")}`;
    }).join("\n");

  const prompt = `You are a Harvard academic advisor reviewing a student's cross-registration journey. Based on the courses they have taken and plan to take across different schools, write a concise, insightful personal knowledge profile (3–5 short paragraphs).

${takenSection}

${savedSection}

Discipline clusters covered:
${clusterSection}

Your summary should:
1. Describe the intellectual profile that emerges — what themes and disciplines define this student's trajectory
2. Highlight the most interesting interdisciplinary connections between their courses
3. Note any significant depth in a particular area or impressive breadth across schools
4. Suggest 1–2 specific directions or topic areas they haven't explored yet that would complement their profile

Keep the tone warm, specific, and motivating — like a mentor who genuinely knows this student's academic journey.`;

  const client = new Anthropic({ apiKey });
  const stream = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
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

  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
