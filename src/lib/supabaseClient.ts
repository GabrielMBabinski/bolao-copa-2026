import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Substitua estas variáveis pelas suas credenciais do Supabase
// Você pode criar um arquivo .env.local na raiz do projeto com:
// VITE_SUPABASE_URL=sua_url_aqui
// VITE_SUPABASE_ANON_KEY=sua_chave_aqui

// Suporte para ambos ambientes: Vite (import.meta.env) e Node.js (process.env)
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Credenciais do Supabase não encontradas. Por favor, configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Funções helper para autenticação
export const auth = {
  signUp: async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    })
    return { data, error }
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  },

  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback)
  },
}

// Funções helper para profiles
export const profiles = {
  getProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return { data, error }
  },

  updateProfile: async (userId: string, updates: Partial<Database['public']['Tables']['profiles']['Update']>) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    return { data, error }
  },
}

// Funções helper para teams
export const teams = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('group_name', { ascending: true })
    return { data, error }
  },

  getByGroup: async (groupName: string) => {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('group_name', groupName)
    return { data, error }
  },
}

// Funções helper para matches
export const matches = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*)
      `)
      .order('match_date', { ascending: true })
    return { data, error }
  },

  getUpcoming: async (days: number = 3) => {
    const now = new Date()
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*)
      `)
      .gte('match_date', now.toISOString())
      .lte('match_date', futureDate.toISOString())
      .order('match_date', { ascending: true })
    return { data, error }
  },

  getFinished: async (limit: number = 5) => {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*)
      `)
      .eq('status', 'finished')
      .order('match_date', { ascending: false })
      .limit(limit)
    return { data, error }
  },

  getByPhase: async (phase: Database['public']['Enums']['match_phase']) => {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*)
      `)
      .eq('phase', phase)
      .order('match_date', { ascending: true })
    return { data, error }
  },

  updateMatch: async (matchId: string, updates: Database['public']['Tables']['matches']['Update']) => {
    const { data, error } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', matchId)
      .select()
      .single()
    return { data, error }
  },
}

// Funções helper para predictions
export const predictions = {
  getUserPredictions: async (userId: string) => {
    const { data, error } = await supabase
      .from('predictions')
      .select(`
        *,
        match:matches(
          *,
          home_team:teams!matches_home_team_id_fkey(*),
          away_team:teams!matches_away_team_id_fkey(*)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  getMatchPredictions: async (matchId: string) => {
    const { data, error } = await supabase
      .from('predictions')
      .select(`
        *,
        profile:profiles(*)
      `)
      .eq('match_id', matchId)
    return { data, error }
  },

  upsertPrediction: async (prediction: Database['public']['Tables']['predictions']['Insert']) => {
    const { data, error } = await supabase
      .from('predictions')
      .upsert(prediction)
      .select()
      .single()
    return { data, error }
  },

  canPredict: async (matchId: string) => {
    const { data: match } = await supabase
      .from('matches')
      .select('match_date')
      .eq('id', matchId)
      .single()
    
    if (!match) return false
    
    const now = new Date()
    const matchDate = new Date(match.match_date)
    return now < matchDate
  },
}

// Funções helper para ranking
export const ranking = {
  getLeaderboard: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('total_points', { ascending: false })
      .order('exact_scores', { ascending: false })
    return { data, error }
  },
}

// Funções helper para grupos
export const groups = {
  getStandings: async (groupName: string) => {
    const { data, error } = await supabase.rpc('calculate_group_standings', {
      group_letter: groupName,
    })
    return { data, error }
  },

  getAllStandings: async () => {
    const groupsList: Array<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'> = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
    const standings = await Promise.all(
      groupsList.map(async (group) => {
        const { data } = await groups.getStandings(group)
        return { group, data: data || [] }
      })
    )
    return standings
  },
}
