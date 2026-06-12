import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const footballDataToken = process.env.FOOTBALL_DATA_TOKEN || ''

if (!supabaseUrl || !supabaseServiceKey || !footballDataToken) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// --- DICIONÁRIO BLINDADO (Com variações da Bósnia) ---
const TEAM_DICTIONARY: Record<string, string> = {
  'curaçao': 'curacau',
  'cape verde islands': 'cabo verde',
  'republic of ireland': 'irlanda',
  'canada': 'canada', 'mexico': 'mexico', 'united states': 'estados unidos', 'usa': 'estados unidos',
  'panama': 'panama', 'curacao': 'curacau', 'haiti': 'haiti', 'egypt': 'egito', 'senegal': 'senegal',
  'south africa': 'africa do sul', 'cape verde': 'cabo verde', 'cabo verde': 'cabo verde', 'morocco': 'marrocos',
  'ivory coast': 'costa do marfim', "cote d'ivoire": 'costa do marfim', 'algeria': 'argelia', 'tunisia': 'tunisia',
  'ghana': 'gana', 'dr congo': 'rd congo', 'congo dr': 'rd congo', 'argentina': 'argentina', 
  'ecuador': 'equador', 'colombia': 'colombia', 'uruguay': 'uruguai', 'brazil': 'brasil',
  'paraguay': 'paraguai', 'iran': 'ira', 'ir iran': 'ira', 'south korea': 'coreia do sul', 'korea republic': 'coreia do sul',
  'japan': 'japao', 'uzbekistan': 'uzbequistao', 'jordan': 'jordania', 'australia': 'australia', 'qatar': 'catar',
  'saudi arabia': 'arabia saudita', 'iraq': 'iraque', 'new zealand': 'nova zelandia', 'germany': 'alemanha',
  'switzerland': 'suica', 'scotland': 'escocia', 'france': 'franca', 'spain': 'espanha', 'portugal': 'portugal',
  'netherlands': 'paises baixos', 'holland': 'paises baixos', 'austria': 'austria', 'norway': 'noruega',
  'belgium': 'belgica', 'england': 'inglaterra', 'croatia': 'croacia', 'turkey': 'turquia', 'turkiye': 'turquia',
  'czech republic': 'republica tcheca', 'czechia': 'republica tcheca', 'sweden': 'suecia',
  
  // O Arsenal contra a Bósnia:
  'bosnia and herzegovina': 'bosnia e herzegovina',
  'bosnia-herzegovina': 'bosnia e herzegovina',
  'bosnia & herzegovina': 'bosnia e herzegovina',
  'bosnia': 'bosnia e herzegovina',
  'bih': 'bosnia e herzegovina'
}

const normalizeName = (name: string) => {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

const getTeamName = (teamData: any): string => {
  if (!teamData) return ''
  if (Array.isArray(teamData)) return teamData[0]?.name || ''
  return teamData.name || ''
}

const translateApiName = (apiName: string): string => {
  const normalizedApi = normalizeName(apiName)
  return TEAM_DICTIONARY[normalizedApi] || normalizedApi
}

async function updateMatches() {
  console.log('Iniciando sincronização automática com a API...')
  
  try {
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/2000/matches',
      { headers: { 'X-Auth-Token': footballDataToken } }
    )

    if (!response.ok) throw new Error(`API falhou: ${response.statusText}`)

    const data = await response.json()
    const apiMatches = data.matches || []

    const { data: dbMatches, error: fetchError } = await supabase
      .from('matches')
      .select('id, api_id, home_score, away_score, status, match_date, home_team:home_team_id(name), away_team:away_team_id(name)')

    if (fetchError) throw new Error(`Erro no Supabase: ${fetchError.message}`)

    let updatedScores = 0
    let linkedIDs = 0

    for (const apiMatch of apiMatches) {
      const apiId = apiMatch.id
      const rawApiHome = apiMatch.homeTeam?.name || ''
      const rawApiAway = apiMatch.awayTeam?.name || ''
      
      const translatedHome = translateApiName(rawApiHome)
      const translatedAway = translateApiName(rawApiAway)

      let dbMatch = dbMatches?.find((m: any) => m.api_id === apiId)

      // Casamento Automático
      if (!dbMatch) {
        dbMatch = dbMatches?.find((m: any) => {
          const mHome = normalizeName(getTeamName(m.home_team))
          const mAway = normalizeName(getTeamName(m.away_team))
          
          if (!mHome || !mAway || !translatedHome || !translatedAway) return false;

          return (
            (mHome.includes(translatedHome) || translatedHome.includes(mHome)) &&
            (mAway.includes(translatedAway) || translatedAway.includes(mAway))
          )
        })

        if (dbMatch) {
          console.log(`🔗 AUTO-LINK: Casando [${getTeamName(dbMatch.home_team)} x ${getTeamName(dbMatch.away_team)}] -> API ID: ${apiId}`)
          await supabase.from('matches').update({ api_id: apiId }).eq('id', dbMatch.id)
          linkedIDs++
        } else {
          // RADAR DE JOGOS PERDIDOS: Se não casar, ele dedura o nome!
          console.log(`⚠️ Jogo da API não encontrado no seu banco: ${rawApiHome} x ${rawApiAway}`)
        }
      }

      // Atualiza o placar
      if (dbMatch) {
        const homeScore = apiMatch.score?.fullTime?.home ?? null
        const awayScore = apiMatch.score?.fullTime?.away ?? null
        const apiStatus = apiMatch.status

        let dbStatus = 'pending'
        if (apiStatus === 'FINISHED') dbStatus = 'finished'
        else if (apiStatus === 'IN_PLAY' || apiStatus === 'LIVE') dbStatus = 'in_progress'

        const needsUpdate =
          dbMatch.home_score !== homeScore ||
          dbMatch.away_score !== awayScore ||
          dbMatch.status !== dbStatus

        if (needsUpdate) {
          console.log(`⚽ ATUALIZANDO: ${getTeamName(dbMatch.home_team)} x ${getTeamName(dbMatch.away_team)} | ${homeScore ?? 'nulo'}-${awayScore ?? 'nulo'} (${dbStatus})`)
          
          const { error: updateError } = await supabase
            .from('matches')
            .update({ home_score: homeScore, away_score: awayScore, status: dbStatus })
            .eq('id', dbMatch.id)

          if (!updateError) updatedScores++
        }
      }
    }

    console.log(`\n✅ Automação Concluída! ${linkedIDs} novos jogos casados | ${updatedScores} placares atualizados no banco.`)
  } catch (error) {
    console.error('Erro geral no robô:', error)
    process.exit(1)
  }
}

updateMatches()