/**
 * Optional media hosting. If AWS_S3_* env vars are set (S3-compatible —
 * plain AWS or Supabase Storage S3 endpoints), rendered/attached media is
 * uploaded here so posts get PUBLIC https URLs that platforms can download.
 * Without these vars, rendered files are served from /rendered (localhost only,
 * fine for Dry Run previews, not for live API publishing).
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../social/http";

export interface PublicMedia {
  url: string;
  key: string;
}

export function s3Configured(): boolean {
  return Boolean(
    env("AWS_S3_BUCKET") && env("AWS_ACCESS_KEY_ID") && env("AWS_SECRET_ACCESS_KEY")
  );
}

export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<PublicMedia> {
  const bucket = env("AWS_S3_BUCKET")!;
  const endpoint = env("AWS_S3_ENDPOINT") || undefined;
  const prefix = (env("AWS_S3_PREFIX") || "media").replace(/\/+$/, "");
  const fullKey = `${prefix}/${key}`.replace(/\/{2,}/g, "/");

  const client = new S3Client({
    region: env("AWS_S3_REGION") || "us-east-1",
    endpoint,
    forcePathStyle: Boolean(endpoint), // Supabase / MinIO style endpoints
    credentials: {
      accessKeyId: env("AWS_ACCESS_KEY_ID")!,
      secretAccessKey: env("AWS_SECRET_ACCESS_KEY")!,
    },
  });

  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: fullKey, Body: body, ContentType: contentType, ACL: "public-read" })
  );

  return { url: publicUrl(bucket, fullKey), key: fullKey };
}

function publicUrl(bucket: string, key: string): string {
  // Supabase-style endpoint → construct public URL directly; else virtual-host style.
  const endpoint = env("AWS_S3_ENDPOINT");
  const publicHost =
    process.env.AWS_S3_PUBLIC_BASE_URL || // explicit override wins
    (endpoint
      ? `${endpoint.replace(/\/+$/, "").replace(/\/storage\/v1\/s3$/, "")}/storage/v1/object/public/${bucket}/${key}`
      : `https://${bucket}.s3.${env("AWS_S3_REGION") || "us-east-1"}.amazonaws.com/${key}`);
  return publicHost;
}
