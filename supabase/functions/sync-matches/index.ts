import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- DICIONÁRIO DE TRADUÇÃO (Inglês API -> Português Banco) ---
const TEAM_DICTIONARY: Record<string, string> = {
  'netherlands': 'holanda',
  'curaçao': 'curacao',
  'curacao': 'curacao',
  'cape verde islands': 'cabo verde',
  'republic of ireland': 'irlanda',
  'canada': 'canada', 'mexico': 'mexico', 'united states': 'estados unidos', 'usa': 'estados unidos',
  'panama': 'panama', 'haiti': 'haiti', 'egypt': 'egito', 'senegal': 'senegal',
  'south africa': 'africa do sul', 'cape verde': 'cabo verde', 'cabo verde': 'cabo verde', 'morocco': 'marrocos',
  'ivory coast': 'costa do marfim', "cote d'ivoire": 'costa do marfim', 'algeria': 'argelia', 'tunisia': 'tunisia',
  'ghana': 'gana', 'dr congo': 'rd congo', 'congo dr': 'rd congo', 'argentina': 'argentina', 
  'ecuador': 'equador', 'colombia': 'colombia', 'uruguay': 'uruguai', 'brazil': 'brasil',
  'paraguay': 'paraguai', 'iran': 'ira', 'ir iran': 'ira', 'south korea': 'coreia do sul', 'korea republic': 'coreia do sul',
  'japan': 'japao', 'uzbekistan': 'uzbequistao', 'jordan': 'jordania', 'australia': 'australia', 'qatar': 'catar',
  'saudi arabia': 'arabia saudita', 'iraq': 'iraque', 'new zealand': 'nova zelandia', 'germany': 'alemanha',
  'switzerland': 'suica', 'scotland': 'escocia', 'france': 'franca', 'spain': 'espanha', 'portugal': 'portugal',
  'holland': 'paises baixos', 'austria': 'austria', 'norway': 'noruega',
  'belgium': 'belgica', 'england': 'inglaterra', 'croatia': 'croacia', 'turkey': 'turquia', 'turkiye': 'turquia',
  'czech republic': 'republica tcheca', 'czechia': 'republica tcheca', 'sweden': 'suecia',
  'bosnia and herzegovina': 'bosnia e herzegovina',
  'bosnia-herzegovina': 'bosnia e herzegovina',
  'bosnia & herzegovina': 'bosnia e herzegovina',
  'bosnia': 'bosnia e herzegovina',
  'bih': 'bosnia e herzegovina'
}

const normalizeName = (name: string) => {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

const translateApiName = (apiName: string): string => {
  const normalizedApi = normalizeName(apiName)
  return TEAM_DICTIONARY[normalizedApi] || normalizedApi
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

    for (const match of matches) {
      if (!['IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status)) continue

      const dbStatus = match.status === 'FINISHED' ? 'finished' : 'in_progress'
      
      // Traduz os nomes que vêm da API para o nosso padrão em Português
      const translatedHome = translateApiName(match.homeTeam.name)
      const translatedAway = translateApiName(match.awayTeam.name)

      // Busca o ID comparando o nome traduzido com o nome normalizado (sem acentos) do banco
      const findTeamId = (translatedName: string, originalApiName: string) => {
        return teams.find(t => {
          const dbName = normalizeName(t.name)
          return dbName === translatedName || 
                 dbName.includes(translatedName) || 
                 translatedName.includes(dbName) ||
                 (t.flag_code && originalApiName.toLowerCase().includes(t.flag_code.toLowerCase()))
        })?.id;
      };

      const hId = findTeamId(translatedHome, match.homeTeam.name)
      const aId = findTeamId(translatedAway, match.awayTeam.name)

      if (!hId || !aId) {
        console.warn(`Times não mapeados: API(${match.homeTeam.name} vs ${match.awayTeam.name}) -> Tentativa(${translatedHome} vs ${translatedAway})`)
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