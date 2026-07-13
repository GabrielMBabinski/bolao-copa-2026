import useSWR from 'swr'
import { ranking, profiles, supabase } from '@/lib/supabaseClient'
import type { Profile } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, Medal, Award, BadgeDollarSign, Users, TrendingUp } from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import TeamFlag from '@/components/TeamFlag'

// FUNÇÃO QUE BUSCA TUDO DE UMA VEZ
const fetchRankingData = async () => {
  const [rankingRes, profilesRes, teamsRes] = await Promise.all([
    ranking.getLeaderboard(),
    profiles.getAllProfiles(),

    // Busca do Ranking das Seleções (O banco faz o trabalho duro!)
    supabase
      .from('teams')
      .select('id, name, flag_code, elo_rating, is_eliminated')
      .order('is_eliminated', { ascending: true }) // Vivos primeiro
      .order('elo_rating', { ascending: false })   // Maior Elo primeiro
  ])
  return {
    leaderboard: rankingRes.data || [],
    allUsers: profilesRes.data || [],
    teams: teamsRes.data || []
  }
}

export default function Ranking() {
  const { data, isLoading } = useSWR('ranking-data', fetchRankingData, {
    dedupingInterval: 60000,
    revalidateOnFocus: false
  })

  // Extraindo os dados do cache
  const leaderboard = data?.leaderboard || []
  const allUsers = data?.allUsers || []
  const teams = data?.teams || []

  // Calcula o prêmio baseado em quem está com status 'paid' E contribui para o prêmio
  const totalPrize = allUsers.filter((u: any) => u.payment_status === 'paid' && u.contributes_to_prize).length * 15

  // REGRA DO VERDADEIRO VENCEDOR
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
    if (rank === 1) return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">1º</Badge>
    if (rank === 2) return <Badge className="bg-gray-400 hover:bg-gray-500 text-white">2º</Badge>
    if (rank === 3) return <Badge className="bg-amber-700 hover:bg-amber-800 text-white">3º</Badge>
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
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">Central de Rankings</h1>
        <p className="text-muted-foreground">
          Acompanhe a liderança do bolão e o Ranking das Seleções.
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        {/* BOTÕES DAS ABAS */}
        <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
          <TabsTrigger value="users" className="text-sm sm:text-base font-bold gap-2">
            <Users className="w-4 h-4" />
            Participantes
          </TabsTrigger>
          <TabsTrigger value="teams" className="text-sm sm:text-base font-bold gap-2">
            <TrendingUp className="w-4 h-4" />
            Seleções (Ranking)
          </TabsTrigger>
        </TabsList>

        {/* ==========================================
            ABA 1: RANKING DOS USUÁRIOS (SEU CÓDIGO)
            ========================================== */}
        <TabsContent value="users" className="space-y-6 animate-in fade-in">

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
              {/* Novo Bloco: Cota do Churrasco */}
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2 flex items-center gap-2 self-start sm:self-auto">
                <span className="w-3 h-3 bg-yellow-500 rounded-sm animate-pulse"></span>
                <p className="text-yellow-600 text-xs font-bold uppercase tracking-widest">
                  Valor será destinado ao vencedor!
                </p>
              </div>
            </div>
          )}

          <Card className="border-t-4 border-t-primary shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" /> Tabela de Liderança
              </CardTitle>
              <CardDescription>Classificação por pontos totais e placares exatos</CardDescription>
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
                        <TableHead className="w-16">Pos.</TableHead>
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
                          <TableRow key={profile.id} className={profile.id === eligibleWinner?.id ? 'bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors' : ''}>
                            <TableCell>
                              <div className="flex items-center justify-center">{getRankIcon(rank)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="w-8 flex justify-center">{getRankBadge(rank)}</div>
                                  <UserAvatar name={profile.name || 'UK'} url={profile.avatar_url} className="w-8 h-8 sm:w-10 sm:h-10 text-sm border-primary/30 shadow-sm" />
                                </div>
                                <div className="flex flex-col items-start">
                                  <div className="font-bold text-base flex flex-wrap items-center gap-2">{profile.name}</div>
                                  <div className="flex gap-2 items-center mt-1">
                                    {profile.is_admin && <Badge variant="outline" className="text-[10px] h-4">Admin</Badge>}
                                    {userPaymentStatus === 'paid' && userContributes && profile.id !== eligibleWinner?.id && (
                                      <span className="text-[10px] font-medium text-green-600 flex items-center gap-1">Aposta Paga</span>
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
        </TabsContent>

        {/* ==========================================
            ABA 2: RANKING DAS SELEÇÕES (NOVO)
            ========================================== */}
        <TabsContent value="teams" className="animate-in fade-in">
          <Card className="border-t-4 border-t-blue-500 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-500">
                <TrendingUp className="h-5 w-5" /> Ranking
              </CardTitle>
              <CardDescription>Força atualizada de cada seleção baseada em seus resultados na Copa.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16">Pos.</TableHead>
                      <TableHead>Seleção</TableHead>
                      <TableHead className="text-center">Pontuação Elo</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((team, index) => {
                      const rank = index + 1;
                      return (
                        <TableRow
                          key={team.id}
                          className={team.is_eliminated ? 'opacity-60 bg-muted/20 grayscale hover:grayscale-0 transition-all' : ''}
                        >
                          <TableCell>
                            <div className="flex items-center justify-center font-bold text-muted-foreground">
                              {rank}º
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-6 flex items-center justify-center rounded-[2px] overflow-hidden shadow-sm shrink-0">
                                <TeamFlag flagCode={team.flag_code} />
                              </div>
                              <span className={`font-bold ${team.is_eliminated ? 'text-muted-foreground' : ''}`}>
                                {team.name}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <Badge variant="outline" className={`font-mono text-sm ${team.is_eliminated ? 'bg-background' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                              {Math.round(team.elo_rating || 1500)}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right">
                            {team.is_eliminated ? (
                              <Badge variant="secondary" className="text-[10px] uppercase">Eliminada</Badge>
                            ) : (
                              <Badge className="bg-green-500 hover:bg-green-600 text-white text-[10px] uppercase">Na Disputa</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}