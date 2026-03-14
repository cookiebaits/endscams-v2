import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function getRandomIncrement(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date();

    if (!isWeekday(now)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Updates only run Monday-Friday',
          day: now.toLocaleString('en-US', { weekday: 'long' })
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: currentStats, error: fetchError } = await supabase
      .from('impact_statistics')
      .select('*')
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!currentStats) {
      const { error: insertError } = await supabase
        .from('impact_statistics')
        .insert({
          money_saved: 1247563,
          scammer_hours_wasted: 4753,
          resources_shutdown: 402,
        });

      if (insertError) {
        throw insertError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Initial statistics created',
          data: {
            money_saved: 1247563,
            scammer_hours_wasted: 4753,
            resources_shutdown: 402,
          }
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const lastUpdate = new Date(currentStats.last_updated);
    const isSameDay =
      now.getFullYear() === lastUpdate.getFullYear() &&
      now.getMonth() === lastUpdate.getMonth() &&
      now.getDate() === lastUpdate.getDate();

    if (isSameDay) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Already updated today',
          lastUpdate: lastUpdate.toISOString(),
          currentStats: {
            money_saved: currentStats.money_saved,
            scammer_hours_wasted: currentStats.scammer_hours_wasted,
            resources_shutdown: currentStats.resources_shutdown,
          }
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const moneyIncrement = getRandomIncrement(50, 150);
    const hoursIncrement = getRandomIncrement(3, 5);
    const resourcesIncrement = getRandomIncrement(3, 5);

    const newStats = {
      money_saved: currentStats.money_saved + moneyIncrement,
      scammer_hours_wasted: currentStats.scammer_hours_wasted + hoursIncrement,
      resources_shutdown: currentStats.resources_shutdown + resourcesIncrement,
      last_updated: now.toISOString(),
    };

    const { error: updateError } = await supabase
      .from('impact_statistics')
      .update(newStats)
      .eq('id', currentStats.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Statistics updated successfully',
        increments: {
          money_saved: moneyIncrement,
          scammer_hours_wasted: hoursIncrement,
          resources_shutdown: resourcesIncrement,
        },
        newStats,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
