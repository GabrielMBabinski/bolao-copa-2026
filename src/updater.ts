import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// Environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const footballDataToken = process.env.FOOTBALL_DATA_TOKEN || ''

if (!supabaseUrl || !supabaseServiceKey || !footballDataToken) {
  console.error('Missing required environment variables')
  process.exit(1)
}

// Create Supabase client with service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateMatches() {
  console.log('Fetching matches from football-data.org API...')
  
  try {
    // Fetch matches from football-data.org API (World Cup 2026)
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

    // Get existing matches from Supabase
    const { data: existingMatches, error: fetchError } = await supabase
      .from('matches')
      .select('id, home_score, away_score, status')

    if (fetchError) {
      throw new Error(`Error fetching existing matches: ${fetchError.message}`)
    }

    const existingMatchMap = new Map(
      (existingMatches || []).map((m: any) => [m.id, m])
    )

    let updatedCount = 0
    let skippedCount = 0

    // Update matches that have changed
    for (const apiMatch of matches) {
      const existingMatch = existingMatchMap.get(String(apiMatch.id))

      if (!existingMatch) {
        console.log(`Match ${apiMatch.id} not found in database, skipping`)
        skippedCount++
        continue
      }

      const apiHomeScore = apiMatch.score?.fullTime?.home
      const apiAwayScore = apiMatch.score?.fullTime?.away
      const apiStatus = apiMatch.status

      // Map API status to database status
      let dbStatus = 'pending'
      if (apiStatus === 'FINISHED') dbStatus = 'finished'
      else if (apiStatus === 'IN_PLAY' || apiStatus === 'LIVE') dbStatus = 'in_progress'
      else if (apiStatus === 'TIMED' || apiStatus === 'SCHEDULED') dbStatus = 'pending'
      else if (apiStatus === 'POSTPONED') dbStatus = 'postponed'

      // Check if match needs update
      const needsUpdate =
        existingMatch.home_score !== apiHomeScore ||
        existingMatch.away_score !== apiAwayScore ||
        existingMatch.status !== dbStatus

      if (needsUpdate) {
        console.log(
          `Updating match ${apiMatch.id}: ${existingMatch.home_score}-${existingMatch.away_score} (${existingMatch.status}) -> ${apiHomeScore}-${apiAwayScore} (${dbStatus})`
        )

        const { error: updateError } = await supabase
          .from('matches')
          .update({
            home_score: apiHomeScore,
            away_score: apiAwayScore,
            status: dbStatus,
          })
          .eq('id', apiMatch.id)

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
