// Run: node scripts/upload-avatars.mjs
// Place alejandro-avatar.jpg and rut-avatar.jpg in the ra-app/ root first

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse .env.local manually (no dotenv dependency)
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      if (k) process.env[k] = v;
    }
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function uploadAvatar(filePath, storagePath, userName) {
  if (!existsSync(filePath)) {
    console.error(`❌ No encontrado: ${filePath}`);
    return null;
  }
  const file = readFileSync(filePath);
  const { error } = await supabase.storage
    .from("ra-photos")
    .upload(storagePath, file, { contentType: "image/jpeg", upsert: true });
  if (error) { console.error(`❌ Error subiendo ${userName}:`, error.message); return null; }

  const { data } = supabase.storage.from("ra-photos").getPublicUrl(storagePath);
  console.log(`✅ ${userName}: ${data.publicUrl}`);
  return data.publicUrl;
}

async function main() {
  const root = resolve(__dirname, "..");

  const aleUrl = await uploadAvatar(
    resolve(root, "alejandro-avatar.jpg"),
    "perfiles/alejandro/avatar.jpg",
    "Alejandro"
  );
  const rutUrl = await uploadAvatar(
    resolve(root, "rut-avatar.jpg"),
    "perfiles/rut/avatar.jpg",
    "Rut"
  );

  if (aleUrl) {
    await supabase.from("user_profiles").upsert(
      { user_name: "alejandro", photo_url: aleUrl, updated_at: new Date().toISOString() },
      { onConflict: "user_name" }
    );
    console.log("✅ Perfil Alejandro actualizado");
  }
  if (rutUrl) {
    await supabase.from("user_profiles").upsert(
      { user_name: "rut", photo_url: rutUrl, updated_at: new Date().toISOString() },
      { onConflict: "user_name" }
    );
    console.log("✅ Perfil Rut actualizado");
  }
}

main();
