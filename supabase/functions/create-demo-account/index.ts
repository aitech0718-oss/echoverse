import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const accounts = [
      { email: "demo@echoverse.app", password: "Demo@123", name: "Echo Explorer", role: "user" },
      { email: "admin@echoverse.app", password: "Admin@123", name: "EchoVerse Admin", role: "admin" },
    ];

    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const existingEmails = new Set(existing?.users?.map(u => u.email) || []);
    const results = [];

    for (const account of accounts) {
      if (existingEmails.has(account.email)) {
        results.push({ email: account.email, status: "already exists" });
        continue;
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { display_name: account.name },
      });

      if (error) {
        results.push({ email: account.email, status: "error", message: error.message });
        continue;
      }

      if (data.user && account.role === "admin") {
        await supabaseAdmin.from("user_roles").update({ role: "admin" }).eq("user_id", data.user.id);
      }

      results.push({ email: account.email, status: "created" });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
