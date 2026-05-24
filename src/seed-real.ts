import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const teamTranslations: Record<string, string> = {
  'Canada': 'Canadá', 'United States': 'Estados Unidos', 'USA': 'Estados Unidos', 'Mexico': 'México',
  'Curaçao': 'Curaçao', 'Haiti': 'Haiti', 'Panama': 'Panamá', 'Japan': 'Japão', 'Iran': 'Irã',
  'Uzbekistan': 'Uzbequistão', 'South Korea': 'Coreia do Sul', 'Korea Republic': 'Coreia do Sul',
  'Jordan': 'Jordânia', 'Australia': 'Austrália', 'Qatar': 'Catar', 'Saudi Arabia': 'Arábia Saudita',
  'New Zealand': 'Nova Zelândia', 'Argentina': 'Argentina', 'Brazil': 'Brasil', 'Ecuador': 'Equador',
  'Uruguay': 'Uruguai', 'Colombia': 'Colômbia', 'Paraguay': 'Paraguai', 'Morocco': 'Marrocos',
  'Tunisia': 'Tunísia', 'Egypt': 'Egito', 'Algeria': 'Argélia', 'Ghana': 'Gana', 'Cape Verde': 'Cabo Verde',
  'South Africa': 'África do Sul', 'Ivory Coast': 'Costa do Marfim', 'Senegal': 'Senegal',
  'England': 'Inglaterra', 'France': 'França', 'Croatia': 'Croácia', 'Portugal': 'Portugal',
  'Norway': 'Noruega', 'Netherlands': 'Holanda', 'Germany': 'Alemanha', 'Switzerland': 'Suíça',
  'Austria': 'Áustria', 'Belgium': 'Bélgica', 'Spain': 'Espanha', 'Scotland': 'Escócia',
  'Turkey': 'Turquia', 'Czech Republic': 'República Tcheca', 'Czechia': 'República Tcheca',
  'Sweden': 'Suécia', 'Bosnia and Herzegovina': 'Bósnia e Herzegovina', 'DR Congo': 'RD Congo',
  'Congo DR': 'RD Congo', 'Iraq': 'Iraque'
};

// Environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const footballDataToken = process.env.FOOTBALL_DATA_TOKEN || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment variables')
  process.exit(1)
}

