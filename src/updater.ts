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

async function updateMatches() {
  console.log('Fetching matches from football-data.org API...')
  
  try {
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/2000/matches',
      {
        headers: {
          'X-Auth-Token': footballDataToken,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    const data = await response.json()
    const matches = data.matches || []

    console.log(`Found ${matches.length} matches in API`)
    
    // RADAR: Imprime a lista de jogos para você saber qual ID colocar no banco
    console.log('\n--- MAPA DE IDs DA API (Use isso para preencher o seu Supabase) ---')
    matches.forEach((m: any) => {
      console.log(`API ID: ${m.id} | ${m.homeTeam?.name || 'TBD'} x ${m.awayTeam?.name || 'TBD'}`)
    })
    console.log('----------------------------------------------------------------\n')

    // Puxa os jogos do Supabase, agora incluindo a nova coluna api_id
    const { data: existingMatches, error: fetchError } = await supabase
      .from('matches')
      .select('id, api_id, home_score, away_score, status')

    if (fetchError) {
      throw new Error(`Error fetching existing matches: ${fetchError.message}`)
    }

    // Cria o mapa baseando-se no api_id (e ignora os que ainda estão sem)
    const existingMatchMap = new Map(
      (existingMatches || [])
        .filter((m: any) => m.api_id != null)
        .map((m: any) => [String(m.api_id), m])
    )

    let updatedCount = 0
    let skippedCount = 0

    for (const apiMatch of matches) {
      // Agora ele procura pelo ID da API, não pelo UUID!
      const existingMatch = existingMatchMap.get(String(apiMatch.id))

      if (!existingMatch) {
        skippedCount++
        continue
      }

      const apiHomeScore = apiMatch.score?.fullTime?.home
      const apiAwayScore = apiMatch.score?.fullTime?.away
      const apiStatus = apiMatch.status

      let dbStatus = 'pending'
      if (apiStatus === 'FINISHED') dbStatus = 'finished'
      else if (apiStatus === 'IN_PLAY' || apiStatus === 'LIVE') dbStatus = 'in_progress'
      else if (apiStatus === 'TIMED' || apiStatus === 'SCHEDULED') dbStatus = 'pending'
      else if (apiStatus === 'POSTPONED') dbStatus = 'postponed'

      // Se a API mandar os placares vazios (jogo não começou), tratamos como zero temporariamente ou ignoramos
      const homeScore = apiHomeScore !== null ? apiHomeScore : 0
      const awayScore = apiAwayScore !== null ? apiAwayScore : 0

      const needsUpdate =
        existingMatch.home_score !== homeScore ||
        existingMatch.away_score !== awayScore ||
        existingMatch.status !== dbStatus

      if (needsUpdate) {
        console.log(
          `Updating match ${apiMatch.id}: ${existingMatch.home_score}-${existingMatch.away_score} (${existingMatch.status}) -> ${homeScore}-${awayScore} (${dbStatus})`
        )

        const { error: updateError } = await supabase
          .from('matches')
          .update({
            home_score: homeScore,
            away_score: awayScore,
            status: dbStatus,
          })
          .eq('id', existingMatch.id) // Atualiza usando a chave primária real do Supabase

        if (updateError) {
          console.error(`Error updating match ${apiMatch.id}: ${updateError.message}`)
        } else {
          updatedCount++
        }
      } else {
        skippedCount++
      }
    }

    console.log(`Update complete: ${updatedCount} matches updated, ${skippedCount} skipped`)
  } catch (error) {
    console.error('Error updating matches:', error)
    process.exit(1)
  }
}

updateMatches()