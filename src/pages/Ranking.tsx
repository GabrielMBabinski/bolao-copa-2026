import useSWR from 'swr'
import { ranking, profiles } from '@/lib/supabaseClient'
import type { Profile } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award, BadgeDollarSign } from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'

// FUNÇÃO QUE BUSCA TUDO DE UMA VEZ
const fetchRankingData = async () => {
  const [rankingRes, profilesRes] = await Promise.all([
    ranking.getLeaderboard(),
    profiles.getAllProfiles()
  ])
  return {
    leaderboard: rankingRes.data || [],
    allUsers: profilesRes.data || []
  }
}

export default function Ranking() {
  // ==========================================
  // O ESCUDO DE CACHE (SWR) PARA O RANKING
  // ==========================================
  const { data, isLoading } = useSWR('ranking-data', fetchRankingData, {
    dedupingInterval: 60000, // Proteção de 60 segundos
    revalidateOnFocus: false // Evita recarregar ao mudar de aba
  })

  // Extraindo os dados do cache
  const leaderboard = data?.leaderboard || []
  const allUsers = data?.allUsers || []

  // Calcula o prêmio baseado em quem está com status 'paid' E contribui para o prêmio
  const totalPrize = allUsers.filter((u: any) => u.payment_status === 'paid' && u.contributes_to_prize).length * 15

  // ==========================================
  // REGRA DO VERDADEIRO VENCEDOR (ELEGÍVEL)
  // Descobre quem é o 1º colocado que realmente pagou oficialmente
  // ==========================================
  const eligibleWinner = leaderboard.find((profile: any) => {
    const userDetails = allUsers.find((u: any) => u.id === profile.id)
    return userDetails?.payment_status === 'paid' && userDetails?.contributes_to_prize
  })

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg animate-pulse">Carregando Ranking...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Ranking Oficial</h1>
        <p className="text-muted-foreground">
          Veja quem está liderando o bolão da Copa do Mundo 2026
        </p>
      </div>

      {/* BANNER DO PRÊMIO ACUMULADO */}
      {totalPrize > 0 && (
        <div className="bg-gradient-to-r from-yellow-500/20 via-amber-500/10 to-transparent border border-yellow-500/30 rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-yellow-500/20 p-3 rounded-full shrink-0">
              <BadgeDollarSign className="h-8 w-8 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-yellow-600/80 uppercase tracking-wider mb-1">
                Prêmio Acumulado
              </p>
              <p className="text-3xl sm:text-4xl font-black text-yellow-600 leading-none">
                R$ {totalPrize.toFixed(2).replace('.', ',')}
              </p>
            </div>
          </div>
          {/*<div className="bg-yellow-500 text-white font-black px-4 py-2 rounded-lg text-sm sm:text-base uppercase tracking-wide shadow-md transform -rotate-2">
            O 1º Lugar leva tudo!
          </div>*/}
        </div>
      )}

      <Card className="border-t-4 border-t-primary shadow-md">
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-16">Posição</TableHead>
                    <TableHead>Participante</TableHead>
                    <TableHead className="text-center">Pontos</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Placares Exatos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((profile, index) => {
                    const rank = index + 1
                    const userDetails = allUsers.find((u: any) => u.id === profile.id)
                    const userPaymentStatus = userDetails?.payment_status
                    const userContributes = userDetails?.contributes_to_prize
                    return (
                      <TableRow
                        key={profile.id}
                        // Destaque amarelado na linha apenas para quem REALMENTE está a levar a grana
                        className={profile.id === eligibleWinner?.id ? 'bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors' : ''}
                      >
                        <TableCell>
                          <div className="flex items-center justify-center">
                            {getRankIcon(rank)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="w-8 flex justify-center">
                                {getRankBadge(rank)}
                              </div>
                              <UserAvatar
                                name={profile.name || 'UK'}
                                url={profile.avatar_url}
                                className="w-8 h-8 sm:w-10 sm:h-10 text-sm border-primary/30 shadow-sm"
                              />
                            </div>

                            <div className="flex flex-col items-start">
                              <div className="font-bold text-base flex flex-wrap items-center gap-2">
                                {profile.name}

                                {/* TAG DO PRÊMIO APENAS PARA O ELEGÍVEL 
                                {profile.id === eligibleWinner?.id && totalPrize > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-yellow-700 bg-yellow-400 px-2 py-0.5 rounded-full uppercase shadow-sm">
                                    <BadgeDollarSign className="h-3 w-3" />
                                    Leva os R$ {totalPrize.toFixed(2).replace('.', ',')}
                                  </span>
                                )}*/}
                              </div>
                              <div className="flex gap-2 items-center mt-1">
                                {profile.is_admin && (
                                  <Badge variant="outline" className="text-[10px] h-4">Admin</Badge>
                                )}
                                {/* Badge de 'Aposta Paga' não precisa aparecer para o vencedor para não poluir, só para os demais elegíveis */}
                                {userPaymentStatus === 'paid' && userContributes && profile.id !== eligibleWinner?.id && (
                                  <span className="text-[10px] font-medium text-green-600 flex items-center gap-1">
                                    Aposta Paga
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-2xl font-black ${rank === 1 ? 'text-yellow-600' : 'text-primary'}`}>
                            {profile.total_points}
                          </span>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <span className="font-bold bg-muted px-2 py-1 rounded-md">{profile.exact_scores}</span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4 mt-6">
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-yellow-600">Prêmio Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-yellow-600">
              R$ {totalPrize.toFixed(2).replace('.', ',')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Participantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{leaderboard.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Maior Pontuação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-primary">
              {leaderboard.length > 0 ? leaderboard[0].total_points : 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Placares Exatos (Recorde)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-primary">
              {leaderboard.length > 0
                ? Math.max(...leaderboard.map((p: any) => p.exact_scores))
                : 0}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}