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
        const matchStartTime = new Date(match.utcDate);
        const diffInMinutes = (now.getTime() - matchStartTime.getTime()) / (1000 * 60);
        
        if (diffInMinutes > 210) {
          dbStatus = 'finished';
        } else {
          dbStatus = 'in_progress';
        }
      }

      const dbPhase = PHASE_DICTIONARY[match.stage] || 'group'

      // ============================================================================
      // 🧠 LÓGICA INTELIGENTE DE PÊNALTIS E VENCEDOR
      // ============================================================================
      let homeScore = match.score?.fullTime?.home ?? null;
      let awayScore = match.score?.fullTime?.away ?? null;
      let dbPenaltyWinner = null;

      const homePen = match.score?.penalties?.home;
      const awayPen = match.score?.penalties?.away;
      
      const isPenalty = match.score?.duration === 'PENALTY_SHOOTOUT' || (homePen !== undefined && homePen !== null);

      if (isPenalty) {
        // TENTA DESCOBRIR O VENCEDOR PELOS GOLS
        if (homePen !== undefined && homePen !== null && awayPen !== undefined && awayPen !== null) {
          if (homePen > awayPen) dbPenaltyWinner = 'home';
          else if (awayPen > homePen) dbPenaltyWinner = 'away';
        }
        
        // PLANO B: SE A API OMITIU OS GOLS, MAS DISSE QUEM AVANÇOU
        if (!dbPenaltyWinner && match.score?.winner) {
          if (match.score.winner === 'HOME_TEAM') dbPenaltyWinner = 'home';
          else if (match.score.winner === 'AWAY_TEAM') dbPenaltyWinner = 'away';
        }

        // ENCONTRA O PLACAR REAL DO EMPATE
        const etHome = match.score?.extraTime?.home;
        const etAway = match.score?.extraTime?.away;
        const rtHome = match.score?.regularTime?.home;
        const rtAway = match.score?.regularTime?.away;

        if (etHome !== undefined && etHome !== null && etHome === etAway) {
          homeScore = etHome;
          awayScore = etAway;
        } else if (rtHome !== undefined && rtHome !== null && rtHome === rtAway) {
          homeScore = rtHome;
          awayScore = rtAway;
        } else if (homeScore !== null && awayScore !== null) {
          const hSub = homeScore - (homePen ?? 0);
          const aSub = awayScore - (awayPen ?? 0);
          
          if (hSub === aSub && hSub >= 0) {
            homeScore = hSub;
            awayScore = aSub;
          } else {
            const trueScore = Math.min(homeScore, awayScore);
            homeScore = trueScore;
            awayScore = trueScore;
          }
        }
      } else if (dbStatus === 'finished') {
        dbPenaltyWinner = null;
      }

      const existingMatch = dbMatches.find(m => m.api_id == match.id || (m.home_team_id === hId && m.away_team_id === aId && m.phase === dbPhase))

      await supabase.from('matches').delete().eq('home_team_id', hId).eq('away_team_id', aId).eq('phase', dbPhase).neq('id', existingMatch?.id || '00000000-0000-0000-0000-000000000000');

      if (existingMatch) {
        const isDateDifferent = new Date(existingMatch.match_date).getTime() !== new Date(match.utcDate).getTime();
        
        // ============================================================================
        // 🛡️ PROTEÇÃO ABSOLUTA DE DADOS
        // ============================================================================
        let finalHomeScore = homeScore;
        let finalAwayScore = awayScore;
        let finalPenaltyWinner = dbPenaltyWinner;

        if (existingMatch.status === 'finished') {
          // 1. Mantém o placar intocável se o jogo já tinha acabado
          finalHomeScore = existingMatch.home_score;
          finalAwayScore = existingMatch.away_score;
          
          // 2. Se o banco já tinha o vencedor dos pênaltis, preserva. 
          // Se o banco não tinha (estava null) e a API agora mandou, a gente atualiza!
          if (existingMatch.penalty_winner) {
            finalPenaltyWinner = existingMatch.penalty_winner;
          }
        }

        const needsUpdate =
          existingMatch.home_score !== finalHomeScore ||
          existingMatch.away_score !== finalAwayScore ||
          existingMatch.status !== dbStatus ||
          existingMatch.penalty_winner !== finalPenaltyWinner ||
          String(existingMatch.api_id) !== String(match.id) ||
          isDateDifferent;

        if (needsUpdate) {
          console.log(`🔄 TENTANDO UPDATE: ${match.homeTeam.name} x ${match.awayTeam.name} | De: ${existingMatch.status} (${existingMatch.home_score}x${existingMatch.away_score} Pen:${existingMatch.penalty_winner}) Para: ${dbStatus} (${finalHomeScore}x${finalAwayScore} Pen:${finalPenaltyWinner})`);
          
          const { error: updateError } = await supabase
            .from('matches')
            .update({ 
              api_id: match.id, 
              match_date: match.utcDate, 
              home_score: finalHomeScore, 
              away_score: finalAwayScore, 
              status: dbStatus, 
              penalty_winner: finalPenaltyWinner, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', existingMatch.id)
            
          if (updateError) {
            console.error(`❌ O BANCO REJEITOU A ATUALIZAÇÃO DE ${match.homeTeam.name}:`, updateError.message, updateError.details, updateError.hint);
          } else {
            updateCount++;
          }
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