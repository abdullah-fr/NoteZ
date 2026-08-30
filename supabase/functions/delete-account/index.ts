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
  const batchSize = 100;
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const { error } = await admin.storage.from("uploads").remove(filePaths.slice(i, i + batchSize));
    if (error) throw new Error(`Could not delete uploaded source files: ${error.message}`);
  }
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

    // Files live outside Postgres, so remove them before the transactional auth delete below.
    const { data: sources, error: sourcesError } = await admin
      .from("sources")
      .select("file_path")
      .eq("user_id", userId)
      .not("file_path", "is", null);
    if (sourcesError) throw new Error(`Could not load source files: ${sourcesError.message}`);

    const filePaths = [...new Set((sources ?? []).flatMap((source) => source.file_path ? [source.file_path] : []))];
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
