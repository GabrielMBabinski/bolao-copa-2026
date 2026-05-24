-- Habilitar extensão para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Habilitar Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Tabela de Seleções (Teams)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  flag_code TEXT NOT NULL, -- Código de 2 ou 3 letras para a bandeira (ex: BRA, ARG)
  group_name TEXT NOT NULL CHECK (group_name IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Perfis de Usuários (Profiles)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  total_points INTEGER DEFAULT 0,
  exact_scores INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Partidas (Matches)
CREATE TYPE match_phase AS ENUM ('group', 'round_32', 'round_16', 'quarter', 'semi', 'final');
CREATE TYPE match_status AS ENUM ('pending', 'in_progress', 'finished');

CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  home_team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  away_team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  match_date TIMESTAMP WITH TIME ZONE NOT NULL,
  phase match_phase NOT NULL DEFAULT 'group',
  home_score INTEGER,
  away_score INTEGER,
  status match_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT home_away_different CHECK (home_team_id != away_team_id),
  CONSTRAINT scores_only_when_finished CHECK (
    (status = 'finished' AND home_score IS NOT NULL AND away_score IS NOT NULL) OR
    (status != 'finished' AND (home_score IS NULL OR away_score IS NULL))
  )
);

-- Tabela de Palpites (Predictions)
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  home_score INTEGER NOT NULL CHECK (home_score >= 0),
  away_score INTEGER NOT NULL CHECK (away_score >= 0),
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_match UNIQUE (user_id, match_id)
);

