import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const footballDataToken = Deno.env.get('FOOTBALL_DATA_TOKEN')!

    if (!footballDataToken) throw new Error('FOOTBALL_DATA_TOKEN não configurado')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const hoje = new Date()
    const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1)
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1)
    
    const dateFrom = ontem.toISOString().split('T')[0]
    const dateTo = amanha.toISOString().split('T')[0]
    const apiUrl = `https://api.football-data.org/v4/competitions/2000/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`

    const response = await fetch(apiUrl, { headers: { 'X-Auth-Token': footballDataToken } })
    if (!response.ok) throw new Error('Falha ao buscar dados na API')

    const data = await response.json()
    const matches = data.matches || []

    const { data: teams } = await supabase.from('teams').select('id, name, flag_code')
    if (!teams) throw new Error('Nenhum time encontrado no banco.')

    let updatedCount = 0
    const updateErrors: string[] = []

    for (const match of matches) {
      if (!['IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status)) continue

      const dbStatus = match.status === 'FINISHED' ? 'finished' : 'in_progress'
      const hName = match.homeTeam.name.toLowerCase()
      const aName = match.awayTeam.name.toLowerCase()

      const findTeamId = (apiName: string) => {
        return teams.find(t => 
          apiName.includes(t.name.toLowerCase()) || 
          (t.flag_code && apiName.includes(t.flag_code.toLowerCase()))
        )?.id;
      };

      const hId = findTeamId(hName)
      const aId = findTeamId(aName)

      if (!hId || !aId) {
        console.warn(`Times não mapeados: ${match.homeTeam.name} vs ${match.awayTeam.name}`)
        continue
      }

      const { error: updateError } = await supabase
        .from('matches')
        .update({
          home_score: match.score?.fullTime?.home ?? 0,
          away_score: match.score?.fullTime?.away ?? 0,
          status: dbStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('home_team_id', hId)
        .eq('away_team_id', aId)
        .eq('phase', 'group')

      if (!updateError) {
        console.log(`Sucesso: ${match.homeTeam.name} ${match.score?.fullTime?.home} - ${match.score?.fullTime?.away} ${match.awayTeam.name}`)
        updatedCount++
      }
    }

    return new Response(
      JSON.stringify({ message: 'Sync completo', updatedMatches: updatedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Erro na Edge Function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})