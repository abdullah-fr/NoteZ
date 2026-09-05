import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, string | boolean>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function removeUploads(
  admin: ReturnType<typeof createClient>,
  filePaths: string[],
) {
  if (filePaths.length === 0) return;

  const batchSize = 100;
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const { error } = await admin.storage.from("uploads").remove(filePaths.slice(i, i + batchSize));
    if (error) throw new Error(`Could not delete uploaded source files: ${error.message}`);
  }
}

type StorageEntry = {
  name: string;
  id?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Storage is independent from Postgres, so source rows are not a complete
 * inventory: interrupted uploads can leave orphaned objects. Enumerate the
 * whole authenticated user's prefix, including nested folders, before the
 * auth/database transaction starts.
 */
async function listUploadPaths(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<string[]> {
  const paths: string[] = [];
  const pageSize = 100;

  async function walk(prefix: string): Promise<void> {
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage.from("uploads").list(prefix, {
        limit: pageSize,
        offset,
      });
      if (error) throw new Error(`Could not enumerate uploaded source files: ${error.message}`);

      const entries = (data ?? []) as StorageEntry[];
      for (const entry of entries) {
        if (!entry.name) continue;
        const path = `${prefix}/${entry.name}`;
        if (entry.id || entry.metadata) {
          paths.push(path);
        } else {
          await walk(path);
        }
      }

      if (entries.length < pageSize) break;
      offset += entries.length;
    }
  }

  await walk(userId);
  return paths;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let userId: string | undefined;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Supabase environment variables are not configured");
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    userId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Files live outside Postgres, so remove every object under this user's
    // storage prefix before the transactional auth delete below. The source
    // rows are checked too, so a malformed path cannot make us touch another
    // account's object.
    const { data: sources, error: sourcesError } = await admin
      .from("sources")
      .select("file_path")
      .eq("user_id", userId)
      .not("file_path", "is", null);
    if (sourcesError) throw new Error(`Could not load source files: ${sourcesError.message}`);

    const userPrefix = `${userId}/`;
    const referencedPaths = (sources ?? [])
      .flatMap((source) => typeof source.file_path === "string" ? [source.file_path] : []);
    if (referencedPaths.some((filePath) => !filePath.startsWith(userPrefix))) {
      throw new Error("Source file ownership mismatch");
    }

    const filePaths = [...new Set([
      ...(await listUploadPaths(admin, userId)),
      ...referencedPaths,
    ])];
    await removeUploads(admin, filePaths);

    // Deleting auth.users invokes the database trigger added in the accompanying migration.
    // The trigger and foreign-key cascades run in the same database transaction, so an error
    // rolls back both the auth deletion and every relational data deletion.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw new Error(`Could not delete account: ${deleteError.message}`);

    return json({ deleted: true });
  } catch {
    console.error("delete-account failed", { userId: Boolean(userId) });
    return json({ error: "Account deletion could not be completed. Please try again or contact support." }, 500);
  }
});
