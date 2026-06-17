import { useEffect, useState } from 'react'
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
        .select('home_score, away_score, points_earned, profiles(name)')
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
                <Badge variant="secondary" className="font-bold text-primary">{p.home_score} x {p.away_score}</Badge>
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

// --- COMPONENTE DE FORMULÁRIO (USADO NA LISTA E NO MODAL) ---
const PredictionForm = ({ match, onSave, initialHome = '', initialAway = '', predictionId, timeOffset, onSavedCallback }: { match: MatchWithTeams, onSave: (id: string, home: number, away: number, predId?: string) => Promise<void>, initialHome?: number | '', initialAway?: number | '', predictionId?: string, timeOffset: number, onSavedCallback?: () => void }) => {
  const [homeScore, setHomeScore] = useState<number | ''>(initialHome)
  const [awayScore, setAwayScore] = useState<number | ''>(initialAway)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false) 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (homeScore === '' || awayScore === '') return
    
    setSaving(true)
    await onSave(match.id, Number(homeScore), Number(awayScore), predictionId)
    setSaving(false)
    
    setJustSaved(true)
    if (onSavedCallback) {
      setTimeout(() => {
        setJustSaved(false)
        onSavedCallback() // Fecha o modal após salvar
      }, 1000)
    } else {
      setTimeout(() => setJustSaved(false), 2000)
    }
  }

  const realCurrentTime = new Date(new Date().getTime() + timeOffset)
  const isLocked = normalizeDate(match.match_date) <= realCurrentTime
  const isFinished = match.status === 'finished'

  const homeTeamName = match.home_team?.name || 'A Definir'
  const awayTeamName = match.away_team?.name || 'A Definir'

  return (
    <div className={`p-4 border rounded-lg flex flex-col gap-4 ${isLocked ? 'opacity-80 bg-muted/10' : 'bg-card shadow-sm hover:shadow-md transition-all'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
        <Badge variant={isLocked ? "secondary" : "outline"} className="w-fit">{getPhaseLabel(match.phase)}</Badge>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          {isLocked ? <Lock className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          {formatDate(match.match_date)}
          {isLocked && <span className="ml-1 font-medium text-destructive">(Encerrado)</span>}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center justify-center gap-2 sm:gap-4 w-full md:w-auto flex-wrap">
          <div className="flex flex-col items-center gap-1 min-w-[80px]">
            {match.home_team?.flag_code ? <TeamFlag flagCode={match.home_team.flag_code} /> : <div className="w-8 h-6 bg-muted rounded"></div>}
            <span className="font-medium text-sm text-center">{homeTeamName}</span>
          </div>
          <span className="text-muted-foreground text-sm font-bold bg-muted px-2 py-1 rounded-md">X</span>
          <div className="flex flex-col items-center gap-1 min-w-[80px]">
             {match.away_team?.flag_code ? <TeamFlag flagCode={match.away_team.flag_code} /> : <div className="w-8 h-6 bg-muted rounded"></div>}
            <span className="font-medium text-sm text-center">{awayTeamName}</span>
          </div>
        </div>

        {!isLocked && match.home_team && match.away_team ? (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto bg-muted/30 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Input type="number" min="0" max="20" required value={homeScore} onChange={(e) => setHomeScore(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-16 h-10 text-center font-bold text-lg" placeholder="0" />
              <span className="text-muted-foreground font-bold">-</span>
              <Input type="number" min="0" max="20" required value={awayScore} onChange={(e) => setAwayScore(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-16 h-10 text-center font-bold text-lg" placeholder="0" />
            </div>
            
            <Button 
              type="submit" 
              disabled={saving || justSaved} 
              className={`w-full sm:w-auto transition-colors duration-300 ${justSaved ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
            >
              {saving ? 'Salvando...' : justSaved ? 'Salvo! ✅' : predictionId ? 'Atualizar' : 'Salvar'}
            </Button>
          </form>
        ) : !isLocked && (!match.home_team || !match.away_team) ? (
          <Badge variant="outline" className="text-muted-foreground">Aguardando Seleções</Badge>
        ) : null}
      </div>

      {isLocked && <FriendsPredictionsList matchId={match.id} matchDate={match.match_date} timeOffset={timeOffset} isFinished={isFinished} />}
    </div>
  )
}

