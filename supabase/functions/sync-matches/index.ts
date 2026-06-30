import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- DICIONÁRIO DE TRADUÇÃO (Inglês API -> Português Banco) ---
const TEAM_DICTIONARY: Record<string, string> = {
  'netherlands': 'holanda', 'holland': 'holanda',
  'curaçao': 'curacao', 'curacao': 'curacao',
  'cape verde islands': 'cabo verde', 'cape verde': 'cabo verde', 'cabo verde': 'cabo verde',
  'republic of ireland': 'irlanda',
  'canada': 'canada', 'mexico': 'mexico', 'united states': 'estados unidos', 'usa': 'estados unidos',
  'panama': 'panama', 'haiti': 'haiti', 'egypt': 'egito', 'senegal': 'senegal',
  'south africa': 'africa do sul', 'morocco': 'marrocos',
  'ivory coast': 'costa do marfim', "cote d'ivoire": 'costa do marfim', 'algeria': 'argelia', 'tunisia': 'tunisia',
  'ghana': 'gana', 'dr congo': 'rd congo', 'congo dr': 'rd congo', 'argentina': 'argentina',
  'ecuador': 'equador', 'colombia': 'colombia', 'uruguay': 'uruguai', 'brazil': 'brasil',
  'paraguay': 'paraguai', 'iran': 'ira', 'ir iran': 'ira', 'south korea': 'coreia do sul', 'korea republic': 'coreia do sul',
  'japan': 'japao', 'uzbekistan': 'uzbequistao', 'jordan': 'jordania', 'australia': 'australia', 'qatar': 'catar',
  'saudi arabia': 'arabia saudita', 'iraq': 'iraque', 'new zealand': 'nova zelandia', 'germany': 'alemanha',
  'switzerland': 'suica', 'scotland': 'escocia', 'france': 'franca', 'spain': 'espanha', 'portugal': 'portugal',
  'austria': 'austria', 'norway': 'noruega', 'belgium': 'belgica', 'england': 'inglaterra', 'croatia': 'croacia',
  'turkey': 'turquia', 'turkiye': 'turquia', 'czech republic': 'republica tcheca', 'czechia': 'republica tcheca',
  'sweden': 'suecia', 'bosnia and herzegovina': 'bosnia e herzegovina', 'bosnia-herzegovina': 'bosnia e herzegovina',
  'bosnia & herzegovina': 'bosnia e herzegovina', 'bosnia': 'bosnia e herzegovina', 'bih': 'bosnia e herzegovina'
}

// --- DICIONÁRIO DE FASES (API -> Banco de Dados) ---
const PHASE_DICTIONARY: Record<string, string> = {
  'GROUP_STAGE': 'group',
  'LAST_32': 'round_32',
  'ROUND_OF_32': 'round_32',
  'LAST_16': 'round_16',
  'ROUND_OF_16': 'round_16',
  'QUARTER_FINALS': 'quarter',
  'SEMI_FINALS': 'semi',
  'FINAL': 'final',
  'THIRD_PLACE': 'third_place'
}

