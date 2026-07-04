import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, User, ArrowLeft, CheckCircle2, XCircle, Target, MinusCircle, Download } from 'lucide-react'

// Tipagens para o novo painel
type Profile = {
  id: string
  name: string
  avatar_url?: string
}

type UserPrediction = {
  id: string
  points_earned: number
  home_score: number
  away_score: number
  match: {
    id: string
    home_team: { name: string; flag_code: string }
    away_team: { name: string; flag_code: string }
    home_score: number
    away_score: number
    status: string
    match_date: string
  }
}

export default function Admin() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [userPredictions, setUserPredictions] = useState<UserPrediction[]>([])
  const [loadingPredictions, setLoadingPredictions] = useState(false)
  const [pointFilter, setPointFilter] = useState<number | 'all'>('all')
  const [pendingRequests, setPendingRequests] = useState<any[]>([])

  useEffect(() => {
    async function loadUsers() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .order('name')

        if (error) throw error
        setUsers(data || [])
      } catch (error) {
        console.error('Erro ao carregar usuários:', error)
      } finally {
        setLoading(false)
      }
    }
    loadUsers()

    async function loadRequests() {
      const { data } = await supabase
        .from('support_requests')
        .select('id, user_id, profiles(name)')
        .eq('status', 'pending')
      setPendingRequests(data || [])
    }
    loadRequests()
  }, [])
  // Adicione esta função logo abaixo da loadUsers() e chame ela




  useEffect(() => {
    async function loadPredictions() {
      if (!selectedUser) return
      setLoadingPredictions(true)
      try {
        const { data, error } = await supabase
          .from('predictions')
          .select(`
            id, points_earned, home_score, away_score, penalty_winner,
            match:matches(
              id, home_score, away_score, status, match_date,
              home_team:teams!matches_home_team_id_fkey(name, flag_code),
              away_team:teams!matches_away_team_id_fkey(name, flag_code)
            )
          `)
          .eq('user_id', selectedUser.id)
          .eq('match.status', 'finished')

        if (error) throw error

        const validPredictions = (data as any[]).filter(p => p.match !== null)
        setUserPredictions(validPredictions)
      } catch (error) {
        console.error('Erro ao carregar palpites:', error)
      } finally {
        setLoadingPredictions(false)
      }
    }
    loadPredictions()
  }, [selectedUser])

  // Calcula a quantidade de cada tipo de acerto (Movi para cá para usar no CSV)
  const stats = {
    all: userPredictions.length,
    exact: userPredictions.filter(p => p.points_earned === 5).length,
    saldo: userPredictions.filter(p => p.points_earned === 3).length,
    vencedor: userPredictions.filter(p => p.points_earned === 1).length,
    erros: userPredictions.filter(p => p.points_earned === 0).length,
  }

  // Função para exportar os dados para CSV (Agora com Resumo)
  const exportToCSV = () => {
    if (!selectedUser || userPredictions.length === 0) return

    let csvContent = "Data,Partida,Placar Oficial,Palpite do Usuario,Pontos Ganhos\n"

    userPredictions.forEach(pred => {
      const date = new Date(pred.match.match_date).toLocaleDateString('pt-BR')
      const matchStr = `${pred.match.home_team.name} vs ${pred.match.away_team.name}`
      const officialScore = `'${pred.match.home_score} x ${pred.away_score}`
      const userScore = `'${pred.home_score} x ${pred.away_score}`
      
      // NOVA LÓGICA: Verifica se houve pênaltis no palpite
      // Nota: No Admin você usa 'pred' direto, verifique se seu objeto de predição possui o campo penalty_winner
      const penaltyInfo = (pred as any).penalty_winner ? ` (Pênaltis: ${(pred as any).penalty_winner})` : ""
      
      csvContent += `"${date}","${matchStr}",${officialScore},${userScore}${penaltyInfo},${pred.points_earned}\n`
    })

    // Adiciona o Resumo de Desempenho no final da planilha
    csvContent += `\n"RESUMO DE DESEMPENHO"\n`
    csvContent += `"Placar Exato (5 pts)",${stats.exact}\n`
    csvContent += `"Saldo/Empate (3 pts)",${stats.saldo}\n`
    csvContent += `"Vencedor (1 pt)",${stats.vencedor}\n`
    csvContent += `"Erros (0 pts)",${stats.erros}\n`
    csvContent += `"Total de Palpites",${stats.all}\n`

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `relatorio_bolao_${selectedUser.name.replace(/\s+/g, '_').toLowerCase()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtra o que vai aparecer na tela
  const filteredPredictions = userPredictions.filter(p =>
    pointFilter === 'all' ? true : p.points_earned === pointFilter
  )

  const getPointsIcon = (points: number) => {
    if (points >= 5) return <Target className="w-5 h-5 text-green-500" />
    if (points === 3) return <CheckCircle2 className="w-5 h-5 text-blue-500" />
    if (points === 1) return <MinusCircle className="w-5 h-5 text-yellow-500" />
    return <XCircle className="w-5 h-5 text-red-500" />
  }

  const resolveRequest = async (requestId: string) => {
    await supabase.from('support_requests').update({ status: 'resolved' }).eq('id', requestId)
    setPendingRequests(prev => prev.filter(req => req.id !== requestId))
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">Carregando painel...</div>
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Auditoria de Palpites
        </h1>
        {/* PAINEL DE NOTIFICAÇÕES (Só aparece se alguém pedir relatório) */}
        {!selectedUser && pendingRequests.length > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-lg animate-in fade-in">
            <h3 className="font-bold text-orange-500 flex items-center gap-2 mb-3">
              <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse"></span>
              Solicitações de Relatório Pendentes ({pendingRequests.length})
            </h3>
            <div className="flex flex-col gap-2">
              {pendingRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between bg-background p-3 rounded border">
                  <span className="text-sm font-medium">
                    O usuário <b className="text-primary">{req.profiles?.name}</b> solicitou um relatório.
                  </span>
                  <div className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      // Seleciona o usuário automaticamente para o admin poder baixar o CSV
                      const userToSelect = users.find(u => u.id === req.user_id)
                      if (userToSelect) setSelectedUser(userToSelect)
                    }}>
                      Ver Palpites
                    </Button>
                    <Button size="sm" onClick={() => resolveRequest(req.id)}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Marcar como Enviado
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-muted-foreground">
          Selecione um usuário para visualizar o detalhamento de seus acertos e erros.
        </p>
      </div>

      {!selectedUser ? (
        <Card>
          <CardHeader>
            <CardTitle>Participantes do Bolão</CardTitle>
            <CardDescription>Clique em um usuário para ver seu histórico de palpites.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map(user => (
              <Button
                key={user.id}
                variant="outline"
                className="h-auto p-4 flex items-center justify-start gap-4 hover:border-primary transition-all"
                onClick={() => setSelectedUser(user)}
              >
                <div className="bg-muted w-10 h-10 rounded-full flex items-center justify-center">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-bold">{user.name}</p>
                  <p className="text-xs text-muted-foreground">Ver detalhes</p>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setSelectedUser(null)} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para a lista
          </Button>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-6 h-6" /> Desempenho: {selectedUser.name}
                </CardTitle>
                <CardDescription className="mt-1">Filtre os palpites por pontuação recebida.</CardDescription>
              </div>
              <Button onClick={exportToCSV} disabled={loadingPredictions || userPredictions.length === 0} variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Baixar Relatório (CSV)
              </Button>
            </CardHeader>

            <CardContent>
              <div className="flex flex-wrap gap-2 mb-6 p-4 bg-muted/30 rounded-lg">
                <Button variant={pointFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setPointFilter('all')}>
                  Todos ({stats.all})
                </Button>
                <Button variant={pointFilter === 5 ? 'default' : 'outline'} size="sm" onClick={() => setPointFilter(5)} className="text-green-500">
                  <Target className="w-4 h-4 mr-1" /> Placar Exato ({stats.exact})
                </Button>
                <Button variant={pointFilter === 3 ? 'default' : 'outline'} size="sm" onClick={() => setPointFilter(3)} className="text-blue-500">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Saldo/Empate ({stats.saldo})
                </Button>
                <Button variant={pointFilter === 1 ? 'default' : 'outline'} size="sm" onClick={() => setPointFilter(1)} className="text-yellow-500">
                  <MinusCircle className="w-4 h-4 mr-1" /> Vencedor ({stats.vencedor})
                </Button>
                <Button variant={pointFilter === 0 ? 'default' : 'outline'} size="sm" onClick={() => setPointFilter(0)} className="text-red-500">
                  <XCircle className="w-4 h-4 mr-1" /> Erros ({stats.erros})
                </Button>
              </div>

              {loadingPredictions ? (
                <p className="text-center py-8 text-muted-foreground">Buscando histórico...</p>
              ) : filteredPredictions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum palpite encontrado para este filtro.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPredictions.map(pred => (
                    <div key={pred.id} className="border rounded-lg p-4 flex items-center justify-between bg-card hover:bg-muted/10 transition-colors">
                      <div className="flex-1">
                        <div className="flex justify-between items-center text-sm mb-2">
                          <span className="font-semibold">{pred.match.home_team.name}</span>
                          <span className="text-muted-foreground px-2">vs</span>
                          <span className="font-semibold">{pred.match.away_team.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <Badge variant="outline" className="bg-slate-800 text-white border-transparent">
                            Oficial: {pred.match.home_score} x {pred.match.away_score}
                          </Badge>
                          <span className="font-medium text-muted-foreground">
                            Palpite: {pred.home_score} x {pred.away_score}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col items-center justify-center border-l pl-4 min-w-[80px]">
                        {getPointsIcon(pred.points_earned)}
                        <span className="font-bold mt-1 text-lg">{pred.points_earned}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
