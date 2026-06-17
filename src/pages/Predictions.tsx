import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr' // <-- Novo import do SWR
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

// --- FUNÇÕES AUXILIARES MANTIDAS ---
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

// ... (OS COMPONENTES FriendsPredictionsList, PredictionForm e KnockoutBracket CONTINUAM EXATAMENTE IGUAIS AQUI NO MEIO) ...
// (Cole eles aqui do seu arquivo original para não perdê-los)

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

  // --- Sincronização do Relógio (Mantida, pois tem proteção try/catch) ---
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

  // ==========================================
  // O ESCUDO DE CACHE (SWR) PARA OS PALPITES
  // ==========================================
  const { data, isLoading } = useSWR(
    user ? ['predictions-data', user.id] : null, // Chave única para este usuário
    ([key, userId]) => fetchPredictionsData(userId as string),
    {
      dedupingInterval: 30000, // Proteção de 30 segundos contra requisições duplicadas
      revalidateOnFocus: false // Não gasta cota se ele minimizar e maximizar o navegador
    }
  )

  // Desestruturando os dados do Cache (sem precisar de useState)
  const userPredictions = data?.preds || []
  const allMatches = data?.all || []

  // Filtra dinamicamente na hora os jogos disponíveis (sem useEffect)
  const predictedIds = new Set(userPredictions.map((p: any) => p.match_id))
  const availableMatches = allMatches.filter((m: any) => !predictedIds.has(m.id) && m.status === 'pending' && m.phase === 'group')

  // Lógica de Transição Automática para a Árvore
  useEffect(() => {
    if (allMatches.length === 0) return
    const realTime = new Date(new Date().getTime() + timeOffset)
    const isKnockoutDate = realTime > new Date('2026-06-27T23:59:59-04:00')
    const hasKnockoutMatches = allMatches.some((m: any) => m.phase !== 'group' && m.home_team_id)

    if (isKnockoutDate || hasKnockoutMatches) {
      setActiveTab('bracket')
    }
  }, [allMatches, timeOffset])

  const savePrediction = async (matchId: string, home: number, away: number, predictionId?: string) => {
    if (!user) return
    try {
      const payload: any = { user_id: user.id, match_id: matchId, home_score: home, away_score: away }
      if (predictionId) payload.id = predictionId

      const { error } = await predictions.upsertPrediction(payload)
      if (error) throw error

      // --- O PULO DO GATO ---
      // Dizemos ao SWR para "revalidar" a chave deste usuário no fundo.
      // Ele faz a leitura nova sem recarregar a tela, atualizando a UI instantaneamente!
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