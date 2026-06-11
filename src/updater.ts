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

// Remove acentos e deixa tudo minúsculo para facilitar o cruzamento
const normalizeName = (name: string) => {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

// NOVO: Função ajudante para extrair o nome do time burlando o erro do TypeScript
const getTeamName = (teamData: any): string => {
  if (!teamData) return 'Time Desconhecido'
  // Se o Supabase trouxer como lista (Array), pegamos o primeiro item [0]
  if (Array.isArray(teamData)) return teamData[0]?.name || 'Time Desconhecido'
  // Se trouxer como objeto direto, pegamos o name
  return teamData.name || 'Time Desconhecido'
}

async function updateMatches() {
  console.log('Fetching matches from football-data.org API...')
  
  try {
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/2000/matches',
      { headers: { 'X-Auth-Token': footballDataToken } }
    )

    if (!response.ok) throw new Error(`API request failed: ${response.statusText}`)

    const data = await response.json()
    const apiMatches = data.matches || []

    console.log(`Found ${apiMatches.length} matches in API`)

    const { data: dbMatches, error: fetchError } = await supabase
      .from('matches')
      .select(`
        id, 
        api_id, 
        home_score, 
        away_score, 
        status, 
        match_date,
        home_team:home_team_id (name),
        away_team:away_team_id (name)
      `)

    if (fetchError) throw new Error(`Error fetching DB matches: ${fetchError.message}`)

    let updatedScores = 0
    let linkedIDs = 0

    for (const apiMatch of apiMatches) {
      const apiId = apiMatch.id
      const apiHomeName = normalizeName(apiMatch.homeTeam?.name || '')
      const apiAwayName = normalizeName(apiMatch.awayTeam?.name || '')
      const apiDate = new Date(apiMatch.utcDate).toISOString().split('T')[0] 

      let dbMatch = dbMatches?.find((m: any) => m.api_id === apiId)

      if (!dbMatch) {
        dbMatch = dbMatches?.find((m: any) => {
          // Usando a nossa função ajudante aqui!
          const mHomeName = normalizeName(getTeamName(m.home_team))
          const mAwayName = normalizeName(getTeamName(m.away_team))
          const mDate = new Date(m.match_date).toISOString().split('T')[0]
          
          return (
            (mHomeName.includes(apiHomeName) || apiHomeName.includes(mHomeName)) &&
            (mAwayName.includes(apiAwayName) || apiAwayName.includes(mAwayName)) &&
            mDate === apiDate
          )
        })

        if (dbMatch) {
          // Usando a nossa função ajudante aqui também para o console.log
          console.log(`🔗 LINKING: Conectando [${getTeamName(dbMatch.home_team)} x ${getTeamName(dbMatch.away_team)}] com API_ID: ${apiId}`)
          await supabase.from('matches').update({ api_id: apiId }).eq('id', dbMatch.id)
          linkedIDs++
        }
      }

      if (dbMatch) {
        const homeScore = apiMatch.score?.fullTime?.home !== null ? apiMatch.score.fullTime.home : 0
        const awayScore = apiMatch.score?.fullTime?.away !== null ? apiMatch.score.fullTime.away : 0
        const apiStatus = apiMatch.status

        let dbStatus = 'pending'
        if (apiStatus === 'FINISHED') dbStatus = 'finished'
        else if (apiStatus === 'IN_PLAY' || apiStatus === 'LIVE') dbStatus = 'in_progress'
        else if (apiStatus === 'TIMED' || apiStatus === 'SCHEDULED') dbStatus = 'pending'
        else if (apiStatus === 'POSTPONED') dbStatus = 'postponed'

        const needsUpdate =
          dbMatch.home_score !== homeScore ||
          dbMatch.away_score !== awayScore ||
          dbMatch.status !== dbStatus

        if (needsUpdate) {
          console.log(`⚽ UPDATING: ${getTeamName(dbMatch.home_team)} x ${getTeamName(dbMatch.away_team)} | ${homeScore}-${awayScore} (${dbStatus})`)
          
          const { error: updateError } = await supabase
            .from('matches')
            .update({ home_score: homeScore, away_score: awayScore, status: dbStatus })
            .eq('id', dbMatch.id)

          if (!updateError) updatedScores++
        }
      }
    }

    console.log(`\n✅ Resumo do Robô: ${linkedIDs} IDs novos casados | ${updatedScores} placares atualizados.\n`)
  } catch (error) {
    console.error('Error in updater:', error)
    process.exit(1)
  }
}

updateMatches()