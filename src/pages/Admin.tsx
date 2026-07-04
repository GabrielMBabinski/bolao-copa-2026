import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, User, ArrowLeft, CheckCircle2, XCircle, Target, MinusCircle } from 'lucide-react'

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

  // Carrega todos os usuários ao abrir a tela
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
  }, [])

  // Carrega os palpites do usuário selecionado
  useEffect(() => {
    async function loadPredictions() {
      if (!selectedUser) return
      setLoadingPredictions(true)
      try {
        const { data, error } = await supabase
          .from('predictions')
          .select(`
            id, points_earned, home_score, away_score,
            match:matches(
              id, home_score, away_score, status, match_date,
              home_team:teams!matches_home_team_id_fkey(name, flag_code),
              away_team:teams!matches_away_team_id_fkey(name, flag_code)
            )
          `)
          .eq('user_id', selectedUser.id)
          .eq('match.status', 'finished') // Traz apenas jogos finalizados
        
        if (error) throw error
        
        // Filtra nulos caso o inner join com matches falhe em algum registro
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

  const filteredPredictions = userPredictions.filter(p => 
    pointFilter === 'all' ? true : p.points_earned === pointFilter
  )

  const getPointsIcon = (points: number) => {
    if (points >= 5) return <Target className="w-5 h-5 text-green-500" />
    if (points === 3) return <CheckCircle2 className="w-5 h-5 text-blue-500" />
    if (points === 1) return <MinusCircle className="w-5 h-5 text-yellow-500" />
    return <XCircle className="w-5 h-5 text-red-500" />
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
        <p className="text-muted-foreground">
          Selecione um usuário para visualizar o detalhamento de seus acertos e erros.
        </p>
      </div>

      {!selectedUser ? (
        // TELA 1: LISTA DE USUÁRIOS
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
        // TELA 2: DETALHES DO USUÁRIO
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setSelectedUser(null)} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para a lista
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-6 h-6" /> Desempenho: {selectedUser.name}
              </CardTitle>
              <CardDescription>Filtre os palpites por pontuação recebida.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros de Pontuação */}
              <div className="flex flex-wrap gap-2 mb-6 p-4 bg-muted/30 rounded-lg">
                <Button variant={pointFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setPointFilter('all')}>
                  Todos
                </Button>
                <Button variant={pointFilter === 5 ? 'default' : 'outline'} size="sm" onClick={() => setPointFilter(5)} className="text-green-500">
                  <Target className="w-4 h-4 mr-1" /> Placar Exato (5)
                </Button>
                <Button variant={pointFilter === 3 ? 'default' : 'outline'} size="sm" onClick={() => setPointFilter(3)} className="text-blue-500">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Saldo/Empate (3)
                </Button>
                <Button variant={pointFilter === 1 ? 'default' : 'outline'} size="sm" onClick={() => setPointFilter(1)} className="text-yellow-500">
                  <MinusCircle className="w-4 h-4 mr-1" /> Vencedor (1)
                </Button>
                <Button variant={pointFilter === 0 ? 'default' : 'outline'} size="sm" onClick={() => setPointFilter(0)} className="text-red-500">
                  <XCircle className="w-4 h-4 mr-1" /> Erros (0)
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