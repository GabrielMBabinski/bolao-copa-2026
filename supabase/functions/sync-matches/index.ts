import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const footballDataToken = Deno.env.get('FOOTBALL_DATA_TOKEN')!

    if (!footballDataToken) {
      console.error('FOOTBALL_DATA_TOKEN not set')
      return new Response(
        JSON.stringify({ error: 'FOOTBALL_DATA_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ==========================================
    // 1. CORREÇÃO: JANELA DE 3 DIAS (Fuso Horário)
    // ==========================================
    const hoje = new Date()
    
    const ontem = new Date(hoje)
    ontem.setDate(ontem.getDate() - 1)
    
    const amanha = new Date(hoje)
    amanha.setDate(amanha.getDate() + 1)

    const dateFrom = ontem.toISOString().split('T')[0]
    const dateTo = amanha.toISOString().split('T')[0]
    const apiUrl = `https://api.football-data.org/v4/competitions/2000/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`

    console.log(`Buscando jogos de ${dateFrom} até ${dateTo}...`)

    const response = await fetch(apiUrl, {
      headers: { 'X-Auth-Token': footballDataToken },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Football-data.org API error:', errorText)
      throw new Error('Falha ao buscar dados na API')
    }

    const data = await response.json()
    const matches = data.matches || []

    console.log(`Encontrados ${matches.length} jogos no período.`)

    if (matches.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhum jogo encontrado', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Pega times do banco para mapear IDs
    const { data: teams } = await supabase.from('teams').select('id, name, flag_code')

    if (!teams) throw new Error('Nenhum time encontrado no banco de dados.')

    const teamMap = new Map()
    teams.forEach((team) => {
      teamMap.set(team.name.toLowerCase(), team.id)
      teamMap.set(team.flag_code.toLowerCase(), team.id)
    })

    let updatedCount = 0
    const updateErrors: string[] = []

    // Processar as partidas
    for (const match of matches) {
      const apiStatus = match.status

      // ==========================================
      // 2. CORREÇÃO: ACEITAR JOGOS AO VIVO
      // ==========================================
      if (!['IN_PLAY', 'PAUSED', 'FINISHED'].includes(apiStatus)) {
        continue // Pula apenas o que não começou ou foi cancelado/adiado
      }

      // Traduz o status da API para o status do seu banco (enum)
      const dbStatus = apiStatus === 'FINISHED' ? 'finished' : 'in_progress'

      const homeTeamName = match.homeTeam.name
      const awayTeamName = match.awayTeam.name
      
      // Na API v4, o placar ao vivo (e final) fica no objeto fullTime
      const homeScore = match.score?.fullTime?.home ?? 0
      const awayScore = match.score?.fullTime?.away ?? 0

      // Encontra IDs
      const homeTeamId = teamMap.get(homeTeamName.toLowerCase()) || teamMap.get(homeTeamName.toLowerCase().replace(/\s/g, ''))
      const awayTeamId = teamMap.get(awayTeamName.toLowerCase()) || teamMap.get(awayTeamName.toLowerCase().replace(/\s/g, ''))

      if (!homeTeamId || !awayTeamId) {
        console.warn(`Times não mapeados: ${homeTeamName} vs ${awayTeamName}`)
        continue
      }

      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id, status')
        .eq('home_team_id', homeTeamId)
        .eq('away_team_id', awayTeamId)
        .eq('phase', 'group')
        .single()

      if (!existingMatch) continue

      // Se no NOSSO banco já consta como finalizado, não altera mais.
      if (existingMatch.status === 'finished') continue

      // Atualiza o jogo! (Seja Ao Vivo ou Finalizado)
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          status: dbStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMatch.id)

      if (updateError) {
        console.error(`Erro ao atualizar ${homeTeamName}:`, updateError)
        updateErrors.push(`Falha no update: ${homeTeamName}`)
        continue
      }

      console.log(`Sucesso: ${homeTeamName} ${homeScore} - ${awayScore} ${awayTeamName} (${dbStatus})`)
      updatedCount++
    }

    return new Response(
      JSON.stringify({ message: 'Sync completo', updatedMatches: updatedCount, errors: updateErrors }),
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