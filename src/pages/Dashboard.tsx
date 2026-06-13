import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { matches, profiles } from '@/lib/supabaseClient'
import type { MatchWithTeams } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Trophy, BadgeDollarSign, CheckCircle2, ChevronDown } from 'lucide-react'
import TeamFlag from '@/components/TeamFlag'

export default function Dashboard() {
  const { profile } = useAuth()
  const [upcomingMatches, setUpcomingMatches] = useState<MatchWithTeams[]>([])
  const [finishedMatches, setFinishedMatches] = useState<MatchWithTeams[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [paymentLoading, setPaymentLoading] = useState(false)
  
  // Novo estado para saber se a caixa do PIX está na tela
  const [isPaymentVisible, setIsPaymentVisible] = useState(false)
  
  // Âncora para a rolagem e observador
  const paymentSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: upcoming } = await matches.getUpcoming(3)
        const { data: finished } = await matches.getFinished(5)
        const { data: usersData } = await profiles.getAllProfiles()
        
        setUpcomingMatches(upcoming || [])
        setFinishedMatches(finished || [])
        setAllUsers(usersData || [])
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Efeito do "Radar" (Intersection Observer)
  useEffect(() => {
    const currentRef = paymentSectionRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Se pelo menos 30% da caixa do PIX aparecer na tela, esconde o botão
        setIsPaymentVisible(entry.isIntersecting);
      },
      { threshold: 0.3 } 
    );

    observer.observe(currentRef);

    return () => {
      observer.unobserve(currentRef);
    };
  }, [allUsers, profile]); // Re-executa quando os dados carregam

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

  const handleNotifyPayment = async () => {
    if (!profile?.id) return;
    setPaymentLoading(true);
    await profiles.notifyPayment(profile.id);
    
    const { data } = await profiles.getAllProfiles();
    if (data) setAllUsers(data);
    setPaymentLoading(false);
  }

  // Função que executa a rolagem centralizando o conteúdo
  const scrollToPayment = () => {
    paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg animate-pulse">Carregando...</div>
      </div>
    )
  }

  // Cálculos financeiros
  const totalPrize = allUsers.filter(u => u.payment_status === 'paid').length * 15;
  const myProfile = allUsers.find(u => u.id === profile?.id);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto relative">
      
      {/* CABEÇALHO */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 truncate">Bem-vindo, {profile?.name}!</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Acompanhe as partidas, resultados e o prêmio acumulado
        </p>
      </div>

      {/* BANNER */}
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

      {/* ÁREA DE JOGOS (Cards lado a lado) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CARD 1: AO VIVO E PRÓXIMAS */}
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

      {/* =========================================
          NOVA SEÇÃO FINANCEIRA: PRÊMIO E PAGAMENTO 
          ========================================= */}
      <div className="grid gap-6 lg:grid-cols-2 mt-8">
        
        {/* CARD DO PRÊMIO E QR CODE */}
        <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-amber-600/5 shadow-lg flex flex-col relative overflow-hidden">
          {/* Brilho de destaque sutil no card */}
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

            {/* SE O USUÁRIO AINDA NÃO PAGOU */}
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

            {/* SE O USUÁRIO CLICOU EM "JÁ PAGUEI" */}
            {myProfile?.payment_status === 'pending' && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center flex flex-col items-center mt-auto">
                <Clock className="h-12 w-12 text-amber-500 mb-2 animate-pulse" />
                <h3 className="font-bold text-amber-500 text-lg">Pagamento em Análise</h3>
                <p className="text-sm text-muted-foreground mt-1">O administrador está conferindo o seu PIX. Logo você estará no bolão oficial!</p>
              </div>
            )}

            {/* SE O ADMINISTRADOR VALIDOU O PAGAMENTO */}
            {myProfile?.payment_status === 'paid' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center flex flex-col items-center mt-auto">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
                <h3 className="font-bold text-green-600 text-lg">Aposta Confirmada!</h3>
                <p className="text-sm text-muted-foreground mt-1">Boa sorte! Seus palpites estão valendo para o prêmio principal.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CARD DA LISTA DE QUEM PAGOU COM BARRA DE ROLAGEM INVISÍVEL */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Status dos Participantes</CardTitle>
            <CardDescription>Quem já garantiu a vaga no bolão</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-3 max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {allUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm uppercase">
                      {user.name?.substring(0, 2) || 'UK'}
                    </div>
                    <span className="font-medium text-sm sm:text-base truncate max-w-[120px] sm:max-w-[200px]">{user.name}</span>
                  </div>
                  
                  {user.payment_status === 'paid' ? (
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
      </div>

      {/* BOTÃO FLUTUANTE (Com animação de sumiço ativada pelo Radar) */}
      {myProfile?.payment_status === 'unpaid' && (
        <button
          onClick={scrollToPayment}
          className={`fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 flex items-center gap-2 bg-yellow-500 text-white px-5 py-3 sm:px-6 sm:py-4 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-all duration-500 group ${
            isPaymentVisible 
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