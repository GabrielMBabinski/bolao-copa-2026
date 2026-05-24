import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { matches } from '@/lib/supabaseClient'
import type { MatchWithTeams } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Trophy } from 'lucide-react'

export default function Dashboard() {
  const { profile } = useAuth()
  const [upcomingMatches, setUpcomingMatches] = useState<MatchWithTeams[]>([])
  const [finishedMatches, setFinishedMatches] = useState<MatchWithTeams[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMatches() {
      try {
        const { data: upcoming } = await matches.getUpcoming(3)
        const { data: finished } = await matches.getFinished(5)
        setUpcomingMatches(upcoming || [])
        setFinishedMatches(finished || [])
      } catch (error) {
        console.error('Erro ao carregar partidas:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMatches()
  }, [])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Bem-vindo, {profile?.name}!</h1>
        <p className="text-muted-foreground">
          Acompanhe as próximas partidas e os resultados mais recentes
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximas Partidas
            </CardTitle>
            <CardDescription>Partidas dos próximos 3 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingMatches.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma partida próxima encontrada
              </p>
            ) : (
              <div className="space-y-4">
                {upcomingMatches.map((match) => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Últimos Resultados
            </CardTitle>
            <CardDescription>Partidas finalizadas recentemente</CardDescription>
          </CardHeader>
          <CardContent>
            {finishedMatches.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma partida finalizada encontrada
              </p>
            ) : (
              <div className="space-y-4">
                {finishedMatches.map((match) => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
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
                          <span className="text-2xl font-bold">
                            {match.home_score} - {match.away_score}
                          </span>
                          <span className="font-medium">{match.away_team.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seus Pontos</CardTitle>
          <CardDescription>Sua pontuação atual no bolão</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-4xl font-bold text-primary">{profile?.total_points || 0}</div>
              <div className="text-sm text-muted-foreground mt-1">Pontos Totais</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-4xl font-bold text-primary">{profile?.exact_scores || 0}</div>
              <div className="text-sm text-muted-foreground mt-1">Placares Exatos</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-4xl font-bold text-primary">
                {profile?.total_points && profile?.exact_scores
                  ? ((profile.exact_scores / Math.max(profile.total_points, 1)) * 100).toFixed(1)
                  : '0'}%
              </div>
              <div className="text-sm text-muted-foreground mt-1">Taxa de Acerto</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
