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

// --- DICIONÁRIO DE FASES (Normalização para o Banco) ---
const PHASE_DICTIONARY: Record<string, string> = {
  // API Principal (football-data)
  'GROUP_STAGE': 'group',
  'LAST_32': 'round_32', 'ROUND_OF_32': 'round_32',
  'LAST_16': 'round_16', 'ROUND_OF_16': 'round_16',
  'QUARTER_FINALS': 'quarter',
  'SEMI_FINALS': 'semi',
  'FINAL': 'final',
  'THIRD_PLACE': 'third_place',
  // Fallback API (API-Football)
  'Group Stage': 'group',
  'Round of 32': 'round_32',
  'Round of 16': 'round_16', '16th Finals': 'round_16',
  'Quarter-finals': 'quarter',
  'Semi-finals': 'semi',
  'Final': 'final',
  '3rd Place Final': 'third_place'
}

// Interface padronizada que nossa lógica interna vai consumir (independente de qual API funcionou)
interface NormalizedMatch {
  id: string | number;
  homeTeamName: string;
  awayTeamName: string;
  utcDate: string;
  stage: string;
  status: string; // 'SCHEDULED', 'IN_PLAY', 'FINISHED'
  scoreHome: number | null;
  scoreAway: number | null;
  penaltiesHome: number | null;
  penaltiesAway: number | null;
  duration: string; // 'REGULAR', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'
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
    console.warn('Tentativa de acesso negada à Edge Function.')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const footballDataToken = Deno.env.get('FOOTBALL_DATA_TOKEN')!
    const apiFootballKey = Deno.env.get('API_FOOTBALL_KEY') // NOVO SEGREDO NECESSÁRIO!

    if (!footballDataToken) throw new Error('FOOTBALL_DATA_TOKEN não configurado')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    let normalizedMatches: NormalizedMatch[] = [];

    // ============================================================================
    // TENTATIVA 1: API PRINCIPAL (football-data.org)
    // ============================================================================
    let successOnMain = false;
    let retries = 3;

