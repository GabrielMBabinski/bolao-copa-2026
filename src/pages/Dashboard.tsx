import { useEffect, useState, useRef } from 'react'
import useSWR, { mutate } from 'swr' // <-- Novo import aqui
import { useAuth } from '@/hooks/useAuth'
import { matches, profiles } from '@/lib/supabaseClient'
import type { MatchWithTeams } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Trophy, BadgeDollarSign, CheckCircle2, ChevronDown, XCircle, FileText } from 'lucide-react'
import TeamFlag from '@/components/TeamFlag'
import UserAvatar from '@/components/UserAvatar'

// FUNÇÃO QUE BUSCA TUDO DE UMA VEZ
const fetchDashboardData = async () => {
  const [up, fin, users] = await Promise.all([
    matches.getUpcoming(3),
    matches.getFinished(5),
    profiles.getAllProfiles()
  ])
  return {
    upcoming: up.data || [],
    finished: fin.data || [],
    users: users.data || []
  }
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [isPaymentVisible, setIsPaymentVisible] = useState(false)
  const paymentSectionRef = useRef<HTMLDivElement>(null)

  const [showPoster, setShowPoster] = useState(true)

  const [requestStatus, setRequestStatus] = useState<'idle' | 'loading' | 'pending' | 'success'>('loading')


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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Calendar className="h-5 w-5 text-primary" /> Ao Vivo & Próximas
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
              Ao solicitar, o administrador será notificado e enviará o arquivo CSV contendo todo o seu histórico detalhado.
            </p>
            <Button
              onClick={handleRequestReport}
              disabled={requestStatus === 'pending' || requestStatus === 'loading' || requestStatus === 'success'}
              variant={requestStatus === 'pending' ? 'secondary' : 'default'}
            >
              {requestStatus === 'loading' && 'Processando...'}
              {requestStatus === 'idle' && 'Solicitar Relatório'}
              {requestStatus === 'success' && <><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> Solicitado!</>}
              {requestStatus === 'pending' && 'Solicitação em Análise'}
            </Button>
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
  useEffect(() => {
    async function checkPendingRequest() {
      if (!user) return
      const { data } = await supabase
        .from('support_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single()

      setRequestStatus(data ? 'pending' : 'idle')
    }
    checkPendingRequest()
  }, [user])

  // Função para fazer o pedido
  const handleRequestReport = async () => {
    if (!user) return
    setRequestStatus('loading')
    try {
      const { error } = await supabase
        .from('support_requests')
        .insert([{ user_id: user.id }])

      if (error) throw error
      setRequestStatus('success')
      setTimeout(() => setRequestStatus('pending'), 2000)
    } catch (error: any) {
      // Se der erro de duplicate key (tentou burlar o anti-spam), volta pra pending
      if (error.code === '23505') {
        setRequestStatus('pending')
      } else {
        alert('Erro ao solicitar relatório. Tente novamente.')
        setRequestStatus('idle')
      }
    }
  }
}