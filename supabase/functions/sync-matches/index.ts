import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TEAM_DICTIONARY: Record<string, string> = {
  'netherlands': 'holanda', 'holland': 'holanda', 'curaçao': 'curacao', 'curacao': 'curacao',
  'cape verde islands': 'cabo verde', 'cape verde': 'cabo verde', 'cabo verde': 'cabo verde',
  'republic of ireland': 'irlanda', 'canada': 'canada', 'mexico': 'mexico', 'united states': 'estados unidos', 'usa': 'estados unidos',
  'panama': 'panama', 'haiti': 'haiti', 'egypt': 'egito', 'senegal': 'senegal',
  'south africa': 'africa do sul', 'morocco': 'marrocos', 'ivory coast': 'costa do marfim', "cote d'ivoire": 'costa do marfim',
  'algeria': 'argelia', 'tunisia': 'tunisia', 'ghana': 'gana', 'dr congo': 'rd congo', 'congo dr': 'rd congo',
  'argentina': 'argentina', 'ecuador': 'equador', 'colombia': 'colombia', 'uruguay': 'uruguai', 'brazil': 'brasil',
  'paraguay': 'paraguai', 'iran': 'ira', 'ir iran': 'ira', 'south korea': 'coreia do sul', 'korea republic': 'coreia do sul',
  'japan': 'japao', 'uzbekistan': 'uzbequistao', 'jordan': 'jordania', 'australia': 'australia', 'qatar': 'catar',
  'saudi arabia': 'arabia saudita', 'iraq': 'iraque', 'new zealand': 'nova zelandia', 'germany': 'alemanha',
  'switzerland': 'suica', 'scotland': 'escocia', 'france': 'franca', 'spain': 'espanha', 'portugal': 'portugal',
  'austria': 'austria', 'norway': 'noruega', 'belgium': 'belgica', 'england': 'inglaterra', 'croatia': 'croacia',
  'turkey': 'turquia', 'turkiye': 'turquia', 'czech republic': 'republica tcheca', 'czechia': 'republica tcheca',
  'sweden': 'suecia', 'bosnia and herzegovina': 'bosnia e herzegovina', 'bosnia-herzegovina': 'bosnia e herzegovina',
  'bosnia & herzegovina': 'bosnia e herzegovina', 'bosnia': 'bosnia e herzegovina', 'bih': 'bosnia e herzegovina'
}

