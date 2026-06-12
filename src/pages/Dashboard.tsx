import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { matches } from '@/lib/supabaseClient'
import type { MatchWithTeams } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Trophy } from 'lucide-react'
import TeamFlag from '@/components/TeamFlag'

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
      round_32: 'Dezesseis-avos',
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
        <div className="text-lg animate-pulse">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto">
      
      {/* CABEÇALHO DE BOAS VINDAS */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 truncate">Bem-vindo, {profile?.name}!</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Acompanhe as próximas partidas e os resultados mais recentes
        </p>
      </div>

      {/* BANNER DO NEYMAR (O Ícone Épico) */}
      <div className="relative w-full h-40 sm:h-64 md:h-80 rounded-2xl overflow-hidden mb-8 shadow-xl border border-muted group">
        <img 
          src="/neymar-banner.jpg" 
          alt="Neymar Copa 2026" 
          className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white drop-shadow-lg uppercase tracking-wider">
            Rumo ao Hexa!
          </h2>
          <p className="text-white/90 text-sm sm:text-base md:text-lg font-medium drop-shadow-md max-w-md mt-1 sm:mt-2">
            Faça seus palpites!
          </p>
        </div>
      </div>

      {/* LINHA DOS CARDS DOS JOGOS */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* CARD 1: AO VIVO E PRÓXIMAS */}
        <Card className="flex flex-col border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Calendar className="h-5 w-5 text-primary" />
              Ao Vivo & Próximas
            </CardTitle>
            <CardDescription>Partidas rolando agora e dos próximos 3 dias</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {upcomingMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                <Calendar className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma partida próxima</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingMatches.map((match) => (
                  <div key={match.id} className={`flex flex-col p-3 border rounded-lg transition-colors ${match.status === 'in_progress' ? 'bg-red-500/5 border-red-500/20' : 'bg-card hover:bg-muted/30'}`}>
                    <div className="flex items-center justify-between mb-3 border-b pb-2">
                      <Badge variant="outline" className="text-xs">{getPhaseLabel(match.phase)}</Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <Clock className="h-3 w-3" />
                        {formatDate(match.match_date)}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 sm:gap-4">
                      <div className="flex flex-col items-center flex-1">
                        <TeamFlag flagCode={match.home_team.flag_code} />
                        <span className="font-medium text-xs sm:text-sm text-center mt-1 truncate max-w-[80px] sm:max-w-[120px]">{match.home_team.name}</span>
                      </div>
                      
                      {/* A MÁGICA DO PLACAR AO VIVO ACONTECE AQUI */}
                      {match.status === 'in_progress' ? (
                        <div className="flex flex-col items-center mx-2">
                          <span className="text-lg sm:text-xl font-black text-red-500 tracking-widest bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20">
                            {match.home_score} - {match.away_score}
                          </span>
                          <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-1 animate-pulse">Ao Vivo</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs font-bold bg-muted px-2 py-1 rounded-md mx-2">X</span>
                      )}

                      <div className="flex flex-col items-center flex-1">
                        <TeamFlag flagCode={match.away_team.flag_code} />
                        <span className="font-medium text-xs sm:text-sm text-center mt-1 truncate max-w-[80px] sm:max-w-[120px]">{match.away_team.name}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* CARD 2: ÚLTIMOS RESULTADOS */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Trophy className="h-5 w-5 text-primary" />
              Últimos Resultados
            </CardTitle>
            <CardDescription>Partidas finalizadas recentemente</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {finishedMatches.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                <Trophy className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">Nenhum resultado recente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {finishedMatches.map((match) => (
                  <div key={match.id} className="flex flex-col p-3 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between mb-3 border-b pb-2">
                      <Badge variant="secondary" className="text-xs">{getPhaseLabel(match.phase)}</Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <Clock className="h-3 w-3" />
                        {formatDate(match.match_date)}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 sm:gap-4">
                      <div className="flex flex-col items-center flex-1">
                        <TeamFlag flagCode={match.home_team.flag_code} />
                        <span className="font-medium text-xs sm:text-sm text-center mt-1 truncate max-w-[80px] sm:max-w-[120px]">{match.home_team.name}</span>
                      </div>
                      <span className="text-lg sm:text-2xl font-black text-primary tracking-widest bg-muted px-3 py-1 rounded-lg">
                        {match.home_score} - {match.away_score}
                      </span>
                      <div className="flex flex-col items-center flex-1">
                        <TeamFlag flagCode={match.away_team.flag_code} />
                        <span className="font-medium text-xs sm:text-sm text-center mt-1 truncate max-w-[80px] sm:max-w-[120px]">{match.away_team.name}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PAINEL DE PONTUAÇÃO DO JOGADOR */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle>Seus Estatísticas</CardTitle>
          <CardDescription>Sua performance atual no ranking geral do bolão</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-card hover:border-primary/50 transition-colors">
              <div className="text-4xl sm:text-5xl font-black text-primary">{profile?.total_points || 0}</div>
              <div className="text-sm font-medium text-muted-foreground mt-2 uppercase tracking-wide">Pontos Totais</div>
            </div>
            <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-card hover:border-primary/50 transition-colors">
              <div className="text-4xl sm:text-5xl font-black text-primary">{profile?.exact_scores || 0}</div>
              <div className="text-sm font-medium text-muted-foreground mt-2 uppercase tracking-wide">Placares Exatos</div>
            </div>
            <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-card hover:border-primary/50 transition-colors">
              <div className="text-4xl sm:text-5xl font-black text-primary">
                {profile?.total_points && profile?.exact_scores
                  ? ((profile.exact_scores / Math.max(profile.total_points, 1)) * 100).toFixed(0)
                  : '0'}%
              </div>
              <div className="text-sm font-medium text-muted-foreground mt-2 uppercase tracking-wide">Taxa de Acerto</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}