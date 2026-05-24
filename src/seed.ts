import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { TeamInsert, MatchInsert } from './types/database'

// Create a Supabase client with service role key for seed operations (bypasses RLS)
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment variables')
  console.error('Please add SUPABASE_SERVICE_ROLE_KEY to your .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Dados reais das 48 seleções qualificadas para a Copa do Mundo 2026
const teamsData: TeamInsert[] = [
  // Grupo A
  { name: 'México', flag_code: 'MEX', group_name: 'A' },
  { name: 'Canadá', flag_code: 'CAN', group_name: 'A' },
  { name: 'Marrocos', flag_code: 'MAR', group_name: 'A' },
  { name: 'Croácia', flag_code: 'CRO', group_name: 'A' },
  
  // Grupo B
  { name: 'Espanha', flag_code: 'ESP', group_name: 'B' },
  { name: 'Inglaterra', flag_code: 'ENG', group_name: 'B' },
  { name: 'Nigéria', flag_code: 'NGA', group_name: 'B' },
  { name: 'Costa do Marfim', flag_code: 'CIV', group_name: 'B' },
  
  // Grupo C
  { name: 'Argentina', flag_code: 'ARG', group_name: 'C' },
  { name: 'Alemanha', flag_code: 'GER', group_name: 'C' },
  { name: 'Japão', flag_code: 'JPN', group_name: 'C' },
  { name: 'Nova Zelândia', flag_code: 'NZL', group_name: 'C' },
  
  // Grupo D
  { name: 'França', flag_code: 'FRA', group_name: 'D' },
  { name: 'Brasil', flag_code: 'BRA', group_name: 'D' },
  { name: 'Uruguai', flag_code: 'URU', group_name: 'D' },
  { name: 'Gana', flag_code: 'GHA', group_name: 'D' },
  
  // Grupo E
  { name: 'Bélgica', flag_code: 'BEL', group_name: 'E' },
  { name: 'Portugal', flag_code: 'POR', group_name: 'E' },
  { name: 'Coreia do Sul', flag_code: 'KOR', group_name: 'E' },
  { name: 'Arábia Saudita', flag_code: 'KSA', group_name: 'E' },
  
  // Grupo F
  { name: 'Holanda', flag_code: 'NED', group_name: 'F' },
  { name: 'Itália', flag_code: 'ITA', group_name: 'F' },
  { name: 'Suíça', flag_code: 'SUI', group_name: 'F' },
  { name: 'Camarões', flag_code: 'CMR', group_name: 'F' },
  
  // Grupo G
  { name: 'Estados Unidos', flag_code: 'USA', group_name: 'G' },
  { name: 'Austrália', flag_code: 'AUS', group_name: 'G' },
  { name: 'Senegal', flag_code: 'SEN', group_name: 'G' },
  { name: 'Tunísia', flag_code: 'TUN', group_name: 'G' },
  
  // Grupo H
  { name: 'Dinamarca', flag_code: 'DEN', group_name: 'H' },
  { name: 'Áustria', flag_code: 'AUT', group_name: 'H' },
  { name: 'Polônia', flag_code: 'POL', group_name: 'H' },
  { name: 'Irã', flag_code: 'IRN', group_name: 'H' },
  
  // Grupo I
  { name: 'Colômbia', flag_code: 'COL', group_name: 'I' },
  { name: 'Equador', flag_code: 'ECU', group_name: 'I' },
  { name: 'Paraguai', flag_code: 'PAR', group_name: 'I' },
  { name: 'Venezuela', flag_code: 'VEN', group_name: 'I' },
  
  // Grupo J
  { name: 'China', flag_code: 'CHN', group_name: 'J' },
  { name: 'Indonésia', flag_code: 'IDN', group_name: 'J' },
  { name: 'Uzbequistão', flag_code: 'UZB', group_name: 'J' },
  { name: 'Iraque', flag_code: 'IRQ', group_name: 'J' },
  
  // Grupo K
  { name: 'Egito', flag_code: 'EGY', group_name: 'K' },
  { name: 'Argélia', flag_code: 'ALG', group_name: 'K' },
  { name: 'África do Sul', flag_code: 'RSA', group_name: 'K' },
  { name: 'Angola', flag_code: 'ANG', group_name: 'K' },
  
  // Grupo L
  { name: 'Panamá', flag_code: 'PAN', group_name: 'L' },
  { name: 'Costa Rica', flag_code: 'CRC', group_name: 'L' },
  { name: 'Jamaica', flag_code: 'JAM', group_name: 'L' },
  { name: 'Honduras', flag_code: 'HND', group_name: 'L' },
]

// Função para inserir as seleções
async function seedTeams() {
  console.log('Inserindo seleções...')
  
  const { data: existingTeams } = await supabase.from('teams').select('id')
  
  if (existingTeams && existingTeams.length > 0) {
    console.log('Seleções já existem no banco de dados. Pulando...')
    return
  }
  
  const { error } = await supabase.from('teams').insert(teamsData as any)
  
  if (error) {
    console.error('Erro ao inserir seleções:', error)
    throw error
  } else {
    console.log('Seleções inseridas com sucesso!')
  }
}

// Função para criar todas as partidas da fase de grupos (72 partidas no total)
async function seedMatches() {
  console.log('Inserindo partidas da fase de grupos...')
  
  // Buscar as seleções para obter seus IDs
  const { data: teams } = await supabase.from('teams').select('*') as any
  
  if (!teams || teams.length === 0) {
    console.error('Nenhuma seleção encontrada. Execute seedTeams primeiro.')
    return
  }
  
  // Criar um mapa de seleções por nome para fácil acesso
  const teamsMap = new Map<string, string>(teams.map((t: any) => [t.name, t.id]))
  
  // Data base para as partidas (11 de junho de 2026)
  const baseDate = new Date('2026-06-11T16:00:00Z')
  
  // Função auxiliar para criar partidas com datas sequenciais
  const createMatch = (home: string, away: string, offsetHours: number): MatchInsert => ({
    home_team_id: teamsMap.get(home)!,
    away_team_id: teamsMap.get(away)!,
    match_date: new Date(baseDate.getTime() + offsetHours * 60 * 60 * 1000).toISOString(),
    phase: 'group' as const,
    status: 'pending' as const,
  })
  
  // Todas as 72 partidas da fase de grupos (6 partidas por grupo × 12 grupos)
  const matchesData: MatchInsert[] = [
    // Grupo A (6 partidas)
    createMatch('México', 'Croácia', 0),
    createMatch('Marrocos', 'Canadá', 4),
    createMatch('México', 'Marrocos', 28),
    createMatch('Croácia', 'Canadá', 32),
    createMatch('México', 'Canadá', 52),
    createMatch('Croácia', 'Marrocos', 56),
    
    // Grupo B (6 partidas)
    createMatch('Espanha', 'Costa do Marfim', 8),
    createMatch('Inglaterra', 'Nigéria', 12),
    createMatch('Espanha', 'Nigéria', 36),
    createMatch('Inglaterra', 'Costa do Marfim', 40),
    createMatch('Espanha', 'Inglaterra', 60),
    createMatch('Costa do Marfim', 'Nigéria', 64),
    
    // Grupo C (6 partidas)
    createMatch('Argentina', 'Nova Zelândia', 16),
    createMatch('Alemanha', 'Japão', 20),
    createMatch('Argentina', 'Japão', 44),
    createMatch('Alemanha', 'Nova Zelândia', 48),
    createMatch('Argentina', 'Alemanha', 68),
    createMatch('Japão', 'Nova Zelândia', 72),
    
    // Grupo D (6 partidas)
    createMatch('França', 'Gana', 24),
    createMatch('Brasil', 'Uruguai', 28),
    createMatch('França', 'Uruguai', 52),
    createMatch('Brasil', 'Gana', 56),
    createMatch('França', 'Brasil', 76),
    createMatch('Gana', 'Uruguai', 80),
    
    // Grupo E (6 partidas)
    createMatch('Bélgica', 'Arábia Saudita', 32),
    createMatch('Portugal', 'Coreia do Sul', 36),
    createMatch('Bélgica', 'Coreia do Sul', 60),
    createMatch('Portugal', 'Arábia Saudita', 64),
    createMatch('Bélgica', 'Portugal', 84),
    createMatch('Arábia Saudita', 'Coreia do Sul', 88),
    
    // Grupo F (6 partidas)
    createMatch('Holanda', 'Camarões', 40),
    createMatch('Itália', 'Suíça', 44),
    createMatch('Holanda', 'Suíça', 68),
    createMatch('Itália', 'Camarões', 72),
    createMatch('Holanda', 'Itália', 92),
    createMatch('Suíça', 'Camarões', 96),
    
    // Grupo G (6 partidas)
    createMatch('Estados Unidos', 'Tunísia', 48),
    createMatch('Austrália', 'Senegal', 52),
    createMatch('Estados Unidos', 'Senegal', 76),
    createMatch('Austrália', 'Tunísia', 80),
    createMatch('Estados Unidos', 'Austrália', 100),
    createMatch('Tunísia', 'Senegal', 104),
    
    // Grupo H (6 partidas)
    createMatch('Dinamarca', 'Irã', 56),
    createMatch('Áustria', 'Polônia', 60),
    createMatch('Dinamarca', 'Polônia', 84),
    createMatch('Áustria', 'Irã', 88),
    createMatch('Dinamarca', 'Áustria', 108),
    createMatch('Irã', 'Polônia', 112),
    
    // Grupo I (6 partidas)
    createMatch('Colômbia', 'Venezuela', 64),
    createMatch('Equador', 'Paraguai', 68),
    createMatch('Colômbia', 'Paraguai', 92),
    createMatch('Equador', 'Venezuela', 96),
    createMatch('Colômbia', 'Equador', 116),
    createMatch('Venezuela', 'Paraguai', 120),
    
    // Grupo J (6 partidas)
    createMatch('China', 'Iraque', 72),
    createMatch('Indonésia', 'Uzbequistão', 76),
    createMatch('China', 'Uzbequistão', 100),
    createMatch('Indonésia', 'Iraque', 104),
    createMatch('China', 'Indonésia', 124),
    createMatch('Iraque', 'Uzbequistão', 128),
    
    // Grupo K (6 partidas)
    createMatch('Egito', 'Angola', 80),
    createMatch('Argélia', 'África do Sul', 84),
    createMatch('Egito', 'África do Sul', 108),
    createMatch('Argélia', 'Angola', 112),
    createMatch('Egito', 'Argélia', 132),
    createMatch('Angola', 'África do Sul', 136),
    
    // Grupo L (6 partidas)
    createMatch('Panamá', 'Honduras', 88),
    createMatch('Costa Rica', 'Jamaica', 92),
    createMatch('Panamá', 'Jamaica', 116),
    createMatch('Costa Rica', 'Honduras', 120),
    createMatch('Panamá', 'Costa Rica', 140),
    createMatch('Honduras', 'Jamaica', 144),
  ]
  
  // Verificar se já existem partidas
  const { data: existingMatches } = await supabase.from('matches').select('id')
  
  if (existingMatches && existingMatches.length > 0) {
    console.log('Partidas já existem no banco de dados. Pulando...')
    return
  }
  
  const { error } = await supabase.from('matches').insert(matchesData as any)
  
  if (error) {
    console.error('Erro ao inserir partidas:', error)
    throw error
  } else {
    console.log('Partidas inseridas com sucesso!')
  }
}

// Função principal para executar o seed
async function runSeed() {
  console.log('Iniciando seed do banco de dados...')
  
  try {
    await seedTeams()
    await seedMatches()
    console.log('Seed concluído com sucesso!')
    process.exit(0)
  } catch (error) {
    console.error('Erro durante o seed:', error)
    process.exit(1)
  }
}

// Executar o seed se este arquivo for executado diretamente
await runSeed()

export { runSeed, seedTeams, seedMatches }