    console.log("Iniciando Tentativa na API Principal...");
    while (retries > 0 && !successOnMain) {
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
        
        // Traduz o formato da API 1 para o nosso Formato Universal
        normalizedMatches = (data.matches || []).map((m: any) => ({
          id: m.id,
          homeTeamName: m.homeTeam?.name,
          awayTeamName: m.awayTeam?.name,
          utcDate: m.utcDate,
          stage: m.stage,
          status: m.status, // Usa os status originais deles
          scoreHome: m.score?.fullTime?.home ?? null,
          scoreAway: m.score?.fullTime?.away ?? null,
          penaltiesHome: m.score?.penalties?.home ?? null,
          penaltiesAway: m.score?.penalties?.away ?? null,
          duration: m.score?.duration || 'REGULAR'
        }));
        
        console.log("✅ Sucesso na API Principal!");
        successOnMain = true;
      } catch (e: any) {
        retries--;
        console.warn(`⚠️ Erro na API Principal. Tentativas restantes: ${retries}. ${e.message}`);
        if (retries > 0) await new Promise(res => setTimeout(res, 2000)); 
      }
    }

    // ============================================================================
    // TENTATIVA 2: API FALLBACK (API-Football) - Só roda se a principal falhar!
    // ============================================================================
    if (!successOnMain) {
      console.log("Iniciando Tentativa na API Fallback...");
      if (!apiFootballKey) throw new Error("API Principal falhou e a Chave do Fallback (API_FOOTBALL_KEY) não está configurada nos Secrets.");

      try {
        // ID da Copa do Mundo na API-Football é 1 (2026 World Cup)
        const resFallback = await fetch('https://v3.football.api-sports.io/fixtures?league=1&season=2026', {
          headers: {
            'x-rapidapi-host': 'v3.football.api-sports.io',
            'x-apisports-key': apiFootballKey 
          }
        });

        if (!resFallback.ok) throw new Error(`HTTP ${resFallback.status}`);

        const dataFallback = await resFallback.json();
        
        // Traduz o formato da API 2 para o nosso Formato Universal
        normalizedMatches = (dataFallback.response || []).map((m: any) => {
          let duration = 'REGULAR';
          if (m.fixture.status.short === 'PEN') duration = 'PENALTY_SHOOTOUT';
          else if (m.fixture.status.short === 'AET') duration = 'EXTRA_TIME';

          let mappedStatus = 'SCHEDULED';
          if (['FT', 'AET', 'PEN'].includes(m.fixture.status.short)) mappedStatus = 'FINISHED';
          else if (['1H', 'HT', '2H', 'ET', 'BT', 'P'].includes(m.fixture.status.short)) mappedStatus = 'IN_PLAY';
          else if (['SUSP', 'INT'].includes(m.fixture.status.short)) mappedStatus = 'PAUSED';

          return {
            id: m.fixture.id,
            homeTeamName: m.teams.home.name,
            awayTeamName: m.teams.away.name,
            utcDate: m.fixture.date,
            stage: m.league.round, // API-Football manda a fase no campo round
            status: mappedStatus, 
            scoreHome: m.goals.home ?? null, // Gols normais
            scoreAway: m.goals.away ?? null,
            penaltiesHome: m.score.penalty.home ?? null, // Gols de penalti
            penaltiesAway: m.score.penalty.away ?? null,
            duration: duration
          };
        });

        console.log("✅ Sucesso na API Fallback!");
      } catch (e: any) {
        console.error("❌ Catástrofe: Ambas as APIs falharam.", e.message);
        throw new Error('Falha completa: Nenhuma das APIs conseguiu retornar os dados dos jogos.');
      }
    }


    // ============================================================================
    // LÓGICA DE ATUALIZAÇÃO DO SUPABASE (Consumindo os Dados Normalizados)
    // ============================================================================
    const { data: dbTeams } = await supabase.from('teams').select('id, name, flag_code')
    const { data: dbMatches } = await supabase.from('matches').select('*')

    if (!dbTeams || !dbMatches) throw new Error('Erro ao carregar dados bases do Supabase.')

    let insertCount = 0
    let updateCount = 0

    for (const match of normalizedMatches) {
      if (!['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status)) continue

      if (!match.homeTeamName || !match.awayTeamName) continue;

      const translatedHome = translateApiName(match.homeTeamName)
      const translatedAway = translateApiName(match.awayTeamName)

      const findTeamId = (translatedName: string, originalApiName: string) => {
        return dbTeams.find(t => {
          const dbName = normalizeName(t.name)
          return dbName === translatedName ||
            dbName.includes(translatedName) ||
            translatedName.includes(dbName) ||
            (t.flag_code && originalApiName.toLowerCase().includes(t.flag_code.toLowerCase()))
        })?.id
      }

      const hId = findTeamId(translatedHome, match.homeTeamName)
      const aId = findTeamId(translatedAway, match.awayTeamName)

      if (!hId || !aId) continue;

      let dbStatus = 'pending'
      if (match.status === 'FINISHED') dbStatus = 'finished'
      else if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(match.status)) dbStatus = 'in_progress'

      // Usa o dicionário expandido para garantir que traduz a fase independente da API que enviou
      const dbPhase = PHASE_DICTIONARY[match.stage] || 'group'

      let homeScore = match.scoreHome;
      let awayScore = match.scoreAway;
      let dbPenaltyWinner = null;

      if (match.duration === 'PENALTY_SHOOTOUT') {
        const homePen = match.penaltiesHome ?? 0;
        const awayPen = match.penaltiesAway ?? 0;

        if (homeScore !== null && awayScore !== null && homeScore !== awayScore) {
          homeScore = homeScore - homePen;
          awayScore = awayScore - awayPen;
        }

        if (homePen > awayPen) dbPenaltyWinner = 'home';
        else if (awayPen > homePen) dbPenaltyWinner = 'away';
        
      } else if (match.status === 'FINISHED') {
        dbPenaltyWinner = null;
      }

      const existingMatch = dbMatches.find(m =>
        m.api_id == match.id || // Usei == para permitir string(api1) com number(api2)
        (m.home_team_id === hId && m.away_team_id === aId && m.phase === dbPhase)
      )

      await supabase
        .from('matches')
        .delete()
        .eq('home_team_id', hId)
        .eq('away_team_id', aId)
        .eq('phase', dbPhase)
        .neq('id', existingMatch?.id || '00000000-0000-0000-0000-000000000000');

      if (existingMatch) {
        const needsUpdate =
          existingMatch.home_score !== homeScore ||
          existingMatch.away_score !== awayScore ||
          existingMatch.status !== dbStatus ||
          existingMatch.penalty_winner !== dbPenaltyWinner ||
          existingMatch.api_id != match.id ||
          existingMatch.match_date !== match.utcDate

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
          console.log(`✅ NOVO CONFRONTO INSERIDO: ${match.homeTeamName} x ${match.awayTeamName} (${dbPhase})`)
          insertCount++
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