const normalizeName = (name: string | null | undefined) => {
  if (!name) return ""
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

const translateApiName = (apiName: string): string => {
  const normalizedApi = normalizeName(apiName)
  return TEAM_DICTIONARY[normalizedApi] || normalizedApi
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // --- NOVA BLINDAGEM DE SEGURANÇA ---
  const authHeader = req.headers.get('Authorization')
  const expectedAnon = `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
  const expectedService = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`

  if (authHeader !== expectedAnon && authHeader !== expectedService) {
    console.warn('Tentativa de acesso negada à Edge Function.')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const footballDataToken = Deno.env.get('FOOTBALL_DATA_TOKEN')!

    if (!footballDataToken) throw new Error('FOOTBALL_DATA_TOKEN não configurado')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const apiUrl = `https://api.football-data.org/v4/competitions/2000/matches`

    // --- SISTEMA DE RESILIÊNCIA (RETRY & TIMEOUT) ---
    let apiResponse;
    let apiData;
    let retries = 3;

    while (retries > 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos de timeout limite

        apiResponse = await fetch(apiUrl, {
          headers: { 'X-Auth-Token': footballDataToken },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!apiResponse.ok) throw new Error(`HTTP Error: ${apiResponse.status}`);

        apiData = await apiResponse.json();
        break; // Sucesso, sai do loop de tentativas
      } catch (e: any) {
        retries--;
        console.error(`Falha de conexão com a API. Tentativas restantes: ${retries}. Erro: ${e.message}`);
        if (retries === 0) throw new Error('Falha ao buscar dados na API externa após 3 tentativas.');
        await new Promise(res => setTimeout(res, 2000)); // Espera 2 segundos antes de tentar de novo
      }
    }

    const apiMatches = apiData.matches || []

    // Carrega dados atuais do banco
    const { data: dbTeams } = await supabase.from('teams').select('id, name, flag_code')
    const { data: dbMatches } = await supabase.from('matches').select('*')

    if (!dbTeams || !dbMatches) throw new Error('Erro ao carregar dados bases do Supabase.')

    let insertCount = 0
    let updateCount = 0

    for (const match of apiMatches) {
      if (!['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status)) continue

      // Pula os jogos onde as seleções ainda não estão definidas ("Winner Group A", etc.)
      if (!match.homeTeam?.name || !match.awayTeam?.name) continue;

      const translatedHome = translateApiName(match.homeTeam.name)
      const translatedAway = translateApiName(match.awayTeam.name)

      const findTeamId = (translatedName: string, originalApiName: string) => {
        return dbTeams.find(t => {
          const dbName = normalizeName(t.name)
          return dbName === translatedName ||
            dbName.includes(translatedName) ||
            translatedName.includes(dbName) ||
            (t.flag_code && originalApiName.toLowerCase().includes(t.flag_code.toLowerCase()))
        })?.id
      }

      const hId = findTeamId(translatedHome, match.homeTeam.name)
      const aId = findTeamId(translatedAway, match.awayTeam.name)

      if (!hId || !aId) {
        console.log(`⚠️ Jogo ignorado: ${match.homeTeam?.name} x ${match.awayTeam?.name}. Motivo: Times não encontrados.`);
        continue;
      }

      let dbStatus = 'pending'
      if (match.status === 'FINISHED') dbStatus = 'finished'
      else if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(match.status)) dbStatus = 'in_progress'

      const dbPhase = PHASE_DICTIONARY[match.stage] || 'group'

      // --- LÓGICA BLINDADA PARA O PLACAR ---
      // Pega o placar cheio que a API envia
      let homeScore = match.score?.fullTime?.home ?? null;
      let awayScore = match.score?.fullTime?.away ?? null;
      let dbPenaltyWinner = null;

      // Se o jogo foi para os pênaltis...
      if (match.score?.duration === 'PENALTY_SHOOTOUT') {
        const homePen = match.score?.penalties?.home ?? 0;
        const awayPen = match.score?.penalties?.away ?? 0;

        // A MÁGICA: Corrige o placar do tempo normal se a API tiver somado os pênaltis nele.
        // Se o jogo foi pros pênaltis, obrigatoriamente ele terminou empatado. Se o fullTime
        // estiver diferente, nós subtraímos os pênaltis para voltar ao empate original.
        if (homeScore !== null && awayScore !== null && homeScore !== awayScore) {
          homeScore = homeScore - homePen;
          awayScore = awayScore - awayPen;
        }

        // Define quem ganhou os pênaltis
        if (homePen > awayPen) dbPenaltyWinner = 'home';
        else if (awayPen > homePen) dbPenaltyWinner = 'away';
        
      } else if (match.status === 'FINISHED') {
        // Garantia de limpeza para jogos decididos no tempo normal
        dbPenaltyWinner = null;
      }

      // Identifica se o jogo já existe no banco de dados
      const existingMatch = dbMatches.find(m =>
        m.api_id === match.id ||
        (m.home_team_id === hId && m.away_team_id === aId && m.phase === dbPhase)
      )

      // --- LIMPEZA PREVENTIVA UNIFICADA ---
      // Apaga qualquer duplicata que compartilhe os mesmos times e fase, 
      // poupando apenas o ID oficial que já vamos atualizar.
      await supabase
        .from('matches')
        .delete()
        .eq('home_team_id', hId)
        .eq('away_team_id', aId)
        .eq('phase', dbPhase)
        .neq('id', existingMatch?.id || '00000000-0000-0000-0000-000000000000');

      if (existingMatch) {
        // --- LOGICA DE UPDATE ---
        const needsUpdate =
          existingMatch.home_score !== homeScore ||
          existingMatch.away_score !== awayScore ||
          existingMatch.status !== dbStatus ||
          existingMatch.penalty_winner !== dbPenaltyWinner ||
          existingMatch.api_id !== match.id ||
          existingMatch.match_date !== match.utcDate // Atualiza caso a FIFA mude a data

        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('matches')
            .update({
              api_id: match.id,
              match_date: match.utcDate,
              home_score: homeScore,
              away_score: awayScore,
              status: dbStatus,
              penalty_winner: dbPenaltyWinner,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingMatch.id)

          if (!updateError) updateCount++
        }
      } else {
        // --- LOGICA DE INSERT AUTOMÁTICO ---
        const { error: insertError } = await supabase
          .from('matches')
          .insert({
            api_id: match.id,
            home_team_id: hId,
            away_team_id: aId,
            match_date: match.utcDate,
            phase: dbPhase,
            home_score: homeScore,
            away_score: awayScore,
            status: dbStatus,
            penalty_winner: dbPenaltyWinner
          })

        if (!insertError) {
          console.log(`✅ NOVO CONFRONTO INSERIDO: ${match.homeTeam.name} x ${match.awayTeam.name} (${dbPhase})`)
          insertCount++
        } else {
          console.error(`❌ Erro ao inserir jogo ${match.id}:`, insertError.message)
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Sincronização executada com sucesso',
        jogos_inseridos: insertCount,
        jogos_atualizados: updateCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Erro na execução da Edge Function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})