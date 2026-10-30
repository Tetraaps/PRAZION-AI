import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

const allowed = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
const extensions = new Set(["png","jpg","jpeg","webp","pdf","txt","csv","docx","xlsx"]);
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  const max = Number(process.env.MAX_UPLOAD_BYTES ?? 10485760);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!extensions.has(ext) || !allowed.has(file.type)) return Response.json({ error: "Unsupported file type. Upload PNG, JPG, WEBP, PDF, TXT, CSV, DOCX, or XLSX." }, { status: 415 });
  if (file.size <= 0 || file.size > max) return Response.json({ error: `File must be between 1 byte and ${Math.round(max/1024/1024)} MB.` }, { status: 413 });
  const path = `${user.id}/${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from("prazion-attachments").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return Response.json({ error: "Upload failed. Ensure the private prazion-attachments bucket and storage policies are configured." }, { status: 500 });
  const { data: record, error: dbError } = await supabase.from("attachments").insert({ user_id: user.id, storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size }).select("id,file_name,mime_type,size_bytes,storage_path").single();
  if (dbError) {
    await supabase.storage.from("prazion-attachments").remove([path]);
    return Response.json({ error: "File uploaded but metadata could not be saved." }, { status: 500 });
  }
  return Response.json({ attachment: record }, { status: 201 });
}