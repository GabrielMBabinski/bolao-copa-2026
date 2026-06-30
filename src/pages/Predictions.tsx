import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useAuth } from '@/hooks/useAuth'
import { matches, predictions, supabase } from '@/lib/supabaseClient'
import type { MatchWithTeams, PredictionWithMatch } from '@/types/database'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Target, Clock, Lock, Check, Users, X, GitMerge } from 'lucide-react'
import TeamFlag from '@/components/TeamFlag'

// --- FUNÇÕES AUXILIARES (BLINDADAS CONTRA NULL) ---
const normalizeDate = (dateString: string | null) => {
  // Se o jogo não tiver data definida na API, jogamos para o futuro para não quebrar a tela
  if (!dateString) return new Date('2099-12-31T00:00:00Z')

  const formattedString = dateString.replace(' ', 'T')
  const hasTimezone = formattedString.includes('Z') || formattedString.match(/[+-]\d{2}:\d{2}$/)
  const safeDateStr = hasTimezone ? formattedString : `${formattedString}-04:00`
  return new Date(safeDateStr)
}

const formatDate = (dateString: string | null) => {
  // Se não tiver data, exibe um texto amigável
  if (!dateString) return 'A definir'

  return normalizeDate(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const getPhaseLabel = (phase: string) => {
  const labels: Record<string, string> = {
    group: 'Fase de Grupos', round_32: 'Dezesseis-avos', round_16: 'Oitavas',
    quarter: 'Quartas', semi: 'Semifinal', final: 'Final', third_place: '3º Lugar'
  }
  return labels[phase] || phase
}

// --- COMPONENTE DE LISTA DE AMIGOS ---
// --- COMPONENTE DE LISTA DE AMIGOS ---
// --- COMPONENTE DE LISTA DE AMIGOS ---
const FriendsPredictionsList = ({
  matchId,
  matchDate,
  timeOffset,
  isFinished,
  actualHomeScore,
  actualAwayScore,
  actualPenaltyWinner,
  homeTeamName, // Adicione isto
  awayTeamName  // Adicione isto
}: {
  matchId: string,
  matchDate: string,
  timeOffset: number,
  isFinished: boolean,
  actualHomeScore?: number | null,
  actualAwayScore?: number | null,
  actualPenaltyWinner?: string | null,
  homeTeamName?: string, // Adicione isto
  awayTeamName?: string  // Adicione isto
}) => {
  const [show, setShow] = useState(false)
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const realTime = new Date(new Date().getTime() + timeOffset)
      if (normalizeDate(matchDate) > realTime) {
        alert("🚨 PEGO NO PULO! O sistema detectou uma inconsistência no relógio.\n\nOs palpites da galera só serão liberados quando a bola rolar de verdade!")
        setShow(false)
        return
      }

      const { data, error } = await supabase
        .from('predictions')
        .select('home_score, away_score, penalty_winner, points_earned, profiles(name)')
        .eq('match_id', matchId)

      if (error) throw error
      setList(data || [])
    } catch (e) {
      console.error(e)
      alert("Erro ao carregar palpites.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full mt-2">
      <Button variant="outline" size="sm" className="w-full text-xs bg-muted/50 hover:bg-muted" onClick={() => {
        if (!show) load()
        setShow(!show)
      }}>
        <Users className="h-4 w-4 mr-2" />
        {show ? 'Ocultar palpites da galera' : 'Ver palpites da galera'}
      </Button>

      {show && (
        <div className="mt-3 bg-muted rounded-lg border border-border/50 overflow-hidden">

          {/* --- NOVO: PLACAR OFICIAL DO JOGO --- */}
          {isFinished && actualHomeScore !== null && actualHomeScore !== undefined && (
            <div className="bg-slate-900/40 p-3 text-center border-b border-border/50 flex flex-col items-center justify-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Resultado Oficial</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm font-bold bg-slate-950 px-3 py-1 shadow-inner">
                  {actualHomeScore} x {actualAwayScore}
                </Badge>
                {/* Exibe o badge de pênaltis se o jogo terminou empatado e teve vencedor */}
                {actualPenaltyWinner && (
                  <Badge className="bg-yellow-600 hover:bg-yellow-700 text-white text-[10px] uppercase font-bold border-none">
                    {actualPenaltyWinner === 'home'
                      ? `${homeTeamName || 'Mandante'} venceu nos pênaltis`
                      : `${awayTeamName || 'Visitante'} venceu nos pênaltis`
                    }
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* --- LISTA DE PALPITES COM A BARRA CUSTOMIZADA --- */}
          <div className="p-3 space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
            {loading ? <div className="text-sm text-center animate-pulse py-4">Carregando palpites...</div> :
              list.length === 0 ? <div className="text-sm text-center py-4">Ninguém mais palpitou.</div> :
                list.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-background p-2 rounded border border-border/50 shadow-sm">
                    <span className="truncate font-medium pr-2">{p.profiles?.name || 'Anônimo'}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="font-bold text-primary flex items-center">
                        {/* Se o palpite foi empate e ele escolheu o mandante ('home'), estrela na esquerda */}
                        {p.home_score === p.away_score && p.penalty_winner === 'home' && (
                          <span className="text-yellow-500 mr-1" title={`${homeTeamName || 'Mandante'} vence nos pênaltis`}>★</span>
                        )}

                        {p.home_score} x {p.away_score}

                        {/* Se o palpite foi empate e ele escolheu o visitante ('away'), estrela na direita */}
                        {p.home_score === p.away_score && p.penalty_winner === 'away' && (
                          <span className="text-yellow-500 ml-1" title={`${awayTeamName || 'Visitante'} vence nos pênaltis`}>★</span>
                        )}
                      </Badge>
                      {isFinished && p.points_earned !== null && p.points_earned !== undefined && (
                        <Badge className={`${p.points_earned > 0 ? "bg-green-600 text-white" : "bg-slate-600 text-white"} ml-1 min-w-[50px] justify-center border-none`}>
                          {p.points_earned} pts
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
          </div>
        </div>
      )}
    </div>
  )
}

// --- COMPONENTE DE FORMULÁRIO ---
const PredictionForm = ({ match, onSave, initialHome = '', initialAway = '', initialPenaltyWinner = null, predictionId, timeOffset, onSavedCallback }: { match: MatchWithTeams, onSave: (id: string, home: number, away: number, penaltyWinner: 'home' | 'away' | null, predId?: string) => Promise<void>, initialHome?: number | '', initialAway?: number | '', initialPenaltyWinner?: 'home' | 'away' | null, predictionId?: string, timeOffset: number, onSavedCallback?: () => void }) => {
  const [homeScore, setHomeScore] = useState<number | ''>(initialHome)
  const [awayScore, setAwayScore] = useState<number | ''>(initialAway)
  const [penaltyWinner, setPenaltyWinner] = useState<'home' | 'away' | null>(initialPenaltyWinner)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const isKnockout = match.phase !== 'group'
  const isTie = homeScore !== '' && awayScore !== '' && Number(homeScore) === Number(awayScore)

  // Reset do penaltyWinner se o usuário mudar o placar e não for mais empate
  useEffect(() => {
    if (!isTie) setPenaltyWinner(null)
  }, [homeScore, awayScore, isTie])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (homeScore === '' || awayScore === '') return;
    if (isKnockout && isTie && !penaltyWinner) {
      alert("Jogo de mata-mata empatado! Por favor, selecione abaixo quem se classifica nos pênaltis.");
      return;
    }
    const now = new Date();
    const matchDate = new Date(match.match_date);
    if (now >= matchDate || match.status !== 'pending') {
      alert("O jogo já começou ou foi encerrado!");
      return;
    }
    setSaving(true);
    try {
      await onSave(match.id, Number(homeScore), Number(awayScore), isTie ? penaltyWinner : null, predictionId);
      setJustSaved(true);
      if (onSavedCallback) {
        setTimeout(() => { setJustSaved(false); onSavedCallback() }, 1000)
      } else {
        setTimeout(() => setJustSaved(false), 2000)
      }
    } catch (err) { console.error("Falha ao salvar:", err); } finally { setSaving(false); }
  }

  const realCurrentTime = new Date(new Date().getTime() + timeOffset)
  const isLocked = normalizeDate(match.match_date) <= realCurrentTime || match.status !== 'pending'
  const isFinished = match.status === 'finished'

  return (
    <div className={`p-4 border rounded-xl flex flex-col gap-6 ${isLocked ? 'opacity-80 bg-muted/10' : 'bg-card shadow-sm'}`}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b pb-3">
        <Badge variant={isLocked ? "secondary" : "outline"}>{getPhaseLabel(match.phase)}</Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> {formatDate(match.match_date)}
        </span>
      </div>

      {/* Times e Placar */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-center gap-6 w-full">
          <div className="flex flex-col items-center gap-2 flex-1">
            {match.home_team?.flag_code ? <TeamFlag flagCode={match.home_team.flag_code} /> : <div className="w-8 h-6 bg-muted rounded"></div>}
            <span className="font-bold text-sm text-center truncate w-full">{match.home_team?.name || 'A Definir'}</span>
          </div>
          <span className="text-xl font-black text-muted-foreground">X</span>
          <div className="flex flex-col items-center gap-2 flex-1">
            {match.away_team?.flag_code ? <TeamFlag flagCode={match.away_team.flag_code} /> : <div className="w-8 h-6 bg-muted rounded"></div>}
            <span className="font-bold text-sm text-center truncate w-full">{match.away_team?.name || 'A Definir'}</span>
          </div>
        </div>

        {/* Formulário Ajustado */}
        {!isLocked && match.home_team && match.away_team ? (
          <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
            <div className="flex items-center justify-center gap-3">
              <Input type="number" min="0" max="20" required value={homeScore} onChange={(e) => setHomeScore(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-20 h-14 text-center font-black text-2xl" placeholder="0" />
              <span className="text-xl font-black text-muted-foreground">-</span>
              <Input type="number" min="0" max="20" required value={awayScore} onChange={(e) => setAwayScore(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-20 h-14 text-center font-black text-2xl" placeholder="0" />
            </div>

            {/* Penalties abaixo do placar */}
            {isKnockout && isTie && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg text-center space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-[11px] font-bold text-yellow-600 uppercase">Classificado nos pênaltis:</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={penaltyWinner === 'home' ? 'default' : 'outline'} size="sm" onClick={() => setPenaltyWinner('home')} className="text-xs h-8">
                    {match.home_team?.name}
                  </Button>
                  <Button type="button" variant={penaltyWinner === 'away' ? 'default' : 'outline'} size="sm" onClick={() => setPenaltyWinner('away')} className="text-xs h-8">
                    {match.away_team?.name}
                  </Button>
                </div>
              </div>
            )}

            {/* Botão de salvar no final */}
            <Button type="submit" disabled={saving || justSaved} className={`w-full h-12 text-base font-bold ${justSaved ? 'bg-green-600 hover:bg-green-700' : ''}`}>
              {saving ? 'Salvando...' : justSaved ? 'Salvo! ✅' : predictionId ? 'Atualizar Palpite' : 'Confirmar Palpite'}
            </Button>
          </form>
        ) : !isLocked && (!match.home_team || !match.away_team) ? (
          <Badge variant="outline">Aguardando Seleções</Badge>
        ) : null}
      </div>

      {isLocked && (
        <FriendsPredictionsList
          matchId={match.id}
          matchDate={match.match_date}
          timeOffset={timeOffset}
          isFinished={isFinished}
          actualHomeScore={match.home_score}
          actualAwayScore={match.away_score}
          actualPenaltyWinner={match.penalty_winner}
          homeTeamName={match.home_team?.name} // Passe o nome aqui
          awayTeamName={match.away_team?.name} // Passe o nome aqui
        />
      )}
    </div>
  )
}

// 1. AS FUNÇÕES DE INTELIGÊNCIA FICAM FORA DO COMPONENTE
const getAdvancingTeam = (match: any) => {
  if (!match || match.status !== 'finished') return null;

  if (match.home_score > match.away_score) return match.home_team;
  if (match.away_score > match.home_score) return match.away_team;

  if (match.penalty_winner === 'home') return match.home_team;
  if (match.penalty_winner === 'away') return match.away_team;

  return null;
};

const deriveNextPhase = (previousPhaseMatches: any[]) => {
  const nextPhase = [];
  for (let i = 0; i < previousPhaseMatches.length; i += 2) {
    const matchA = previousPhaseMatches[i];
    const matchB = previousPhaseMatches[i + 1];

    nextPhase.push({
      id: `derived-${Math.random().toString(36).substring(7)}`, // Gera um ID único provisório
      home_team: matchA ? getAdvancingTeam(matchA) : null,
      away_team: matchB ? getAdvancingTeam(matchB) : null,
      status: 'pending',
      match_date: null // Como é previsto, não tem data oficial ainda
    });
  }
  return nextPhase;
};

// --- COMPONENTE: ÁRVORE DO MATA-MATA (ESTILO FIFA) ---
// --- COMPONENTE: ÁRVORE DO MATA-MATA (ESTILO FIFA) ---
const KnockoutBracket = ({ allMatches, userPredictions, onSave, timeOffset }: { allMatches: MatchWithTeams[], userPredictions: PredictionWithMatch[], onSave: any, timeOffset: number }) => {
  const [selectedMatch, setSelectedMatch] = useState<{ match: MatchWithTeams, pred: any } | null>(null)
  
  // 👇 NOVO ESTADO: Guarda qual fase está com o "Zoom"
  const [focusedPhase, setFocusedPhase] = useState<string | null>(null)

  // 1. O ROTEADOR DE CHAVES
  const LEFT_BRACKET_TEAMS = [
    'alemanha', 'paraguai', 'franca', 'suecia',
    'africa do sul', 'canada', 'holanda', 'marrocos',
    'espanha', 'estados unidos', 'bosnia e herzegovina', 'belgica'
  ]

  const normalizeName = (name?: string) => {
    if (!name) return ""
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  }

  const getBracketSide = (match: MatchWithTeams) => {
    if (match.phase === 'final' || match.phase === 'third_place') return 'center';
    if (!match.match_date) return 'right';

    const dateStr = formatDate(match.match_date);
    const leftBracketSchedule = [
      "28/06/2026", "29/06/2026|16:30", "29/06/2026|21:00", "30/06/2026|17:00",
      "01/07/2026|16:00", "01/07/2026|20:00", "02/07/2026|15:00", "02/07/2026|19:00",
      "04/07/2026|13:00", "04/07/2026|17:00", "06/07/2026|15:00", "06/07/2026|20:00",
      "09/07/2026|16:00", "10/07/2026|15:00", "14/07/2026|15:00"
    ];

    for (const schedule of leftBracketSchedule) {
      const [day, time] = schedule.split("|");
      if (time) {
        if (dateStr.includes(day) && dateStr.includes(time)) return 'left';
      } else {
        if (dateStr.includes(day)) return 'left';
      }
    }
    return 'right';
  }

  const getPhaseMatches = (phase: string) => {
    const matches = allMatches.filter(m => m.phase === phase);
    const uniqueMatches = new Map();
    matches.forEach(m => {
      const key = [m.home_team_id, m.away_team_id].sort().join('-');
      if (!uniqueMatches.has(key)) uniqueMatches.set(key, m);
    });
    const uniqueArray = Array.from(uniqueMatches.values());
    return uniqueArray.sort((a, b) => a.api_id - b.api_id);
  };

  const splitMatches = (matches: MatchWithTeams[]) => {
    return {
      left: matches.filter(m => getBracketSide(m) === 'left'),
      right: matches.filter(m => getBracketSide(m) === 'right')
    }
  }

  const mergePhase = (derivedMatches: any[], apiMatches: any[]) => {
    if (!apiMatches || apiMatches.length === 0) return derivedMatches;

    const usedApiIds = new Set();

    return derivedMatches.map(derived => {
      // Procura o jogo oficial na API cruzando pelo menos 1 dos times (home ou away)
      const official = apiMatches.find(m => {
        if (usedApiIds.has(m.id)) return false;
        const hasHome = derived.home_team && (m.home_team_id === derived.home_team.id || m.away_team_id === derived.home_team.id);
        const hasAway = derived.away_team && (m.home_team_id === derived.away_team.id || m.away_team_id === derived.away_team.id);
        return hasHome || hasAway;
      });

      if (official) {
        usedApiIds.add(official.id);
        return official;
      }
      return derived;
    });
  };

  // 👇 2. A ÁRVORE INTELIGENTE ATUALIZADA 👇

  // 16-AVOS (Base oficial da API)
  const r32 = splitMatches(getPhaseMatches('round_32'))

  // OITAVAS
  const apiR16 = splitMatches(getPhaseMatches('round_16'))
  const r16 = {
    left: mergePhase(deriveNextPhase(r32.left), apiR16.left),
    right: mergePhase(deriveNextPhase(r32.right), apiR16.right)
  }

  // QUARTAS
  const apiQf = splitMatches(getPhaseMatches('quarter'))
  const qf = {
    left: mergePhase(deriveNextPhase(r16.left), apiQf.left),
    right: mergePhase(deriveNextPhase(r16.right), apiQf.right)
  }

  // SEMIFINAIS
  const apiSf = splitMatches(getPhaseMatches('semi'))
  const sf = {
    left: mergePhase(deriveNextPhase(qf.left), apiSf.left),
    right: mergePhase(deriveNextPhase(qf.right), apiSf.right)
  }

  // Finais...
  const finalMatch = getPhaseMatches('final')[0]
  const thirdPlaceMatch = getPhaseMatches('third_place')[0]

  // LÓGICA DE VISIBILIDADE
  const hasKnownTeam = (matches: any[]) => matches.some(m => m.home_team || m.away_team)

  const showR16 = hasKnownTeam(r16.left) || hasKnownTeam(r16.right)
  const showQF = hasKnownTeam(qf.left) || hasKnownTeam(qf.right)
  const showSF = hasKnownTeam(sf.left) || hasKnownTeam(sf.right)

  //Verifica se TODOS os jogos da fase já vieram da API (ID não começa com 'derived-')
  const isPhaseConfirmed = (left: MatchWithTeams[], right: MatchWithTeams[]) => {
    const all = [...left, ...right];
    if (all.length === 0) return false;
    return all.every(m => m.id && !m.id.toString().startsWith('derived-') && m.home_team && m.away_team);
  }

  const r32Confirmed = isPhaseConfirmed(r32.left, r32.right);
  const r16Confirmed = isPhaseConfirmed(r16.left, r16.right);
  const qfConfirmed = isPhaseConfirmed(qf.left, qf.right);
  const sfConfirmed = isPhaseConfirmed(sf.left, sf.right);

  const phaseLevels: Record<string, number> = { round_32: 0, round_16: 1, quarter: 2, semi: 3, final: 4 };

  const isPhaseVisible = (phase: string) => {
    // Se não tem filtro, mostra tudo
    if (!focusedPhase) return true;
    // Regra especial pros 16-avos: se clicar nele, mostra só ele (como você pediu)
    if (focusedPhase === 'round_32') return phase === 'round_32';
    // Para as outras fases: mostra a fase clicada e todas as que vêm DEPOIS dela
    return phaseLevels[phase] >= phaseLevels[focusedPhase];
  };

  const BracketNode = ({ match }: { match: MatchWithTeams }) => {
    const pred: any = userPredictions.find(p => p.match_id === match.id)
    const realCurrentTime = new Date(new Date().getTime() + timeOffset)
    const isLocked = match.match_date ? (normalizeDate(match.match_date) <= realCurrentTime || match.status !== 'pending') : false

    const homeTeamName = match.home_team?.name || 'A Def.'
    const awayTeamName = match.away_team?.name || 'A Def.'
    
    const isReady = match.home_team && match.away_team
    const isOfficial = match.id && !match.id.toString().startsWith('derived-')
    const canClick = isReady && isOfficial

    // 👇 NOVA LÓGICA: Decide se vai mostrar o placar Real ou o Palpite
    const isRealScore = match.home_score !== null && match.home_score !== undefined;
    
    const displayHomeScore = isRealScore ? match.home_score : (pred?.home_score ?? '-');
    const displayAwayScore = isRealScore ? match.away_score : (pred?.away_score ?? '-');
    
    // A estrela também acompanha: mostra a real se o jogo acabou, ou a do palpite se ainda não
    const isHomePenalty = isRealScore ? match.penalty_winner === 'home' : (pred?.home_score === pred?.away_score && pred?.penalty_winner === 'home');
    const isAwayPenalty = isRealScore ? match.penalty_winner === 'away' : (pred?.home_score === pred?.away_score && pred?.penalty_winner === 'away');

    return (
      <div
        onClick={() => { if (canClick) setSelectedMatch({ match, pred }) }}
        className={`relative flex flex-col p-2 w-48 border rounded-lg shadow-sm transition-all
            ${!isOfficial || !isReady 
              ? 'bg-muted/10 opacity-50 cursor-default' 
              : isLocked 
                ? 'bg-muted/30 border-border/50 cursor-pointer hover:border-primary/50' 
                : 'bg-card cursor-pointer hover:border-primary hover:shadow-md hover:scale-105'
            }
          `}
      >
        <div className="text-[10px] text-muted-foreground mb-1 text-center border-b pb-1">
          {match.match_date ? formatDate(match.match_date).replace(',', ' -') : 'Aguardando Oficialização'}
        </div>

        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 overflow-hidden">
            {match.home_team?.flag_code ? <TeamFlag flagCode={match.home_team.flag_code} /> : <div className="w-5 h-4 bg-muted rounded"></div>}
            <span className="text-xs font-medium truncate">
              {homeTeamName}
              {isHomePenalty && <span className="text-yellow-500 ml-1 font-black" title="Vence nos Pênaltis">★</span>}
            </span>
          </div>
          {/* O background muda de cor se for o resultado oficial ou apenas o palpite */}
          <span className={`text-xs font-bold w-6 text-center rounded ${isRealScore ? 'bg-slate-700 text-white' : (pred ? 'bg-primary/20 text-primary' : 'bg-muted')}`}>
            {displayHomeScore}
          </span>
        </div>

        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 overflow-hidden">
            {match.away_team?.flag_code ? <TeamFlag flagCode={match.away_team.flag_code} /> : <div className="w-5 h-4 bg-muted rounded"></div>}
            <span className="text-xs font-medium truncate">
              {awayTeamName}
              {isAwayPenalty && <span className="text-yellow-500 ml-1 font-black" title="Vence nos Pênaltis">★</span>}
            </span>
          </div>
          <span className={`text-xs font-bold w-6 text-center rounded ${isRealScore ? 'bg-slate-700 text-white' : (pred ? 'bg-primary/20 text-primary' : 'bg-muted')}`}>
            {displayAwayScore}
          </span>
        </div>

        {match.status === 'finished' && pred && (
          <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${pred.points_earned > 0 ? 'bg-green-500' : 'bg-gray-400'}`}>
            {pred.points_earned}
          </div>
        )}
      </div>
    )
  }

  const BracketColumn = ({ phase, matches, isConfirmed }: { phase: string, matches: MatchWithTeams[], isConfirmed: boolean }) => {
    if (!matches || matches.length === 0) return null
    
    // Verifica se esta é a coluna que está em zoom no momento
    const isFocused = focusedPhase === phase;

    return (
      <div className="flex flex-col min-w-[12rem] py-4 transition-all duration-500 animate-in fade-in">
        <button
          onClick={() => isConfirmed && setFocusedPhase(isFocused ? null : phase)}
          disabled={!isConfirmed}
          className={`font-bold text-center text-[11px] uppercase tracking-wider mb-4 shrink-0 flex items-center justify-center gap-1 mx-auto w-full max-w-[160px] transition-all duration-300
            ${isConfirmed 
              ? 'text-primary cursor-pointer hover:bg-primary/10 py-1.5 rounded-md border border-transparent hover:border-primary/20' 
              : 'text-muted-foreground opacity-50 cursor-not-allowed py-1.5'
            }
            ${isFocused ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground hover:scale-105 rounded-md py-1.5 shadow-md' : ''}
          `}
          title={isConfirmed ? (isFocused ? "Remover zoom" : "Ver apenas esta fase") : "Aguardando todos os jogos serem definidos"}
        >
          {getPhaseLabel(phase)}
          {isFocused && <X className="h-3 w-3 ml-1" />}
        </button>

        <div className="flex flex-col flex-1">
          {matches.map(match => (
            <div key={match.id} className="flex-1 flex flex-col justify-center">
              <BracketNode match={match} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // RETORNO PRINCIPAL DA ÁRVORE
  return (
    <div className="w-full relative">
      {/* Botão flutuante de Voltar caso ele se perca no Zoom */}
      {focusedPhase && (
        <div className="absolute -top-12 right-0 z-10 animate-in fade-in">
           <Button variant="outline" size="sm" onClick={() => setFocusedPhase(null)} className="shadow-md bg-background">
             <X className="h-4 w-4 mr-2" /> Limpar Filtro
           </Button>
        </div>
      )}

      <div className="bg-muted/10 border border-dashed rounded-xl overflow-x-auto custom-scrollbar">
        <div className={`flex items-stretch min-w-max gap-8 px-8 pb-8 pt-4 transition-all duration-500 ${focusedPhase ? 'justify-center' : 'justify-between'}`}>

          {/* ESQUERDA */}
          <div className="flex gap-6 items-stretch">
            {isPhaseVisible('round_32') && <BracketColumn phase="round_32" matches={r32.left} isConfirmed={r32Confirmed} />}
            {showR16 && isPhaseVisible('round_16') && <BracketColumn phase="round_16" matches={r16.left} isConfirmed={r16Confirmed} />}
            {showQF && isPhaseVisible('quarter') && <BracketColumn phase="quarter" matches={qf.left} isConfirmed={qfConfirmed} />}
            {showSF && isPhaseVisible('semi') && <BracketColumn phase="semi" matches={sf.left} isConfirmed={sfConfirmed} />}
          </div>

          {/* CENTRO (O Troféu) */}
          {isPhaseVisible('final') && (
            <div className="flex flex-col justify-center items-center gap-16 min-w-[260px] px-4 border-x border-border/50 animate-in fade-in duration-500">
              {finalMatch?.home_team || finalMatch?.away_team ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="font-black text-yellow-600 text-xs uppercase tracking-widest bg-yellow-500/10 border border-yellow-500/30 px-4 py-1.5 rounded-full shadow-sm">
                    🏆 Grande Final
                  </span>
                  <BracketNode match={finalMatch} />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 opacity-30">
                  <span className="font-bold text-muted-foreground text-xs uppercase">Aguardando Finalistas</span>
                  <div className="w-48 h-20 border-2 border-dashed border-border rounded-lg"></div>
                </div>
              )}

              {(thirdPlaceMatch?.home_team || thirdPlaceMatch?.away_team) && (
                <div className="flex flex-col items-center gap-3 mt-8">
                  <span className="font-bold text-muted-foreground text-[10px] uppercase tracking-widest">
                    🥉 Disputa do 3º Lugar
                  </span>
                  <BracketNode match={thirdPlaceMatch} />
                </div>
              )}
            </div>
          )}

          {/* DIREITA */}
          <div className="flex flex-row-reverse gap-6 items-stretch">
            {isPhaseVisible('round_32') && <BracketColumn phase="round_32" matches={r32.right} isConfirmed={r32Confirmed} />}
            {showR16 && isPhaseVisible('round_16') && <BracketColumn phase="round_16" matches={r16.right} isConfirmed={r16Confirmed} />}
            {showQF && isPhaseVisible('quarter') && <BracketColumn phase="quarter" matches={qf.right} isConfirmed={qfConfirmed} />}
            {showSF && isPhaseVisible('semi') && <BracketColumn phase="semi" matches={sf.right} isConfirmed={sfConfirmed} />}
          </div>

        </div>
      </div>

      {/* Modal de Palpite */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-background rounded-xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b bg-muted/30">
              <h3 className="font-bold text-lg">Palpite do Mata-Mata</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedMatch(null)} className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4">
              <PredictionForm
                match={selectedMatch.match}
                initialHome={selectedMatch.pred?.home_score}
                initialAway={selectedMatch.pred?.away_score}
                initialPenaltyWinner={selectedMatch.pred?.penalty_winner}
                predictionId={selectedMatch.pred?.id}
                onSave={onSave}
                timeOffset={timeOffset}
                onSavedCallback={() => setSelectedMatch(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// --- FUNÇÃO QUE BUSCA TUDO DE UMA VEZ ---
const fetchPredictionsData = async (userId: string) => {
  if (!userId) return { preds: [], all: [] }
  const [predsRes, matchesRes] = await Promise.all([
    predictions.getUserPredictions(userId),
    matches.getAll()
  ])
  return {
    preds: predsRes.data || [],
    all: matchesRes.data || []
  }
}

// --- COMPONENTE PRINCIPAL ---
export default function Predictions() {
  const { user } = useAuth()
  const [timeOffset, setTimeOffset] = useState(0)
  const [activeTab, setActiveTab] = useState<string>('available')

  useEffect(() => {
    async function syncInternetTime() {
      try {
        const res = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC')
        if (!res.ok) throw new Error('API falhou')
        const data = await res.json()
        const internetTime = new Date(data.datetime).getTime()
        const localTime = new Date().getTime()
        setTimeOffset(internetTime - localTime)
      } catch (error) {
        console.log('API de tempo falhou, usando relógio local como fallback')
      }
    }
    syncInternetTime()
  }, [])

  const { data, isLoading } = useSWR(
    user ? ['predictions-data', user.id] : null,
    ([key, userId]) => fetchPredictionsData(userId as string),
    {
      dedupingInterval: 30000,
      revalidateOnFocus: false
    }
  )

  const userPredictions = data?.preds || []
  const allMatches = data?.all || []

  const predictedIds = new Set(userPredictions.map((p: any) => p.match_id))
  const availableMatches = allMatches.filter((m: any) => !predictedIds.has(m.id) && m.status === 'pending' && m.phase === 'group')

  useEffect(() => {
    if (allMatches.length === 0) return
    const realTime = new Date(new Date().getTime() + timeOffset)
    const isKnockoutDate = realTime > new Date('2026-06-27T23:59:59-04:00')
    const hasKnockoutMatches = allMatches.some((m: any) => m.phase !== 'group' && m.home_team_id)

    if (isKnockoutDate || hasKnockoutMatches) {
      setActiveTab('bracket')
    }
  }, [allMatches, timeOffset])


  // A função de salvar agora aceita o penaltyWinner
  const savePrediction = async (matchId: string, home: number, away: number, penaltyWinner: 'home' | 'away' | null, predictionId?: string) => {
    if (!user) return
    try {
      const payload: any = {
        user_id: user.id,
        match_id: matchId,
        home_score: home,
        away_score: away,
        penalty_winner: penaltyWinner
      }
      if (predictionId) payload.id = predictionId

      const { error } = await predictions.upsertPrediction(payload)
      if (error) throw error

      mutate(['predictions-data', user.id])

    } catch (error) {
      console.error(error)
      alert('Erro ao salvar palpite. Verifique a conexão.')
      throw error
    }
  }

  if (isLoading) return <div className="flex justify-center py-20 animate-pulse text-lg">Carregando jogos...</div>

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Meus Palpites</h1>
        <p className="text-muted-foreground text-sm sm:text-base">Faça seus palpites para a Copa do Mundo 2026</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50 p-1">
          <TabsTrigger value="available">Fase de Grupos ({availableMatches.length})</TabsTrigger>
          <TabsTrigger value="my-predictions">Meus Palpites</TabsTrigger>
          <TabsTrigger value="bracket" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">
            <GitMerge className="w-4 h-4 mr-2" />
            Mata-Mata
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4 max-w-4xl mx-auto">
          {availableMatches.length === 0 ? (
            <Card className="py-12 flex flex-col items-center text-muted-foreground">
              <Target className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma partida de grupos pendente</p>
            </Card>
          ) : (
            // Repassando savePrediction sem alterações visuais aqui (pois é Fase de Grupos)
            availableMatches.map((match) => <PredictionForm key={match.id} match={match} onSave={savePrediction} timeOffset={timeOffset} />)
          )}
        </TabsContent>

        <TabsContent value="my-predictions" className="space-y-4 max-w-4xl mx-auto">
          {userPredictions.filter((p: any) => p.match.phase === 'group').length === 0 ? (
            <Card className="py-12 flex flex-col items-center text-muted-foreground">
              <Target className="h-12 w-12 mb-4 opacity-50" />
              <p>Você ainda não palpitou na fase de grupos</p>
            </Card>
          ) : (
            userPredictions
              .filter((p: any) => p.match.phase === 'group')
              .map((pred: any) => {
                const realCurrentTime = new Date(new Date().getTime() + timeOffset)
                const isLocked = normalizeDate(pred.match.match_date) <= realCurrentTime || pred.match.status !== 'pending'
                const isFinished = pred.match.status === 'finished'

                if (!isLocked) {
                  return (
                    <PredictionForm
                      key={pred.id} match={pred.match}
                      initialHome={pred.home_score} initialAway={pred.away_score}
                      predictionId={pred.id} onSave={savePrediction}
                      timeOffset={timeOffset}
                    />
                  )
                }

                return (
                  <div key={pred.id} className="p-4 border rounded-lg bg-card flex flex-col gap-4 opacity-90 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
                      <Badge variant="secondary">{getPhaseLabel(pred.match.phase)}</Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Lock className="h-4 w-4" /> {formatDate(pred.match.match_date)}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4 w-full justify-center sm:justify-start">
                        <div className="flex flex-col items-center gap-1 min-w-[80px]">
                          <TeamFlag flagCode={pred.match.home_team.flag_code} />
                          <span className="font-medium text-sm text-center">{pred.match.home_team.name}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-3xl font-black text-primary tracking-widest bg-muted px-4 py-2 rounded-lg">
                            {pred.home_score} - {pred.away_score}
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">Seu Palpite</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 min-w-[80px]">
                          <TeamFlag flagCode={pred.match.away_team.flag_code} />
                          <span className="font-medium text-sm text-center">{pred.match.away_team.name}</span>
                        </div>
                      </div>

                      {isFinished ? (
                        <div className="flex flex-col items-center bg-primary/10 p-3 rounded-lg min-w-[120px] shadow-inner">
                          <span className="text-xs font-bold text-primary mb-1">PLACAR FINAL</span>
                          <span className="text-lg font-black text-primary mb-2 tracking-widest">
                            {pred.match.home_score} - {pred.match.away_score}
                          </span>
                          <Badge className={`h-6 px-3 text-xs whitespace-nowrap ${pred.points_earned > 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-muted-foreground'}`}>
                            {pred.points_earned > 0 && <Check className="h-3 w-3 mr-1" />}
                            {pred.points_earned} pts
                          </Badge>
                        </div>
                      ) : (
                        pred.points_earned > 0 && (
                          <Badge className="h-8 px-4 text-sm whitespace-nowrap bg-green-600 hover:bg-green-700">
                            <Check className="h-4 w-4 mr-1" /> +{pred.points_earned} pts
                          </Badge>
                        )
                      )}
                    </div>
                    <FriendsPredictionsList matchId={pred.match_id} matchDate={pred.match.match_date} timeOffset={timeOffset} isFinished={isFinished} />
                  </div>
                )
              })
          )}
        </TabsContent>

        <TabsContent value="bracket" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-t-4 border-t-primary shadow-xl bg-gradient-to-b from-card to-muted/10">
            <div className="p-6 text-center border-b">
              <h2 className="text-2xl font-black uppercase tracking-wider text-primary flex items-center justify-center gap-2">
                <GitMerge className="h-6 w-6" /> Rumo à Final
              </h2>
              <p className="text-muted-foreground mt-1">Toque nos confrontos para salvar os seus palpites do mata-mata.</p>
            </div>
            <div className="p-4 sm:p-6">
              <KnockoutBracket
                allMatches={allMatches}
                userPredictions={userPredictions}
                onSave={savePrediction}
                timeOffset={timeOffset}
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}