-- Índices para performance
CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_phase ON matches(phase);
CREATE INDEX idx_predictions_user ON predictions(user_id);
CREATE INDEX idx_predictions_match ON predictions(match_id);
CREATE INDEX idx_profiles_points ON profiles(total_points DESC, exact_scores DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_predictions_updated_at BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular pontos de um palpite
CREATE OR REPLACE FUNCTION calculate_prediction_points(
  p_home_score INTEGER,
  p_away_score INTEGER,
  m_home_score INTEGER,
  m_away_score INTEGER
) RETURNS INTEGER AS $$
DECLARE
  points INTEGER := 0;
  predicted_winner TEXT;
  actual_winner TEXT;
  predicted_goal_diff INTEGER;
  actual_goal_diff INTEGER;
BEGIN
  -- Determinar vencedor do palpite
  IF p_home_score > p_away_score THEN
    predicted_winner := 'home';
  ELSIF p_away_score > p_home_score THEN
    predicted_winner := 'away';
  ELSE
    predicted_winner := 'draw';
  END IF;

  -- Determinar vencedor real
  IF m_home_score > m_away_score THEN
    actual_winner := 'home';
  ELSIF m_away_score > m_home_score THEN
    actual_winner := 'away';
  ELSE
    actual_winner := 'draw';
  END IF;

  -- Calcular saldo de gols
  predicted_goal_diff := p_home_score - p_away_score;
  actual_goal_diff := m_home_score - m_away_score;

  -- 5 pontos: Placar exato
  IF p_home_score = m_home_score AND p_away_score = m_away_score THEN
    points := 5;
  -- 3 pontos: Acertar vencedor e saldo de gols
  ELSIF predicted_winner = actual_winner AND predicted_goal_diff = actual_goal_diff THEN
    points := 3;
  -- 1 ponto: Acertar apenas o vencedor ou empate
  ELSIF predicted_winner = actual_winner THEN
    points := 1;
  END IF;

  RETURN points;
END;
$$ LANGUAGE plpgsql;

-- Stored Procedure para calcular pontos de todos os palpites de uma partida
-- e atualizar o total_points na tabela profiles
CREATE OR REPLACE FUNCTION calculate_match_points(match_uuid UUID)
RETURNS VOID AS $$
DECLARE
  prediction_record RECORD;
  points INTEGER;
  is_exact BOOLEAN;
BEGIN
  -- Para cada palpite da partida
  FOR prediction_record IN
    SELECT id, user_id, home_score, away_score
    FROM predictions
    WHERE match_id = match_uuid
  LOOP
    -- Calcular pontos
    SELECT calculate_prediction_points(
      prediction_record.home_score,
      prediction_record.away_score,
      m.home_score,
      m.away_score
    ) INTO points
    FROM matches m
    WHERE m.id = match_uuid;

    -- Verificar se é placar exato
    is_exact := (
      prediction_record.home_score = (SELECT home_score FROM matches WHERE id = match_uuid)
      AND prediction_record.away_score = (SELECT away_score FROM matches WHERE id = match_uuid)
    );

    -- Atualizar o palpite
    UPDATE predictions
    SET points_earned = points
    WHERE id = prediction_record.id;

    -- Atualizar o total_points do usuário
    IF is_exact THEN
      UPDATE profiles
      SET total_points = total_points + points,
          exact_scores = exact_scores + 1
      WHERE id = prediction_record.user_id;
    ELSE
      UPDATE profiles
      SET total_points = total_points + points
      WHERE id = prediction_record.user_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular pontos automaticamente quando uma partida é finalizada
CREATE OR REPLACE FUNCTION trigger_match_points_calculation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'finished' AND OLD.status != 'finished' THEN
    PERFORM calculate_match_points(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_points_on_match_finished
AFTER UPDATE OF status ON matches
FOR EACH ROW EXECUTE FUNCTION trigger_match_points_calculation();

-- Row Level Security (RLS) Policies

-- Profiles: Todos podem ler, apenas o próprio usuário pode atualizar
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles podem ser lidos por todos"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem inserir seu próprio perfil"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Teams: Todos podem ler, apenas admins podem escrever
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams podem ser lidos por todos"
  ON teams FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem inserir teams"
  ON teams FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Apenas admins podem atualizar teams"
  ON teams FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Matches: Todos podem ler, apenas admins podem escrever
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matches podem ser lidos por todos"
  ON matches FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem inserir matches"
  ON matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Apenas admins podem atualizar matches"
  ON matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Predictions: Todos podem ler, apenas o próprio usuário pode inserir/atualizar
-- E apenas antes do horário da partida
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Predictions podem ser lidos por todos"
  ON predictions FOR SELECT
  USING (true);

CREATE POLICY "Usuários podem inserir seus próprios palpites"
  ON predictions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND created_at < (SELECT match_date FROM matches WHERE id = match_id)
  );

CREATE POLICY "Usuários podem atualizar seus próprios palpites"
  ON predictions FOR UPDATE
  USING (
    auth.uid() = user_id
    AND updated_at < (SELECT match_date FROM matches WHERE id = match_id)
  );

-- Função para criar perfil automaticamente quando um usuário é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, is_admin, total_points, exact_scores)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'),
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false),
    0,
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função auxiliar para calcular classificação de grupos
CREATE OR REPLACE FUNCTION calculate_group_standings(group_letter TEXT)
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  flag_code TEXT,
  played INTEGER,
  won INTEGER,
  drawn INTEGER,
  lost INTEGER,
  goals_for INTEGER,
  goals_against INTEGER,
  goal_diff INTEGER,
  points INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH team_stats AS (
    SELECT
      t.id AS team_id,
      t.name AS team_name,
      t.flag_code,
      COALESCE(COUNT(m.id), 0) AS played,
      COALESCE(SUM(CASE 
        WHEN (m.home_team_id = t.id AND m.home_score > m.away_score) OR
             (m.away_team_id = t.id AND m.away_score > m.home_score)
        THEN 1 ELSE 0 END
      ), 0) AS won,
      COALESCE(SUM(CASE 
        WHEN m.home_score = m.away_score
        THEN 1 ELSE 0 END
      ), 0) AS drawn,
      COALESCE(SUM(CASE 
        WHEN (m.home_team_id = t.id AND m.home_score < m.away_score) OR
             (m.away_team_id = t.id AND m.away_score < m.home_score)
        THEN 1 ELSE 0 END
      ), 0) AS lost,
      COALESCE(SUM(CASE WHEN m.home_team_id = t.id THEN m.home_score ELSE m.away_score END), 0) AS goals_for,
      COALESCE(SUM(CASE WHEN m.home_team_id = t.id THEN m.away_score ELSE m.home_score END), 0) AS goals_against
    FROM teams t
    LEFT JOIN matches m ON (m.home_team_id = t.id OR m.away_team_id = t.id)
      AND m.status = 'finished'
      AND m.phase = 'group'
    WHERE t.group_name = group_letter
    GROUP BY t.id, t.name, t.flag_code
  )
  SELECT
    team_id,
    team_name,
    flag_code,
    played,
    won,
    drawn,
    lost,
    goals_for,
    goals_against,
    COALESCE(goals_for, 0) - COALESCE(goals_against, 0) AS goal_diff,
    (COALESCE(won, 0) * 3) + COALESCE(drawn, 0) AS points
  FROM team_stats
  ORDER BY points DESC, goal_diff DESC, goals_for DESC;
END;
$$ LANGUAGE plpgsql;