if (!footballDataToken) {
  console.error('FOOTBALL_DATA_TOKEN not found in environment variables')
  process.exit(1)
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Interface for API response
interface Match {
  id: number
  utcDate: string
  status: string
  homeTeam: { id: number; name: string; crest: string }
  awayTeam: { id: number; name: string; crest: string }
  score: {
    fullTime: { home: number | null; away: number | null }
  }
  group?: string
}

interface Competition {
  matches: Match[]
}

async function truncateTables() {
  console.log('Limpando tabelas...')
  
  try {
    await supabase.rpc('sql', { query: 'TRUNCATE TABLE predictions CASCADE' })
    await supabase.rpc('sql', { query: 'TRUNCATE TABLE matches CASCADE' })
    await supabase.rpc('sql', { query: 'TRUNCATE TABLE teams CASCADE' })
    console.log('Tabelas limpas com sucesso!')
  } catch (error) {
    console.error('Erro ao limpar tabelas:', error)
    throw error
  }
}

async function fetchWorldCupData() {
  console.log('Buscando dados da Copa do Mundo na API football-data.org...')
  
  try {
    // Try World Cup 2022 first (ID 2000), then check for 2026
    // World Cup 2022 competition ID is 2000
    const response = await fetch('https://api.football-data.org/v4/competitions/2000/matches', {
      headers: {
        'X-Auth-Token': footballDataToken,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed: ${response.status} - ${errorText}`)
    }

    const data: Competition = await response.json()
    console.log(`Encontradas ${data.matches.length} partidas na API`)
    
    // Log sample match structure for debugging
    if (data.matches.length > 0) {
      console.log('Estrutura de uma partida de exemplo:', JSON.stringify(data.matches[0], null, 2))
    }
    
    return data
  } catch (error) {
    console.error('Erro ao buscar dados da API:', error)
    throw error
  }
}

function extractTeams(matches: Match[]): Map<string, { name: string; flag_code: string; group_name: string }> {
  console.log('Extraindo seleções das partidas...')
  
  const teams = new Map<string, { name: string; flag_code: string; group_name: string }>()
  
  for (const match of matches) {
    if (match.group) {
      // Convert "GROUP_A" to "A"
      const groupName = match.group.replace('GROUP_', '').toUpperCase()
      
      // Extract flag code from crest URL or use team ID
      const homeFlagCode = match.homeTeam.crest ? 
        match.homeTeam.crest.split('/').pop()?.replace('.svg', '').toUpperCase() || 
        `TEAM${match.homeTeam.id}` : 
        `TEAM${match.homeTeam.id}`
      
      const awayFlagCode = match.awayTeam.crest ? 
        match.awayTeam.crest.split('/').pop()?.replace('.svg', '').toUpperCase() || 
        `TEAM${match.awayTeam.id}` : 
        `TEAM${match.awayTeam.id}`
      
      teams.set(match.homeTeam.name, {
        name: match.homeTeam.name,
        flag_code: homeFlagCode,
        group_name: groupName
      })
      
      teams.set(match.awayTeam.name, {
        name: match.awayTeam.name,
        flag_code: awayFlagCode,
        group_name: groupName
      })
    }
  }
  
  console.log(`Extraídas ${teams.size} seleções únicas`)
  return teams
}

async function insertTeams(teams: Map<string, { name: string; flag_code: string; group_name: string }>) {
  console.log('Inserindo seleções no banco de dados...')
  
  const teamsArray = Array.from(teams.values())
  
  try {
    const { error } = await supabase.from('teams').insert(teamsArray)
    
    if (error) {
      console.error('Erro ao inserir seleções:', error)
      throw error
    }
    
    console.log(`${teamsArray.length} seleções inseridas com sucesso!`)
  } catch (error) {
    console.error('Erro ao inserir seleções:', error)
    throw error
  }
}

async function getTeamIds(teamNames: string[]): Promise<Map<string, string>> {
  console.log('Buscando IDs das seleções inseridas...')
  
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name')
      .in('name', teamNames)
    
    if (error) {
      console.error('Erro ao buscar IDs das seleções:', error)
      throw error
    }
    
    const teamMap = new Map<string, string>()
    if (data) {
      for (const team of data) {
        teamMap.set(team.name, team.id)
      }
    }
    
    console.log(`${teamMap.size} IDs de seleções mapeados`)
    return teamMap
  } catch (error) {
    console.error('Erro ao buscar IDs das seleções:', error)
    throw error
  }
}

async function insertMatches(matches: Match[], teamIds: Map<string, string>) {
  console.log('Inserindo partidas no banco de dados...')
  
  const matchesToInsert = []
  let insertedCount = 0
  let skippedCount = 0
  
  for (const match of matches) {
    if (!match.group) continue
    
    const homeTeamId = teamIds.get(match.homeTeam.name)
    const awayTeamId = teamIds.get(match.awayTeam.name)
    
    if (!homeTeamId || !awayTeamId) {
      console.warn(`Não encontrado ID para ${match.homeTeam.name} ou ${match.awayTeam.name}`)
      skippedCount++
      continue
    }
    
    // Determine match status
    let status: 'pending' | 'in_progress' | 'finished' = 'pending'
    if (match.status === 'FINISHED') {
      status = 'finished'
    } else if (match.status === 'IN_PLAY' || match.status === 'PAUSED') {
      status = 'in_progress'
    }
    
    matchesToInsert.push({
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      match_date: match.utcDate,
      phase: 'group',
      status: status,
      home_score: match.score.fullTime.home,
      away_score: match.score.fullTime.away,
    })
    
    insertedCount++
  }
  
  try {
    const { error } = await supabase.from('matches').insert(matchesToInsert)
    
    if (error) {
      console.error('Erro ao inserir partidas:', error)
      throw error
    }
    
    console.log(`${insertedCount} partidas inseridas com sucesso! (${skippedCount} puladas)`)
  } catch (error) {
    console.error('Erro ao inserir partidas:', error)
    throw error
  }
}

async function runSeed() {
  console.log('Iniciando seed com dados reais da Copa do Mundo 2026...')
  
  try {
    // Step 1: Truncate tables
    await truncateTables()
    
    // Step 2: Fetch data from API
    const worldCupData = await fetchWorldCupData()
    
    // Step 3: Extract teams from matches
    const teams = extractTeams(worldCupData.matches)
    
    // Step 4: Insert teams
    await insertTeams(teams)
    
    // Step 5: Get team IDs
    const teamNames = Array.from(teams.keys())
    const teamIds = await getTeamIds(teamNames)
    
    // Step 6: Insert matches
    await insertMatches(worldCupData.matches, teamIds)
    
    console.log('Seed concluído com sucesso!')
    process.exit(0)
  } catch (error) {
    console.error('Erro durante o seed:', error)
    process.exit(1)
  }
}

runSeed()
