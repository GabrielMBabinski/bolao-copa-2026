import { useEffect, useState, useRef } from 'react'
import useSWR, { mutate } from 'swr' // <-- Novo import aqui
import { useAuth } from '@/hooks/useAuth'
import { matches, profiles, supabase } from '@/lib/supabaseClient'
import type { MatchWithTeams } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Trophy, BadgeDollarSign, CheckCircle2, ChevronDown, XCircle, TrendingUp, FileText } from 'lucide-react'
import TeamFlag from '@/components/TeamFlag'
import UserAvatar from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'

// FUNÇÃO QUE BUSCA TUDO DE UMA VEZ
// FUNÇÃO QUE BUSCA TUDO DE UMA VEZ
const fetchDashboardData = async () => {
  const [up, fin, users, teamsRes, knockoutsRes] = await Promise.all([
    matches.getUpcoming(3),
    matches.getFinished(5),
    profiles.getAllProfiles(),
    // Busca todos os times ordenados pelo Elo
    supabase.from('teams').select('id, name, flag_code, elo_rating').order('elo_rating', { ascending: false }),
    // Busca apenas jogos finalizados do mata-mata
    supabase.from('matches').select('home_team_id, away_team_id, home_score, away_score, penalty_winner')
      .in('phase', ['round_32', 'round_16', 'quarter', 'semi', 'final'])
      .eq('status', 'finished')
  ])

  // Lógica para encontrar quem já foi eliminado
  const knockouts = knockoutsRes.data || []
  const eliminatedIds = new Set()

  knockouts.forEach(match => {
    // Se o time da casa ganhou, o visitante está eliminado (e vice-versa)
    if (match.home_score > match.away_score) eliminatedIds.add(match.away_team_id)
    else if (match.home_score < match.away_score) eliminatedIds.add(match.home_team_id)
    else {
      // Se empatou, verifica quem venceu nos pênaltis
      if (match.penalty_winner === 'home') eliminatedIds.add(match.away_team_id)
      if (match.penalty_winner === 'away') eliminatedIds.add(match.home_team_id)
    }
  })

  // Filtra as seleções removendo as eliminadas e pega apenas as 5 melhores
  const allTeams = teamsRes.data || []
  const activeTopTeams = allTeams.filter(t => !eliminatedIds.has(t.id)).slice(0, 5)

  return {
    upcoming: up.data || [],
    finished: fin.data || [],
    users: users.data || [],
    topTeams: activeTopTeams // Novo dado retornado!
  }
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [isPaymentVisible, setIsPaymentVisible] = useState(false)
  const paymentSectionRef = useRef<HTMLDivElement>(null)

  const [showPoster, setShowPoster] = useState(true)

  const [requestStatus, setRequestStatus] = useState<'idle' | 'loading' | 'pending' | 'resolved' | 'success'>('loading')

  useEffect(() => {
    async function checkPendingRequest() {
      if (!profile?.id) return
      const { data } = await supabase
        .from('support_requests')
        .select('status')
        .eq('user_id', profile.id)
        .maybeSingle()

      // Se achou um pedido, define se está pendente ou se o admin já resolveu (aprovou)
      if (data) {
        setRequestStatus(data.status === 'pending' ? 'pending' : 'resolved')
      } else {
        setRequestStatus('idle')
      }
    }
    checkPendingRequest()
  }, [profile])

  const handleRequestReport = async () => {
    if (!profile?.id) return
    setRequestStatus('loading')
    try {
      const { error } = await supabase
        .from('support_requests')
        .insert([{ user_id: profile.id }])

      if (error) throw error
      setRequestStatus('success')
      setTimeout(() => setRequestStatus('pending'), 2000)
    } catch (error: any) {
      if (error.code === '23505') {
        setRequestStatus('pending')
      } else {
        alert('Erro ao solicitar relatório. Tente novamente.')
        setRequestStatus('idle')
      }
    }
  }

  // NOVA FUNÇÃO: O próprio usuário baixa o CSV dele!
  const handleDownloadMyReport = async () => {
    if (!profile?.id) return

    // 1. Busca os palpites finalizados do próprio usuário
    const { data, error } = await supabase
      .from('predictions')
      .select(`
        points_earned, home_score, away_score, penalty_winner,
        match:matches(
          home_score, away_score, match_date,
          home_team:teams!matches_home_team_id_fkey(name),
          away_team:teams!matches_away_team_id_fkey(name)
        )
      `)
      .eq('user_id', profile.id)
      .eq('match.status', 'finished')

    if (error || !data) {
      alert('Erro ao gerar relatório.')
      return
    }

    // --- CÁLCULO DAS ESTATÍSTICAS ---
    const stats = {
      all: data.length,
      exact: data.filter(p => p.points_earned === 5).length,
      saldo: data.filter(p => p.points_earned === 3).length,
      vencedor: data.filter(p => p.points_earned === 1).length,
      erros: data.filter(p => p.points_earned === 0).length,
    }

    // 2. Monta o arquivo CSV
    let csvContent = "Data,Partida,Placar Oficial,Seu Palpite,Pontos Ganhos\n"

    data.forEach((pred: any) => {
      if (!pred.match || !pred.match.home_team) return

      const date = new Date(pred.match.match_date).toLocaleDateString('pt-BR')
      const matchStr = `${pred.match.home_team.name} vs ${pred.match.away_team.name}`
      const officialScore = `'${pred.match.home_score} x ${pred.match.away_score}`
      const userScore = `'${pred.home_score} x ${pred.away_score}`

      // Lógica de Pênaltis
      const pWinner = pred.penalty_winner;
      const penaltyName = pWinner === 'home' ? pred.match.home_team.name : pWinner === 'away' ? pred.match.away_team.name : null;
      const penaltyInfo = penaltyName ? ` (Pênaltis: ${penaltyName})` : ""

      csvContent += `"${date}","${matchStr}",${officialScore},${userScore}${penaltyInfo},${pred.points_earned}\n`
    })

    // 3. Adiciona o Resumo no final do arquivo
    csvContent += `\n"RESUMO DE DESEMPENHO"\n"Placar Exato (5 pts)",${stats.exact}\n"Saldo/Empate (3 pts)",${stats.saldo}\n"Vencedor (1 pt)",${stats.vencedor}\n"Erros (0 pts)",${stats.erros}\n"Total de Palpites",${stats.all}\n`

    // 4. Download
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `${profile.name.replace(/\s+/g, '_')}_relatorio_bolao.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // 5. Deleta o pedido (Ticket de uso único)
    await supabase.from('support_requests').delete().eq('user_id', profile.id)
    setRequestStatus('idle')
  }

  // NOVO: Temporizador de 5 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPoster(false)
    }, 5000) // 5000 = 5 segundos

    return () => clearTimeout(timer)
  }, [])

  // ==========================================
  // O ESCUDO DE CACHE (SWR)
  // ==========================================
  const { data, isLoading } = useSWR('dashboard-data', fetchDashboardData, {
    dedupingInterval: 60000, // Proteção de 60 segundos (Não repete a requisição ao banco)
    revalidateOnFocus: false // Não recarrega só porque o usuário mudou de aba no navegador
  })

  // Distribuindo os dados protegidos para as variáveis que o seu HTML já usa
  const upcomingMatches = data?.upcoming || []
  const finishedMatches = data?.finished || []
  const allUsers = data?.users || []
  const topTeams = data?.topTeams || []
  const loading = isLoading

  useEffect(() => {
    const currentRef = paymentSectionRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsPaymentVisible(entry.isIntersecting),
      { threshold: 0.3 }
    );

    observer.observe(currentRef);
    return () => observer.unobserve(currentRef);
  }, [allUsers, profile]);

  // Funções auxiliares (MANTIDAS)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const getPhaseLabel = (phase: string) => {
    const labels: Record<string, string> = {
      group: 'Fase de Grupos', round_32: 'Dezesseis-avos',
      round_16: 'Oitavas de Final', quarter: 'Quartas de Final',
      semi: 'Semifinais', final: 'Final',
    }
    return labels[phase] || phase
  }

  // ATUALIZADO: Quando ele paga, nós avisamos o SWR para atualizar o Cache secretamente
  const handleNotifyPayment = async () => {
    if (!profile?.id) return;
    setPaymentLoading(true);

    await profiles.notifyPayment(profile.id);
    await mutate('dashboard-data'); // Força o SWR a buscar os novos dados do banco

    setPaymentLoading(false);
  }

  const scrollToPayment = () => {
    paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg animate-pulse">Carregando Dashboard...</div>
      </div>
    )
  }

  const totalPrize = allUsers.filter(u => u.payment_status === 'paid' && u.contributes_to_prize).length * 15
  const myProfile = allUsers.find((u: any) => u.id === profile?.id);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto relative">

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 truncate">Bem-vindo, {profile?.name}!</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Acompanhe as partidas, resultados e o prêmio acumulado
        </p>
      </div>

      <div className="relative w-full h-40 sm:h-64 md:h-80 rounded-2xl overflow-hidden mb-8 shadow-xl border border-muted group bg-black">

        {/* VÍDEO (Fica rodando no fundo) */}
        <video
          src="Neymar-4K.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105 pointer-events-none"
        />

        {/* CAPA (Some suavemente após 5 segundos) */}
        <img
          src="/neymar-banner.jpg"
          alt="Capa do Banner"
          className={`absolute inset-0 w-full h-full object-cover object-center transition-all duration-1000 ease-in-out z-10 pointer-events-none group-hover:scale-105 ${showPoster ? 'opacity-100' : 'opacity-0'
            }`}
        />

        {/* GRADIENTE (Para escurecer o fundo) - Agora com z-20 para ficar por cima de tudo */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-20 pointer-events-none"></div>

        {/* TEXTOS - Com z-30 para nunca serem cobertos */}
        <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8 z-30">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white drop-shadow-lg uppercase tracking-wider">
            Rumo ao Hexa!
          </h2>
          <p className="text-white/90 text-sm sm:text-base md:text-lg font-medium drop-shadow-md max-w-md mt-1 sm:mt-2">
            Faça seus palpites!
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">

        {/* CARD: AO VIVO & PRÓXIMAS (O seu card atual) */}
        <Card className="flex flex-col border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Calendar className="h-5 w-5 text-primary" /> Ao Vivo & Próximas
            </CardTitle>
            <CardDescription>Partidas rolando agora e dos próximos dias</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {upcomingMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                <Calendar className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma partida próxima</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingMatches.map((match) => {

                  // ==========================================
                  // A NOVA LÓGICA BLINDADA COM RELÓGIO
                  // ==========================================
                  const now = new Date();
                  const matchTime = new Date(match.match_date);
                  const status = match.status?.toLowerCase() || '';

                  // É "Ao Vivo" se a API disser explicitamente OU se estiver pendente mas a hora já passou
                  const isLive = ['in_progress', 'live', 'in_play'].includes(status) ||
                    (['pending', 'scheduled'].includes(status) && now >= matchTime);

                  return (
                    <div key={match.id} className={`flex flex-col p-3 border rounded-lg transition-colors ${isLive ? 'bg-red-500/5 border-red-500/20' : 'bg-card hover:bg-muted/30'}`}>
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

                        {isLive ? (
                          <div className="flex flex-col items-center mx-2">
                            <span className="text-lg sm:text-xl font-black text-red-500 tracking-widest bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20">
                              {match.home_score ?? 0} - {match.away_score ?? 0}
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
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Trophy className="h-5 w-5 text-primary" /> Últimos Resultados
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
        <Card className="flex flex-col border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-blue-500">
              <TrendingUp className="h-5 w-5" /> Termômetro da Copa
            </CardTitle>
            <CardDescription>Seleções ativas com maior Força (Elo)</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {topTeams.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                <TrendingUp className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">Calculando ranking...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topTeams.map((team, index) => (
                  <div key={team.id} className="flex items-center justify-between p-3 border rounded-lg bg-card/50 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`font-black w-4 text-center ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {index + 1}º
                      </span>
                      <div className="w-6 h-5 flex items-center justify-center rounded-[2px] overflow-hidden">
                        <TeamFlag flagCode={team.flag_code} />
                      </div>
                      <span className="font-bold text-sm truncate max-w-[120px]">{team.name}</span>
                    </div>
                    <Badge variant="outline" className="font-mono bg-background">
                      {Math.round(team.elo_rating || 1500)} pts
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-8">

        <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-amber-600/5 shadow-lg flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 rounded-full bg-yellow-500/20 blur-3xl pointer-events-none"></div>

          <CardHeader className="pb-2 border-b border-yellow-500/20">
            <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl text-yellow-600 font-black uppercase">
              <BadgeDollarSign className="h-6 w-6" /> Prêmio Acumulado
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex-1 flex flex-col justify-center relative z-10">
            <div className="flex flex-col items-center justify-center mb-6">
              <span className="text-5xl sm:text-7xl font-black text-yellow-600 drop-shadow-md">
                R$ {totalPrize.toFixed(2).replace('.', ',')}
              </span>
              <p className="text-muted-foreground mt-2 font-medium">Aposta: R$ 15,00 por participante</p>
            </div>

            {myProfile?.payment_status === 'unpaid' && (
              <div ref={paymentSectionRef} className="bg-card border rounded-xl p-4 sm:p-6 text-center space-y-4 shadow-inner mt-auto">
                <h3 className="font-bold text-lg">Valide sua participação!</h3>
                <p className="text-sm text-muted-foreground">Escaneie o QR Code ou use a chave PIX abaixo.</p>

                <div className="flex justify-center my-4">
                  <div className="w-40 h-40 bg-white p-2 rounded-lg border-2 border-dashed border-primary flex items-center justify-center overflow-hidden hover:scale-105 transition-transform">
                    <img src="/pix.png" alt="QR Code PIX R$ 15,00" className="w-full h-full object-contain" />
                  </div>
                </div>

                <div className="bg-muted p-3 rounded-md select-all font-mono text-xs sm:text-sm text-center border break-all">
                  00020126580014BR.GOV.BCB.PIX013663d9984d-bf80-49d3-a340-e6a925f9bca1520400005303986540515.005802BR5922Gabriel Mayer Babinski6009SAO PAULO62140510YkKPLsxjNc63046468
                </div>

                <button
                  onClick={handleNotifyPayment}
                  disabled={paymentLoading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 rounded-lg transition-all"
                >
                  {paymentLoading ? 'Avisando...' : 'Já fiz o PIX de R$ 15,00'}
                </button>
              </div>
            )}

            {myProfile?.payment_status === 'pending' && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center flex flex-col items-center mt-auto">
                <Clock className="h-12 w-12 text-amber-500 mb-2 animate-pulse" />
                <h3 className="font-bold text-amber-500 text-lg">Pagamento em Análise</h3>
                <p className="text-sm text-muted-foreground mt-1">O administrador está conferindo o seu PIX. Logo você estará no bolão oficial!</p>
              </div>
            )}

            {myProfile?.payment_status === 'paid' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center flex flex-col items-center mt-auto">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
                <h3 className="font-bold text-green-600 text-lg">Aposta Confirmada!</h3>
                <p className="text-sm text-muted-foreground mt-1">Boa sorte! Seus palpites estão valendo para o prêmio principal.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Status dos Participantes</CardTitle>
            <CardDescription>Quem já garantiu a vaga no bolão</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
              {allUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={user.name} url={user.avatar_url} />
                    <span className="font-medium text-sm sm:text-base truncate max-w-[120px] sm:max-w-[200px]">{user.name}</span>
                  </div>

                  {/* 👇 NOVA LÓGICA DE STATUS 👇 */}
                  {user.contributes_to_prize === false ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-500/10 px-2 py-1 rounded-md">
                      <XCircle className="h-4 w-4" /> Não Pago
                    </span>
                  ) : user.payment_status === 'paid' ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-500/10 px-2 py-1 rounded-md">
                      <CheckCircle2 className="h-4 w-4" /> Pago
                    </span>
                  ) : user.payment_status === 'pending' ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-500/10 px-2 py-1 rounded-md">
                      <Clock className="h-4 w-4" /> Pendente
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      Aguardando
                    </span>
                  )}

                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Central de Suporte & Relatórios
            </CardTitle>
            <CardDescription>Deseja uma cópia em planilha da sua auditoria de palpites?</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between bg-muted/20 p-4 rounded-lg mt-4 mx-6 mb-6">
            <p className="text-sm text-muted-foreground w-2/3">
              {requestStatus === 'resolved'
                ? 'Sua solicitação foi aprovada! Você já pode baixar a sua planilha atualizada com os seus resultados.'
                : 'Ao solicitar, o administrador será notificado e liberará o download de um arquivo CSV contendo seu histórico.'}
            </p>

            {/* O BOTÃO INTELIGENTE */}
            {requestStatus === 'resolved' ? (
              <Button
                onClick={handleDownloadMyReport}
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                <FileText className="w-4 h-4" /> Baixar Relatório
              </Button>
            ) : (
              <Button
                onClick={handleRequestReport}
                disabled={requestStatus === 'pending' || requestStatus === 'loading' || requestStatus === 'success'}
                variant={requestStatus === 'pending' ? 'secondary' : 'default'}
              >
                {requestStatus === 'loading' && 'Processando...'}
                {requestStatus === 'idle' && 'Solicitar Liberação'}
                {requestStatus === 'success' && <><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> Solicitado!</>}
                {requestStatus === 'pending' && 'Liberação em Análise'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {myProfile?.payment_status === 'unpaid' && (
        <button
          onClick={scrollToPayment}
          className={`fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 flex items-center gap-2 bg-yellow-500 text-white px-5 py-3 sm:px-6 sm:py-4 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-all duration-500 group ${isPaymentVisible
            ? 'opacity-0 translate-y-10 pointer-events-none'
            : 'opacity-100 translate-y-0 hover:bg-yellow-600 hover:scale-105 hover:-translate-y-1'
            }`}
        >
          <BadgeDollarSign className="h-5 w-5 sm:h-6 sm:w-6 animate-pulse" />
          <span className="font-black uppercase tracking-wide text-sm sm:text-base">Pagar Aposta</span>
          <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-y-1 transition-transform" />
        </button>
      )}

    </div>
  )
}