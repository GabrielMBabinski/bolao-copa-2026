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

// --- O TRADUTOR AUTOMÁTICO (API em Inglês -> Seu Banco em Português) ---
// Adicione outros times aqui conforme necessário
const TEAM_DICTIONARY: Record<string, string> = {
  'south africa': 'africa do sul',
  'brazil': 'brasil',
  'cameroon': 'camaroes',
  'switzerland': 'suica',
  'serbia': 'servia',
  'spain': 'espanha',
  'germany': 'alemanha',
  'england': 'inglaterra',
  'netherlands': 'holanda',
  'south korea': 'coreia do sul',
  'united states': 'estados unidos',
  'japan': 'japao',
  'croatia': 'croacia',
  'morocco': 'marrocos',
  'mexico': 'mexico',
  'czech republic': 'republica tcheca',
  'czechia': 'republica tcheca',
  'saudi arabia': 'arabia saudita'
}

// Limpa acentos e deixa em minúsculo
const normalizeName = (name: string) => {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

// Extrai o nome burlando erros de formato
const getTeamName = (teamData: any): string => {
  if (!teamData) return ''
  if (Array.isArray(teamData)) return teamData[0]?.name || ''
  return teamData.name || ''
}

// Pega o nome da API e passa pelo tradutor
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
      // Traduz o nome do time da API para o Português do seu banco
      const translatedHome = translateApiName(apiMatch.homeTeam?.name || '')
      const translatedAway = translateApiName(apiMatch.awayTeam?.name || '')
      const apiDate = new Date(apiMatch.utcDate).toISOString().split('T')[0] 

      let dbMatch = dbMatches?.find((m: any) => m.api_id === apiId)

      // SE NÃO TEM ID AINDA: Faz o casamento automático usando o nome traduzido
      if (!dbMatch) {
        dbMatch = dbMatches?.find((m: any) => {
          const mHome = normalizeName(getTeamName(m.home_team))
          const mAway = normalizeName(getTeamName(m.away_team))
          const mDate = new Date(m.match_date).toISOString().split('T')[0]
          
          return (
            (mHome.includes(translatedHome) || translatedHome.includes(mHome)) &&
            (mAway.includes(translatedAway) || translatedAway.includes(mAway)) &&
            mDate === apiDate
          )
        })

        if (dbMatch) {
          console.log(`🔗 AUTO-LINK: Casando [${getTeamName(dbMatch.home_team)} x ${getTeamName(dbMatch.away_team)}] -> API ID: ${apiId}`)
          await supabase.from('matches').update({ api_id: apiId }).eq('id', dbMatch.id)
          linkedIDs++
        }
      }

      // Atualiza o placar e dispara o ranking
      if (dbMatch) {
        const homeScore = apiMatch.score?.fullTime?.home !== null ? apiMatch.score.fullTime.home : 0
        const awayScore = apiMatch.score?.fullTime?.away !== null ? apiMatch.score.fullTime.away : 0
        const apiStatus = apiMatch.status

        let dbStatus = 'pending'
        if (apiStatus === 'FINISHED') dbStatus = 'finished'
        else if (apiStatus === 'IN_PLAY' || apiStatus === 'LIVE') dbStatus = 'in_progress'

        const needsUpdate =
          dbMatch.home_score !== homeScore ||
          dbMatch.away_score !== awayScore ||
          dbMatch.status !== dbStatus

        if (needsUpdate) {
          console.log(`⚽ GOL/FIM DE JOGO: ${getTeamName(dbMatch.home_team)} x ${getTeamName(dbMatch.away_team)} | ${homeScore}-${awayScore} (${dbStatus})`)
          
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