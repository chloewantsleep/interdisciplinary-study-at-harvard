import { auth } from "@clerk/nextjs/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ saved: [], taken: [] });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as "saved" | "taken" | null;

  if (type) {
    const ids = await redis.smembers(`${type}:${userId}`);
    return Response.json({ ids: ids ?? [] });
  }

  const [saved, taken] = await Promise.all([
    redis.smembers(`saved:${userId}`),
    redis.smembers(`taken:${userId}`),
  ]);
  return Response.json({ saved: saved ?? [], taken: taken ?? [] });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { type, id, action } = await req.json() as {
    type: "saved" | "taken";
    id: string;
    action: "add" | "remove";
  };

  const key = `${type}:${userId}`;
  if (action === "add") await redis.sadd(key, id);
  else await redis.srem(key, id);

  return Response.json({ ok: true });
}