// --- NOVO COMPONENTE: ÁRVORE DO MATA-MATA ---
const KnockoutBracket = ({ allMatches, userPredictions, onSave, timeOffset }: { allMatches: MatchWithTeams[], userPredictions: PredictionWithMatch[], onSave: any, timeOffset: number }) => {
  const [selectedMatch, setSelectedMatch] = useState<{match: MatchWithTeams, pred: PredictionWithMatch | undefined} | null>(null)
  
  // Fases do Mata-Mata na ordem correta
  const phases = ['round_32', 'round_16', 'quarter', 'semi', 'final']

  // Função para desenhar cada "Caixinha" da árvore
  const BracketNode = ({ match }: { match: MatchWithTeams }) => {
    const pred = userPredictions.find(p => p.match_id === match.id)
    const realCurrentTime = new Date(new Date().getTime() + timeOffset)
    const isLocked = normalizeDate(match.match_date) <= realCurrentTime

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
        
        {/* Time da Casa */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 overflow-hidden">
            {match.home_team?.flag_code ? <TeamFlag flagCode={match.home_team.flag_code} /> : <div className="w-5 h-4 bg-muted rounded"></div>}
            <span className="text-xs font-medium truncate">{homeTeamName}</span>
          </div>
          <span className={`text-xs font-bold w-6 text-center rounded ${pred ? 'bg-primary/20 text-primary' : 'bg-muted'}`}>
            {pred ? pred.home_score : '-'}
          </span>
        </div>

        {/* Time Visitante */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 overflow-hidden">
            {match.away_team?.flag_code ? <TeamFlag flagCode={match.away_team.flag_code} /> : <div className="w-5 h-4 bg-muted rounded"></div>}
            <span className="text-xs font-medium truncate">{awayTeamName}</span>
          </div>
          <span className={`text-xs font-bold w-6 text-center rounded ${pred ? 'bg-primary/20 text-primary' : 'bg-muted'}`}>
            {pred ? pred.away_score : '-'}
          </span>
        </div>

        {/* Status de Pontos Se Acabou */}
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

      {/* POP-UP (MODAL) PARA FAZER O PALPITE NA ÁRVORE */}
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
                predictionId={selectedMatch.pred?.id} 
                onSave={onSave} 
                timeOffset={timeOffset}
                onSavedCallback={() => setSelectedMatch(null)} // Fecha o modal ao salvar
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- COMPONENTE PRINCIPAL ---
export default function Predictions() {
  const { user } = useAuth()
  const [userPredictions, setUserPredictions] = useState<PredictionWithMatch[]>([])
  const [allMatches, setAllMatches] = useState<MatchWithTeams[]>([])
  const [availableMatches, setAvailableMatches] = useState<MatchWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  const [timeOffset, setTimeOffset] = useState(0)

  // Controle de Aba Automático
  const [activeTab, setActiveTab] = useState<string>('available')

  useEffect(() => {
    async function syncInternetTime() {
      try {
        const res = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC')
        const data = await res.json()
        const internetTime = new Date(data.datetime).getTime()
        const localTime = new Date().getTime()
        setTimeOffset(internetTime - localTime)
      } catch (error) {
        console.log('API de tempo falhou', error)
      }
    }
    syncInternetTime()
  }, [])

  useEffect(() => {
    async function loadData() {
      if (!user) return
      try {
        const { data: preds } = await predictions.getUserPredictions(user.id)
        setUserPredictions(preds || [])

        const { data: matchesData } = await matches.getAll()
        const allMatchesData = matchesData || []
        setAllMatches(allMatchesData)

        // Filtra os que ainda precisam ser palpitados E são da FASE DE GRUPOS
        const predictedIds = new Set((preds || []).map((p: any) => p.match_id))
        const available = allMatchesData.filter((m: any) => !predictedIds.has(m.id) && m.status === 'pending' && m.phase === 'group')
        setAvailableMatches(available)

        // --- LÓGICA DE TRANSIÇÃO AUTOMÁTICA PARA A ÁRVORE ---
        // Se já passamos do dia 28/06/2026 OU se existem jogos de mata-mata já definidos no banco
        const realTime = new Date(new Date().getTime() + timeOffset)
        const isKnockoutDate = realTime > new Date('2026-06-27T23:59:59-04:00')
        const hasKnockoutMatches = allMatchesData.some(m => m.phase !== 'group' && m.home_team_id)

        if (isKnockoutDate || hasKnockoutMatches) {
          setActiveTab('bracket')
        }

      } catch (error) {
        console.error('Erro:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user, timeOffset])

  const savePrediction = async (matchId: string, home: number, away: number, predictionId?: string) => {
    if (!user) return
    try {
      const payload: any = { user_id: user.id, match_id: matchId, home_score: home, away_score: away }
      if (predictionId) payload.id = predictionId

      const { error } = await predictions.upsertPrediction(payload)
      if (error) throw error

      // Atualiza os estados locais para refletir a UI instantaneamente
      const matchToMove = allMatches.find(m => m.id === matchId)
      
      if (matchToMove) {
        setAvailableMatches(prev => prev.filter(m => m.id !== matchId))
        
        // Atualiza a lista de predições
        const { data: preds } = await predictions.getUserPredictions(user.id)
        if(preds) setUserPredictions(preds)
      }
    } catch (error) {
      console.error(error)
      alert('Erro ao salvar palpite. Verifique a conexão.')
      throw error 
    }
  }

  if (loading) return <div className="flex justify-center py-20 animate-pulse text-lg">Carregando jogos...</div>

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
            availableMatches.map((match) => <PredictionForm key={match.id} match={match} onSave={savePrediction} timeOffset={timeOffset} />)
          )}
        </TabsContent>

        <TabsContent value="my-predictions" className="space-y-4 max-w-4xl mx-auto">
          {userPredictions.filter(p => p.match.phase === 'group').length === 0 ? (
             <Card className="py-12 flex flex-col items-center text-muted-foreground">
               <Target className="h-12 w-12 mb-4 opacity-50" />
               <p>Você ainda não palpitou na fase de grupos</p>
             </Card>
          ) : (
            userPredictions
              .filter(p => p.match.phase === 'group')
              .map((pred) => {
              const realCurrentTime = new Date(new Date().getTime() + timeOffset)
              const isLocked = normalizeDate(pred.match.match_date) <= realCurrentTime
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
              <p className="text-muted-foreground mt-1">Em breve...</p>
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