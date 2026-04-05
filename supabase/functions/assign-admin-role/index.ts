import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_EMAIL = "payton@wovomedia.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500, headers: corsHeaders }
    );
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  const adminUser = data.users.find(
    (user) => (user.email ?? "").trim().toLowerCase() === ADMIN_EMAIL
  );

  if (!adminUser?.id || !adminUser.email) {
    return Response.json(
      { status: "not_found", message: `No auth user found for ${ADMIN_EMAIL}` },
      { status: 404, headers: corsHeaders }
    );
  }

  const { error: upsertError } = await adminClient.from("users").upsert(
    {
      id: adminUser.id,
      email: adminUser.email,
      role: "admin",
      name:
        (adminUser.user_metadata?.full_name as string | undefined) ??
        (adminUser.user_metadata?.name as string | undefined) ??
        null,
      created_at: adminUser.created_at,
    },
    {
      onConflict: "id",
    }
  );

  if (upsertError) {
    return Response.json({ error: upsertError.message }, { status: 500, headers: corsHeaders });
  }

  const { error: metadataError } = await adminClient.auth.admin.updateUserById(adminUser.id, {
    user_metadata: {
      ...(adminUser.user_metadata ?? {}),
      role: "admin",
    },
  });

  if (metadataError) {
    return Response.json({ error: metadataError.message }, { status: 500, headers: corsHeaders });
  }

  const { error: logError } = await adminClient.from("admin_actions").insert({
    admin_user_id: adminUser.id,
    action: "auto_assign_admin_role",
    target_user_id: adminUser.id,
    metadata: {
      email: ADMIN_EMAIL,
      source: "edge_function_assign_admin_role",
    },
  });

  if (logError) {
    return Response.json(
      {
        status: "partial_success",
        user_id: adminUser.id,
        warning: logError.message,
      },
      { status: 207, headers: corsHeaders }
    );
  }

  return Response.json(
    { status: "ok", user_id: adminUser.id, email: ADMIN_EMAIL, role: "admin" },
    { headers: corsHeaders }
  );
});
