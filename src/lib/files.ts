import { ATTACHMENT_MAX_BYTES } from "@/domain/constants";
import type { Attachment } from "@/domain/types";

const MIME_BY_EXT: Record<string, string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  jfif: ["image/jpeg", "image/pjpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
};

/** Validates extension, MIME type and size (≤ 3 MB) and reads the file as a data URL. */
export async function readAttachment(file: File, allowed: readonly string[]): Promise<{ ok: true; file: Attachment } | { ok: false; error: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowed.includes(ext) || (file.type && !MIME_BY_EXT[ext]?.includes(file.type))) {
    return { ok: false, error: `Formato não aceito. Use ${allowed.join(", ").toUpperCase()}.` };
  }
  if (file.size > ATTACHMENT_MAX_BYTES) return { ok: false, error: "O arquivo deve ter no máximo 3 MB." };
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return { ok: true, file: { name: file.name, size: file.size, type: file.type || MIME_BY_EXT[ext]?.[0] || "application/octet-stream", dataUrl } };
}

export function downloadAttachment(att: Attachment): boolean {
  if (!att.dataUrl) return false;
  const a = document.createElement("a");
  a.href = att.dataUrl;
  a.download = att.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
