import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const footballDataToken = Deno.env.get('FOOTBALL_DATA_TOKEN')!

    if (!footballDataToken) {
      console.error('FOOTBALL_DATA_TOKEN not set')
      return new Response(
        JSON.stringify({ error: 'FOOTBALL_DATA_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role key for admin privileges
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch today's matches from football-data.org
    // World Cup 2026 competition ID is 2002 (this may need to be updated)
    const today = new Date().toISOString().split('T')[0]
    const apiUrl = `https://api.football-data.org/v4/competitions/2002/matches?dateFrom=${today}&dateTo=${today}`

    console.log(`Fetching matches from football-data.org for ${today}`)

    const response = await fetch(apiUrl, {
      headers: {
        'X-Auth-Token': footballDataToken,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Football-data.org API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch from football-data.org', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const matches = data.matches || []

    console.log(`Found ${matches.length} matches for ${today}`)

    if (matches.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No matches found for today', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all teams from database to create a mapping
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, flag_code')

    if (!teams) {
      console.error('No teams found in database')
      return new Response(
        JSON.stringify({ error: 'No teams found in database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create team name mapping (normalize names for matching)
    const teamMap = new Map()
    teams.forEach((team) => {
      teamMap.set(team.name.toLowerCase(), team.id)
      // Add common variations
      teamMap.set(team.flag_code.toLowerCase(), team.id)
    })

    let updatedCount = 0
    const updateErrors: string[] = []

    // Process each finished match
    for (const match of matches) {
      if (match.status !== 'FINISHED') {
        continue
      }

      const homeTeamName = match.homeTeam.name
      const awayTeamName = match.awayTeam.name
      const homeScore = match.score.fullTime.home
      const awayScore = match.score.fullTime.away

      // Find team IDs in our database
      const homeTeamId = teamMap.get(homeTeamName.toLowerCase()) ||
                         teamMap.get(homeTeamName.toLowerCase().replace(/\s/g, ''))
      const awayTeamId = teamMap.get(awayTeamName.toLowerCase()) ||
                         teamMap.get(awayTeamName.toLowerCase().replace(/\s/g, ''))

      if (!homeTeamId || !awayTeamId) {
        console.warn(`Could not find team IDs for ${homeTeamName} vs ${awayTeamName}`)
        updateErrors.push(`Teams not found: ${homeTeamName} vs ${awayTeamName}`)
        continue
      }

      // Find the corresponding match in our database
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id, status')
        .eq('home_team_id', homeTeamId)
        .eq('away_team_id', awayTeamId)
        .eq('phase', 'group')
        .single()

      if (!existingMatch) {
        console.warn(`Match not found in database: ${homeTeamName} vs ${awayTeamName}`)
        updateErrors.push(`Match not found: ${homeTeamName} vs ${awayTeamName}`)
        continue
      }

      // Only update if not already finished
      if (existingMatch.status === 'finished') {
        console.log(`Match already finished: ${homeTeamName} vs ${awayTeamName}`)
        continue
      }

      // Update the match with the result
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          status: 'finished',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMatch.id)

      if (updateError) {
        console.error(`Error updating match ${existingMatch.id}:`, updateError)
        updateErrors.push(`Update failed: ${homeTeamName} vs ${awayTeamName}`)
        continue
      }

      console.log(`Updated match: ${homeTeamName} ${homeScore} - ${awayScore} ${awayTeamName}`)
      updatedCount++
    }

    return new Response(
      JSON.stringify({
        message: 'Sync completed',
        totalMatches: matches.length,
        updatedMatches: updatedCount,
        errors: updateErrors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in sync-matches function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