const PHASE_DICTIONARY: Record<string, string> = {
  'GROUP_STAGE': 'group', 'LAST_32': 'round_32', 'ROUND_OF_32': 'round_32',
  'LAST_16': 'round_16', 'ROUND_OF_16': 'round_16', 'QUARTER_FINALS': 'quarter',
  'SEMI_FINALS': 'semi', 'FINAL': 'final', 'THIRD_PLACE': 'third_place'
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

  const authHeader = req.headers.get('Authorization')
  const expectedAnon = `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
  const expectedService = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`

  if (authHeader !== expectedAnon && authHeader !== expectedService) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const footballDataToken = Deno.env.get('FOOTBALL_DATA_TOKEN')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    let apiMatches = [];

    // ============================================================================
    // BUSCA NA API PRINCIPAL (football-data.org - A ÚNICA QUE TRAZ A LISTA CHEIA)
    // ============================================================================
    let success = false;
    let retries = 3;

    while (retries > 0 && !success) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); 

        const res = await fetch('https://api.football-data.org/v4/competitions/2000/matches', {
          headers: { 'X-Auth-Token': footballDataToken },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        apiMatches = data.matches || [];
        success = true;
        console.log(`✅ Sucesso na API Principal! Jogos encontrados: ${apiMatches.length}`);
      } catch (e: any) {
        retries--;
        console.warn(`⚠️ Erro na API Principal. Tentativas restantes: ${retries}. ${e.message}`);
        if (retries > 0) await new Promise(res => setTimeout(res, 2000)); 
      }
    }

    if (!success) throw new Error("A API falhou em todas as tentativas.");

    const { data: dbTeams } = await supabase.from('teams').select('id, name, flag_code')
    const { data: dbMatches } = await supabase.from('matches').select('*')

    if (!dbTeams || !dbMatches) throw new Error('Erro ao carregar banco.')

    let insertCount = 0
    let updateCount = 0

    // PREPARA O RELÓGIO PARA A NOSSA TRAVA DE SEGURANÇA
    const now = new Date();

    for (const match of apiMatches) {
      if (!['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status)) continue
      if (!match.homeTeam?.name || !match.awayTeam?.name) continue;

      const translatedHome = translateApiName(match.homeTeam.name)
      const translatedAway = translateApiName(match.awayTeam.name)

      const hId = dbTeams.find(t => normalizeName(t.name) === translatedHome || (t.flag_code && match.homeTeam.name.toLowerCase().includes(t.flag_code.toLowerCase())))?.id
      const aId = dbTeams.find(t => normalizeName(t.name) === translatedAway || (t.flag_code && match.awayTeam.name.toLowerCase().includes(t.flag_code.toLowerCase())))?.id

      if (!hId || !aId) continue;

      let dbStatus = 'pending'
      if (match.status === 'FINISHED') dbStatus = 'finished'
      else if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(match.status)) {
        // ============================================================================
        // 🛑 TRAVA DE SEGURANÇA (FORÇAR TÉRMINO)
        // Se o jogo começou há mais de 3 horas e 30 minutos (210 minutos), ele JÁ ACABOU!
        // Não importa se a API está dormindo, nós forçamos o status para FINISHED.
        // ============================================================================
        const matchStartTime = new Date(match.utcDate);
        const diffInMinutes = (now.getTime() - matchStartTime.getTime()) / (1000 * 60);
        
        if (diffInMinutes > 210) {
          dbStatus = 'finished';
          console.log(`🛑 Jogo forçado a finalizar: ${match.homeTeam.name} x ${match.awayTeam.name} (Atraso da API detectado)`);
        } else {
          dbStatus = 'in_progress';
        }
      }

      if (['england', 'inglaterra', 'spain', 'espanha', 'brazil', 'brasil'].some(t => translatedHome.includes(t) || translatedAway.includes(t))) {
        console.log(`🔎 RADAR: ${match.homeTeam.name} x ${match.awayTeam.name} | API mandou: "${match.status}" | Banco salvará: "${dbStatus}"`);
      }

      const dbPhase = PHASE_DICTIONARY[match.stage] || 'group'
      let homeScore = match.score?.fullTime?.home ?? null;
      let awayScore = match.score?.fullTime?.away ?? null;
      let dbPenaltyWinner = null;

      if (match.score?.duration === 'PENALTY_SHOOTOUT') {
        const homePen = match.score?.penalties?.home ?? 0;
        const awayPen = match.score?.penalties?.away ?? 0;
        if (homeScore !== null && awayScore !== null && homeScore !== awayScore) {
          homeScore = homeScore - homePen; awayScore = awayScore - awayPen;
        }
        if (homePen > awayPen) dbPenaltyWinner = 'home';
        else if (awayPen > homePen) dbPenaltyWinner = 'away';
      } else if (dbStatus === 'finished') {
        dbPenaltyWinner = null;
      }

      const existingMatch = dbMatches.find(m => m.api_id == match.id || (m.home_team_id === hId && m.away_team_id === aId && m.phase === dbPhase))

      await supabase.from('matches').delete().eq('home_team_id', hId).eq('away_team_id', aId).eq('phase', dbPhase).neq('id', existingMatch?.id || '00000000-0000-0000-0000-000000000000');

      if (existingMatch) {
        const needsUpdate = existingMatch.home_score !== homeScore || existingMatch.away_score !== awayScore || existingMatch.status !== dbStatus || existingMatch.penalty_winner !== dbPenaltyWinner || existingMatch.api_id != match.id || existingMatch.match_date !== match.utcDate

        if (needsUpdate) {
          console.log(`🔄 UPDATE NO BANCO: ${match.homeTeam.name} x ${match.awayTeam.name} | De: ${existingMatch.status} Para: ${dbStatus}`);
          const { error: updateError } = await supabase.from('matches').update({ api_id: match.id, match_date: match.utcDate, home_score: homeScore, away_score: awayScore, status: dbStatus, penalty_winner: dbPenaltyWinner, updated_at: new Date().toISOString() }).eq('id', existingMatch.id)
          if (!updateError) updateCount++
        }
      } else {
        const { error: insertError } = await supabase.from('matches').insert({ api_id: match.id, home_team_id: hId, away_team_id: aId, match_date: match.utcDate, phase: dbPhase, home_score: homeScore, away_score: awayScore, status: dbStatus, penalty_winner: dbPenaltyWinner })
        if (!insertError) insertCount++
      }
    }

    console.log(`🏁 FIM | Inseridos: ${insertCount} | Atualizados: ${updateCount}`);
    return new Response(JSON.stringify({ message: 'Sincronização com Trava de Tempo executada', jogos_inseridos: insertCount, jogos_atualizados: updateCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('Erro geral:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})