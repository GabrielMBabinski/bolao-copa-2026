export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string
          name: string
          flag_code: string
          group_name: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          flag_code: string
          group_name: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          flag_code?: string
          group_name?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          name: string
          avatar_url: string | null
          is_admin: boolean
          payment_status: 'unpaid' | 'pending' | 'paid'
          contributes_to_prize: boolean // <-- NOVA COLUNA AQUI
          total_points: number
          exact_scores: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          avatar_url?: string | null
          is_admin?: boolean
          payment_status?: 'unpaid' | 'pending' | 'paid'
          contributes_to_prize?: boolean // <-- NOVA COLUNA AQUI
          total_points?: number
          exact_scores?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          avatar_url?: string | null
          is_admin?: boolean
          payment_status?: 'unpaid' | 'pending' | 'paid'
          contributes_to_prize?: boolean // <-- NOVA COLUNA AQUI
          total_points?: number
          exact_scores?: number
          created_at?: string
          updated_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          home_team_id: string
          away_team_id: string
          match_date: string
          phase: 'group' | 'round_32' | 'round_16' | 'quarter' | 'semi' | 'final'
          home_score: number | null
          away_score: number | null
          status: 'pending' | 'in_progress' | 'finished'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          home_team_id: string
          away_team_id: string
          match_date: string
          phase?: 'group' | 'round_32' | 'round_16' | 'quarter' | 'semi' | 'final'
          home_score?: number | null
          away_score?: number | null
          status?: 'pending' | 'in_progress' | 'finished'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          home_team_id?: string
          away_team_id?: string
          match_date?: string
          phase?: 'group' | 'round_32' | 'round_16' | 'quarter' | 'semi' | 'final'
          home_score?: number | null
          away_score?: number | null
          status?: 'pending' | 'in_progress' | 'finished'
          created_at?: string
          updated_at?: string
          penalty_winner: 'home' | 'away' | null
        }
      }
      predictions: {
        Row: {
          id: string
          user_id: string
          match_id: string
          home_score: number
          away_score: number
          points_earned: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          match_id: string
          home_score: number
          away_score: number
          points_earned?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          match_id?: string
          home_score?: number
          away_score?: number
          points_earned?: number
          created_at?: string
          updated_at?: string
          penalty_winner: 'home' | 'away' | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_match_points: {
        Args: {
          match_uuid: string
        }
        Returns: void
      }
      calculate_group_standings: {
        Args: {
          group_letter: string
        }
        Returns: {
          team_id: string
          team_name: string
          flag_code: string
          played: number
          won: number
          drawn: number
          lost: number
          goals_for: number
          goals_against: number
          goal_diff: number
          points: number
        }[]
      }
    }
    Enums: {
      match_phase: 'group' | 'round_32' | 'round_16' | 'quarter' | 'semi' | 'final'
      match_status: 'pending' | 'in_progress' | 'finished'
    }
  }
}

// Tipos auxiliares para uso na aplicação
export type Team = Database['public']['Tables']['teams']['Row']
export type TeamInsert = Database['public']['Tables']['teams']['Insert']
export type TeamUpdate = Database['public']['Tables']['teams']['Update']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Match = Database['public']['Tables']['matches']['Row']
export type MatchInsert = Database['public']['Tables']['matches']['Insert']
export type MatchUpdate = Database['public']['Tables']['matches']['Update']

export type Prediction = Database['public']['Tables']['predictions']['Row']
export type PredictionInsert = Database['public']['Tables']['predictions']['Insert']
export type PredictionUpdate = Database['public']['Tables']['predictions']['Update']

export type MatchPhase = Database['public']['Enums']['match_phase']
export type MatchStatus = Database['public']['Enums']['match_status']

export type GroupName = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'

// Tipo para standings de grupo
export type GroupStanding = {
  team_id: string
  team_name: string
  flag_code: string
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_diff: number
  points: number
}

// Tipo para match com informações das equipes
export type MatchWithTeams = Match & {
  home_team: Team
  away_team: Team
}

// Tipo para prediction com informações do match
export type PredictionWithMatch = Prediction & {
  match: MatchWithTeams
}

// Tipo para ranking de usuários
export type UserRanking = Profile & {
  rank: number
}