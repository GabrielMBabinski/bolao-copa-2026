import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { matches, predictions, supabase } from '@/lib/supabaseClient'
import type { MatchWithTeams, PredictionWithMatch } from '@/types/database'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Target, Clock, Lock, Check, Users } from 'lucide-react'
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
const FriendsPredictionsList = ({ matchId }: { matchId: string }) => {
  const [show, setShow] = useState(false)
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('predictions')
        .select('home_score, away_score, profiles(name)')
        .eq('match_id', matchId)
      setList(data || [])
    } catch (e) {
      console.error(e)
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
          {loading ? <div className="text-sm text-center">Carregando...</div> :
           list.length === 0 ? <div className="text-sm text-center">Ninguém mais palpitou.</div> :
           list.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm bg-background p-2 rounded border border-border/50 shadow-sm">
              <span className="truncate font-medium">{p.profiles?.name || 'Anônimo'}</span>
              <Badge variant="secondary" className="font-bold text-primary">{p.home_score} x {p.away_score}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- COMPONENTE EXTRAÍDO ---
const PredictionForm = ({ match, onSave, initialHome = '', initialAway = '', predictionId, timeOffset }: { match: MatchWithTeams, onSave: (id: string, home: number, away: number, predId?: string) => Promise<void>, initialHome?: number | '', initialAway?: number | '', predictionId?: string, timeOffset: number }) => {
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
    setTimeout(() => setJustSaved(false), 2000)
  }

  // A NOVA REGRA BLINDADA COM A HORA DA INTERNET
  const realCurrentTime = new Date(new Date().getTime() + timeOffset)
  const isLocked = normalizeDate(match.match_date) <= realCurrentTime

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
            <TeamFlag flagCode={match.home_team.flag_code} />
            <span className="font-medium text-sm text-center">{match.home_team.name}</span>
          </div>
          <span className="text-muted-foreground text-sm font-bold bg-muted px-2 py-1 rounded-md">X</span>
          <div className="flex flex-col items-center gap-1 min-w-[80px]">
            <TeamFlag flagCode={match.away_team.flag_code} />
            <span className="font-medium text-sm text-center">{match.away_team.name}</span>
          </div>
        </div>

        {!isLocked && (
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
        )}
      </div>

      {isLocked && <FriendsPredictionsList matchId={match.id} />}
    </div>
  )
}

// --- COMPONENTE PRINCIPAL ---
export default function Predictions() {
  const { user } = useAuth()
  const [userPredictions, setUserPredictions] = useState<PredictionWithMatch[]>([])
  const [availableMatches, setAvailableMatches] = useState<MatchWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  
  // Estado que armazena a diferença entre a hora do celular e a hora real
  const [timeOffset, setTimeOffset] = useState(0)

  // Busca a hora da internet assim que a tela abre
  useEffect(() => {
    async function syncInternetTime() {
      try {
        const res = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC')
        const data = await res.json()
        const internetTime = new Date(data.datetime).getTime()
        const localTime = new Date().getTime()
        
        // Salva se o usuário está adiantado ou atrasado em milissegundos
        setTimeOffset(internetTime - localTime)
      } catch (error) {
        console.log('API de tempo falhou, caindo para hora local', error)
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

        const { data: allMatches } = await matches.getAll()
        const predictedIds = new Set((preds || []).map((p: any) => p.match_id))
        const available = (allMatches || []).filter((m: any) => !predictedIds.has(m.id) && m.status === 'pending')
        
        setAvailableMatches(available)
      } catch (error) {
        console.error('Erro:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user])

  const savePrediction = async (matchId: string, home: number, away: number, predictionId?: string) => {
    if (!user) return
    try {
      const payload: any = { user_id: user.id, match_id: matchId, home_score: home, away_score: away }
      if (predictionId) payload.id = predictionId

      const { error } = await predictions.upsertPrediction(payload)
      if (error) throw error

      const matchToMove = availableMatches.find(m => m.id === matchId)
      
      if (matchToMove) {
        setAvailableMatches(prev => prev.filter(m => m.id !== matchId))
        setUserPredictions(prev => [...prev, { 
          id: Math.random().toString(), match_id: matchId, home_score: home, away_score: away, points_earned: 0, match: matchToMove 
        } as any])
        
        const { data: preds } = await predictions.getUserPredictions(user.id)
        if(preds) setUserPredictions(preds)
      } else {
        setUserPredictions(prev => prev.map(p => 
          p.match_id === matchId ? { ...p, home_score: home, away_score: away } : p
        ))
      }
    } catch (error) {
      console.error(error)
      alert('Erro ao salvar palpite. Verifique a conexão.')
      throw error 
    }
  }

  if (loading) return <div className="flex justify-center py-20 animate-pulse text-lg">Carregando jogos...</div>

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Meus Palpites</h1>
        <p className="text-muted-foreground text-sm sm:text-base">Faça seus palpites para a Copa do Mundo 2026</p>
      </div>

      <Tabs defaultValue="available" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="available">Disponíveis ({availableMatches.length})</TabsTrigger>
          <TabsTrigger value="my-predictions">Meus Palpites ({userPredictions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4">
          {availableMatches.length === 0 ? (
            <Card className="py-12 flex flex-col items-center text-muted-foreground">
              <Target className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma partida disponível no momento</p>
            </Card>
          ) : (
            availableMatches.map((match) => <PredictionForm key={match.id} match={match} onSave={savePrediction} timeOffset={timeOffset} />)
          )}
        </TabsContent>

        <TabsContent value="my-predictions" className="space-y-4">
          {userPredictions.length === 0 ? (
             <Card className="py-12 flex flex-col items-center text-muted-foreground">
               <Target className="h-12 w-12 mb-4 opacity-50" />
               <p>Você ainda não fez nenhum palpite</p>
             </Card>
          ) : (
            userPredictions.map((pred) => {
              
              // Verifica o bloqueio usando a hora da internet combinada
              const realCurrentTime = new Date(new Date().getTime() + timeOffset)
              const isLocked = normalizeDate(pred.match.match_date) <= realCurrentTime

              if (!isLocked) {
                return (
                  <PredictionForm 
                    key={pred.id} match={pred.match} 
                    initialHome={pred.home_score} initialAway={pred.away_score}
                    predictionId={pred.id} onSave={savePrediction} 
                    timeOffset={timeOffset} // Passa o offset adiante
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
                      <span className="text-3xl font-black text-primary tracking-widest bg-muted px-4 py-2 rounded-lg">
                        {pred.home_score} - {pred.away_score}
                      </span>
                      <div className="flex flex-col items-center gap-1 min-w-[80px]">
                        <TeamFlag flagCode={pred.match.away_team.flag_code} />
                        <span className="font-medium text-sm text-center">{pred.match.away_team.name}</span>
                      </div>
                    </div>

                    {pred.points_earned > 0 && (
                      <Badge className="h-8 px-4 text-sm whitespace-nowrap bg-green-600 hover:bg-green-700">
                        <Check className="h-4 w-4 mr-1" /> +{pred.points_earned} pts
                      </Badge>
                    )}
                  </div>

                  <FriendsPredictionsList matchId={pred.match_id} />
                </div>
              )
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}