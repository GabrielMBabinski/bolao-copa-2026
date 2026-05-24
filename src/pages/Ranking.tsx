import { useEffect, useState } from 'react'
import { ranking } from '@/lib/supabaseClient'
import type { Profile } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award } from 'lucide-react'

export default function Ranking() {
  const [leaderboard, setLeaderboard] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const { data } = await ranking.getLeaderboard()
        setLeaderboard(data || [])
      } catch (error) {
        console.error('Erro ao carregar ranking:', error)
      } finally {
        setLoading(false)
      }
    }

    loadLeaderboard()
  }, [])

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />
    if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />
    return <span className="text-sm font-medium text-muted-foreground">#{rank}</span>
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500 hover:bg-yellow-600">1º</Badge>
    if (rank === 2) return <Badge className="bg-gray-400 hover:bg-gray-500">2º</Badge>
    if (rank === 3) return <Badge className="bg-amber-700 hover:bg-amber-800">3º</Badge>
    return <Badge variant="outline">#{rank}</Badge>
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
        <h1 className="text-3xl font-bold mb-2">Ranking</h1>
        <p className="text-muted-foreground">
          Veja quem está liderando o bolão da Copa do Mundo 2026
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Tabela de Liderança
          </CardTitle>
          <CardDescription>
            Classificação por pontos totais e placares exatos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum participante no ranking ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Posição</TableHead>
                  <TableHead>Participante</TableHead>
                  <TableHead className="text-center">Pontos</TableHead>
                  <TableHead className="text-center">Placares Exatos</TableHead>
                  <TableHead className="text-center">Taxa de Acerto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((profile, index) => {
                  const rank = index + 1
                  const accuracy = profile.total_points > 0
                    ? ((profile.exact_scores / profile.total_points) * 100).toFixed(1)
                    : '0'

                  return (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getRankIcon(rank)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {getRankBadge(rank)}
                          </div>
                          <div>
                            <div className="font-medium">{profile.name}</div>
                            {profile.is_admin && (
                              <Badge variant="outline" className="text-xs mt-1">
                                Admin
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-2xl font-bold text-primary">
                          {profile.total_points}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{profile.exact_scores}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-muted-foreground">{accuracy}%</span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total de Participantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{leaderboard.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Maior Pontuação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {leaderboard.length > 0 ? leaderboard[0].total_points : 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Mais Placares Exatos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {leaderboard.length > 0
                ? Math.max(...leaderboard.map(p => p.exact_scores))
                : 0}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
