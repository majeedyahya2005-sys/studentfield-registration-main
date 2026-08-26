import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, password } = body as { action: string; password?: string };

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: ok } = await admin.rpc('owner_verify', { p_password: password ?? '' });
    if (!ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list') {
      const { data, error } = await admin.rpc('owner_list_registrations');
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'letter') {
      const { id } = body as { id: string };
      const { data: path, error: pathError } = await admin.rpc('owner_signed_letter_url', { p_id: id });
      if (pathError) throw pathError;
      if (!path) {
        return new Response(JSON.stringify({ error: 'No letter attached' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: urlData, error: urlError } = await admin.storage.from('acceptance-letters').createSignedUrl(path, 300);
      if (urlError || !urlData?.signedUrl) throw new Error('Could not create signed URL');
      return new Response(JSON.stringify({ url: urlData.signedUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update') {
      const { id, status, response, acceptance_message, rejection_reason, host_organisation, placement_location, start_date, end_date } = body as {
        id: string; status: string; response: string;
        acceptance_message?: string; rejection_reason?: string;
        host_organisation?: string; placement_location?: string;
        start_date?: string; end_date?: string;
      };
      const { data, error } = await admin.rpc('owner_update_review', {
        p_id: id,
        p_status: status,
        p_response: response,
        p_acceptance_message: acceptance_message ?? null,
        p_rejection_reason: rejection_reason ?? null,
        p_host_organisation: host_organisation ?? null,
        p_placement_location: placement_location ?? null,
        p_start_date: start_date ?? null,
        p_end_date: end_date ?? null,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Request failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
