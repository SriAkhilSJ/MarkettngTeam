import { NextResponse } from "next/server";
import { renderCarousel } from "@/lib/render/carousel";
import { s3Configured, uploadToS3 } from "@/lib/render/storage";
import { mkdir, writeFile } from "fs/promises";
import path from "node:path";
import sharp from "sharp";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RenderBody {
  id?: string;
  post?: {
    id?: string;
    hook?: string;
    content?: string;
    caption?: string;
  };
  hook?: string;
  content?: string;
  caption?: string;
}

export async function POST(req: Request) {
  let body: RenderBody;
  try {
    body = (await req.json()) as RenderBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const hook = (body.post?.hook || body.hook || "").trim();
  const content = (body.post?.content || body.content || "").trim();
  const caption = (body.post?.caption || body.caption || "").trim();
  if (!hook && !content) return NextResponse.json({ error: "hook or content is required" }, { status: 400 });

  const id = (body.id || body.post?.id || "").replace(/[^\w-]/g, "").slice(0, 60) || `c${Date.now()}`;
  const slides = renderCarousel({ id, hook, content, caption });

  let origin = "http://localhost:3000";
  try {
    origin = new URL(req.url).origin.replace("://0.0.0.0", "://localhost");
  } catch { /* keep default */ }

  try {
    const pngs = await Promise.all(
      slides.map(async (s) => ({ index: s.index, bytes: await sharp(s.svg).resize(1080, 1350).png({ quality: 92 }).toBuffer() }))
    );

    let s3Error: string | undefined;
    if (s3Configured()) {
      try {
        const urls: string[] = [];
        for (const p of pngs) {
          const { url } = await uploadToS3(`carousel/${id}/slide-${p.index}.png`, p.bytes, "image/png");
          urls.push(url);
        }
        return NextResponse.json({ ok: true, hosted: true, urls, slides: urls.length });
      } catch (s3Err) {
        // e.g. "Project paused" (Supabase free tier) — show the real reason, render locally instead.
        s3Error = s3Err instanceof Error ? s3Err.message : "S3 upload failed";
        if (/@aws-sdk XML parse error/i.test(s3Error)) s3Error = "S3 endpoint refused upload (check: project paused? region? bucket name?)";
      }
    }

    // Local hosting (preview / dry-run). Real publishing still needs public URLs.
    const dir = path.join(process.cwd(), "public", "rendered", id);
    await mkdir(dir, { recursive: true });
    const urls: string[] = [];
    for (const p of pngs) {
      const name = `slide-${p.index}.png`;
      await writeFile(path.join(dir, name), p.bytes);
      urls.push(`${origin}/rendered/${id}/${name}`);
    }
    const warning = s3Error
      ? `S3 upload failed: ${s3Error} — slides saved LOCALLY (preview/Dry run only; live publishing needs a public host).`
      : "S3 creds missing — slides are LOCAL URLs (fine for 🧪 Dry run preview; not for live API publishing).";
    return NextResponse.json({ ok: true, hosted: false, s3Error, warning, urls, slides: urls.length });
  } catch (err) {
    return NextResponse.json({ error: `Render failed: ${err instanceof Error ? err.message : "unknown"}` }, { status: 500 });
  }
}
