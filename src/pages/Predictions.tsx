import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { matches, predictions } from '@/lib/supabaseClient'
import { supabase } from '@/lib/supabaseClient'
import type { MatchWithTeams, PredictionWithMatch } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Target, Clock, Lock, Check, Users } from 'lucide-react'

export default function Predictions() {
  const { user, profile } = useAuth()
  const [userPredictions, setUserPredictions] = useState<PredictionWithMatch[]>([])
  const [availableMatches, setAvailableMatches] = useState<MatchWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadData() {
      if (!user) return

      try {
        const { data: preds } = await predictions.getUserPredictions(user.id)
        setUserPredictions(preds || [])

        const { data: allMatches } = await matches.getAll()
        const predictedMatchIds = new Set((preds || []).map((p: PredictionWithMatch) => p.match_id))
        const available = (allMatches || []).filter(
          (m: MatchWithTeams) => !predictedMatchIds.has(m.id) && m.status === 'pending'
        )
        setAvailableMatches(available)
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  const handlePrediction = async (
    matchId: string,
    homeScore: number,
    awayScore: number
  ) => {
    if (!user || !profile) return

    setSaving(true)
    try {
      const { error } = await predictions.upsertPrediction({
        user_id: user.id,
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
      })

      if (error) throw error

      // Reload data
      const { data: preds } = await predictions.getUserPredictions(user.id)
      setUserPredictions(preds || [])

      const { data: allMatches } = await matches.getAll()
      const predictedMatchIds = new Set((preds || []).map((p: PredictionWithMatch) => p.match_id))
      const available = (allMatches || []).filter(
        (m: MatchWithTeams) => !predictedMatchIds.has(m.id) && m.status === 'pending'
      )
      setAvailableMatches(available)
    } catch (error) {
      console.error('Erro ao salvar palpite:', error)
      alert('Erro ao salvar palpite. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getPhaseLabel = (phase: string) => {
    const labels: Record<string, string> = {
      group: 'Fase de Grupos',
      round_32: 'Oitavas de Final',
      round_16: 'Oitavas de Final',
      quarter: 'Quartas de Final',
      semi: 'Semifinais',
      final: 'Final',
    }
    return labels[phase] || phase
  }

  const canPredict = (matchDate: string) => {
    return new Date(matchDate) > new Date()
  }

  const PredictionForm = ({ match }: { match: MatchWithTeams }) => {
    const [homeScore, setHomeScore] = useState<number>(0)
    const [awayScore, setAwayScore] = useState<number>(0)
    const [showFriendsPredictions, setShowFriendsPredictions] = useState<boolean>(false)
    const [friendsPredictions, setFriendsPredictions] = useState<any[]>([])
    const [loadingFriends, setLoadingFriends] = useState<boolean>(false)

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      handlePrediction(match.id, homeScore, awayScore)
    }

    const loadFriendsPredictions = async () => {
      setLoadingFriends(true)
      try {
        const { data, error } = await supabase
          .from('predictions')
          .select('home_score, away_score, profiles(name)')
          .eq('match_id', match.id)

        if (error) throw error
        setFriendsPredictions(data || [])
      } catch (error) {
        console.error('Erro ao carregar palpites dos amigos:', error)
      } finally {
        setLoadingFriends(false)
      }
    }

    if (!canPredict(match.match_date)) {
      return (
        <div className="flex flex-col gap-3 p-4 border rounded-lg opacity-50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline">{getPhaseLabel(match.phase)}</Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  {formatDate(match.match_date)}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{match.home_team.name}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-medium">{match.away_team.name}</span>
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Bloqueado</div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!showFriendsPredictions) {
                loadFriendsPredictions()
              }
              setShowFriendsPredictions(!showFriendsPredictions)
            }}
            className="w-full"
          >
            <Users className="h-4 w-4 mr-2" />
            {showFriendsPredictions ? 'Ocultar palpites da galera' : 'Ver palpites da galera'}
          </Button>

          {showFriendsPredictions && (
            <div className="mt-2 p-3 bg-muted rounded-lg">
              {loadingFriends ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : friendsPredictions.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum palpite registrado</div>
              ) : (
                <div className="space-y-2">
                  {friendsPredictions.map((pred, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{pred.profiles?.name || 'Anônimo'}</span>
                      <span className="text-muted-foreground">
                        {pred.home_score} - {pred.away_score}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    return (
      <form onSubmit={handleSubmit} className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline">{getPhaseLabel(match.phase)}</Badge>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatDate(match.match_date)}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-medium">{match.home_team.name}</span>
              <span className="text-muted-foreground">vs</span>
              <span className="font-medium">{match.away_team.name}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Input
            type="number"
            min="0"
            max="20"
            value={homeScore}
            onChange={(e) => setHomeScore(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-16 text-center"
            required
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            min="0"
            max="20"
            value={awayScore}
            onChange={(e) => setAwayScore(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-16 text-center"
            required
          />
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? '...' : 'Salvar'}
          </Button>
        </div>
      </form>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Meus Palpites</h1>
        <p className="text-muted-foreground">
          Faça seus palpites para as partidas da Copa do Mundo 2026
        </p>
      </div>

      <Tabs defaultValue="available" className="w-full">
        <TabsList>
          <TabsTrigger value="available">
            Disponíveis ({availableMatches.length})
          </TabsTrigger>
          <TabsTrigger value="my-predictions">
            Meus Palpites ({userPredictions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4">
          {availableMatches.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Nenhuma partida disponível para palpites no momento
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {availableMatches.map((match) => (
                <PredictionForm key={match.id} match={match} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-predictions" className="space-y-4">
          {userPredictions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Você ainda não fez nenhum palpite
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {userPredictions.map((prediction) => (
                <div
                  key={prediction.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{getPhaseLabel(prediction.match.phase)}</Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {formatDate(prediction.match.match_date)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{prediction.match.home_team.name}</span>
                        <span className="text-2xl font-bold">
                          {prediction.home_score} - {prediction.away_score}
                        </span>
                        <span className="font-medium">{prediction.match.away_team.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {prediction.points_earned > 0 && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {prediction.points_earned} pts
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
