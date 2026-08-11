import { settings } from "../config/settings";

export async function upload(key: string, body: Buffer): Promise<void> {
  const res = await fetch(`https://s3.${settings.region}.amazonaws.com/${settings.bucket}/${key}`, {
    method: "PUT",
    body,
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
}
