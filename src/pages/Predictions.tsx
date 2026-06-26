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

// --- FUNÇÕES AUXILIARES ---
const normalizeDate = (dateString: string) => {
  const formattedString = dateString.replace(' ', 'T')
  const hasTimezone = formattedString.includes('Z') || formattedString.match(/[+-]\d{2}:\d{2}$/)
  const safeDateStr = hasTimezone ? formattedString : `${formattedString}-04:00`
  return new Date(safeDateStr)
}

const formatDate = (dateString: string) => {
  return normalizeDate(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const getPhaseLabel = (phase: string) => {
  const labels: Record<string, string> = {
    group: 'Fase de Grupos', round_32: 'Dezesseis-avos', round_16: 'Oitavas',
    quarter: 'Quartas', semi: 'Semifinal', final: 'Final',
  }
  return labels[phase] || phase
}

// --- COMPONENTE DE LISTA DE AMIGOS ---
const FriendsPredictionsList = ({ matchId, matchDate, timeOffset, isFinished }: { matchId: string, matchDate: string, timeOffset: number, isFinished: boolean }) => {
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
        <div className="mt-3 p-3 bg-muted rounded-lg space-y-2">
          {loading ? <div className="text-sm text-center animate-pulse">Carregando palpites...</div> :
            list.length === 0 ? <div className="text-sm text-center">Ninguém mais palpitou.</div> :
              list.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-background p-2 rounded border border-border/50 shadow-sm">
                  <span className="truncate font-medium">{p.profiles?.name || 'Anônimo'}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-bold text-primary">
                      {p.home_score} x {p.away_score}
                      {/* Mostra asterisco se empatou e escolheu alguem nos penaltis */}
                      {p.home_score === p.away_score && p.penalty_winner && <span className="text-yellow-500 ml-1">*</span>}
                    </Badge>
                    {isFinished && p.points_earned !== null && p.points_earned !== undefined && (
                      <Badge className={`${p.points_earned > 0 ? "bg-green-600 text-white" : "bg-muted-foreground text-white"} ml-2 min-w-[50px] justify-center`}>
                        {p.points_earned} pts
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
        </div>
      )}
    </div>
  )
}

// --- COMPONENTE DE FORMULÁRIO ---
const PredictionForm = ({ match, onSave, initialHome = '', initialAway = '', initialPenaltyWinner = null, predictionId, timeOffset, onSavedCallback }: { match: MatchWithTeams, onSave: (id: string, home: number, away: number, penaltyWinner: 'home'|'away'|null, predId?: string) => Promise<void>, initialHome?: number | '', initialAway?: number | '', initialPenaltyWinner?: 'home'|'away'|null, predictionId?: string, timeOffset: number, onSavedCallback?: () => void }) => {
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

      {isLocked && <FriendsPredictionsList matchId={match.id} matchDate={match.match_date} timeOffset={timeOffset} isFinished={isFinished} />}
    </div>
  )
}

// --- COMPONENTE: ÁRVORE DO MATA-MATA ---
const KnockoutBracket = ({ allMatches, userPredictions, onSave, timeOffset }: { allMatches: MatchWithTeams[], userPredictions: PredictionWithMatch[], onSave: any, timeOffset: number }) => {
  const [selectedMatch, setSelectedMatch] = useState<{ match: MatchWithTeams, pred: any } | null>(null)

  const phases = ['round_32', 'round_16', 'quarter', 'semi', 'final']

  const BracketNode = ({ match }: { match: MatchWithTeams }) => {
    const pred: any = userPredictions.find(p => p.match_id === match.id)
    const realCurrentTime = new Date(new Date().getTime() + timeOffset)
    const isLocked = normalizeDate(match.match_date) <= realCurrentTime || match.status !== 'pending'

    const homeTeamName = match.home_team?.name || 'A Def.'
    const awayTeamName = match.away_team?.name || 'A Def.'
    const isReady = match.home_team && match.away_team

    return (
      <div
        onClick={() => { if (isReady) setSelectedMatch({ match, pred }) }}
        className={`relative flex flex-col p-2 w-48 border rounded-lg shadow-sm transition-all
          ${isLocked ? 'bg-muted/30 border-border/50' : isReady ? 'bg-card cursor-pointer hover:border-primary hover:shadow-md' : 'bg-muted/10 opacity-60'}
        `}
      >
        <div className="text-[10px] text-muted-foreground mb-1 text-center border-b pb-1">
          {formatDate(match.match_date).split(',')[0]}
        </div>

        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 overflow-hidden">
            {match.home_team?.flag_code ? <TeamFlag flagCode={match.home_team.flag_code} /> : <div className="w-5 h-4 bg-muted rounded"></div>}
            <span className="text-xs font-medium truncate">
              {homeTeamName}
              {/* Asterisco amarelo se este for o vencedor dos pênaltis */}
              {pred?.home_score === pred?.away_score && pred?.penalty_winner === 'home' && <span className="text-yellow-500 ml-1 font-black" title="Vence nos Pênaltis">*</span>}
            </span>
          </div>
          <span className={`text-xs font-bold w-6 text-center rounded ${pred ? 'bg-primary/20 text-primary' : 'bg-muted'}`}>
            {pred ? pred.home_score : '-'}
          </span>
        </div>

        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 overflow-hidden">
            {match.away_team?.flag_code ? <TeamFlag flagCode={match.away_team.flag_code} /> : <div className="w-5 h-4 bg-muted rounded"></div>}
            <span className="text-xs font-medium truncate">
              {awayTeamName}
              {/* Asterisco amarelo se este for o vencedor dos pênaltis */}
              {pred?.home_score === pred?.away_score && pred?.penalty_winner === 'away' && <span className="text-yellow-500 ml-1 font-black" title="Vence nos Pênaltis">*</span>}
            </span>
          </div>
          <span className={`text-xs font-bold w-6 text-center rounded ${pred ? 'bg-primary/20 text-primary' : 'bg-muted'}`}>
            {pred ? pred.away_score : '-'}
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

  return (
    <div className="w-full">
      <div className="bg-muted/20 border border-dashed rounded-xl p-4 overflow-x-auto custom-scrollbar">
        <div className="flex gap-8 min-w-max pb-4">
          {phases.map(phase => {
            const phaseMatches = allMatches.filter(m => m.phase === phase).sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
            if (phaseMatches.length === 0) return null

            return (
              <div key={phase} className="flex flex-col gap-4 relative">
                <h3 className="font-bold text-center text-sm uppercase tracking-wider text-muted-foreground sticky top-0 bg-background/90 py-1 rounded-md backdrop-blur-sm z-10">
                  {getPhaseLabel(phase)}
                </h3>
                <div className="flex flex-col gap-6 justify-center flex-1 py-4">
                  {phaseMatches.map(match => (
                    <BracketNode key={match.id} match={match} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

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
          <TabsTrigger value="available">Grupos ({availableMatches.length})</TabsTrigger>
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