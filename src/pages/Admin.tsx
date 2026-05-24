import { useEffect, useState } from 'react'
import { matches } from '@/lib/supabaseClient'
import type { MatchWithTeams } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, Save, Clock } from 'lucide-react'

export default function Admin() {
  const [allMatches, setAllMatches] = useState<MatchWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    async function loadMatches() {
      try {
        const { data } = await matches.getAll()
        setAllMatches(data || [])
      } catch (error) {
        console.error('Erro ao carregar partidas:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMatches()
  }, [])

  const handleUpdateMatch = async (
    matchId: string,
    homeScore: number,
    awayScore: number,
    status: 'pending' | 'in_progress' | 'finished'
  ) => {
    setSaving(matchId)
    try {
      const { error } = await matches.updateMatch(matchId, {
        home_score: homeScore,
        away_score: awayScore,
        status,
      })

      if (error) throw error

      // Reload data
      const { data } = await matches.getAll()
      setAllMatches(data || [])
    } catch (error) {
      console.error('Erro ao atualizar partida:', error)
      alert('Erro ao atualizar partida. Tente novamente.')
    } finally {
      setSaving(null)
    }
  }

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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      in_progress: 'default',
      finished: 'destructive',
    }
    const labels: Record<string, string> = {
      pending: 'Pendente',
      in_progress: 'Em Andamento',
      finished: 'Finalizada',
    }
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>
  }

  const MatchForm = ({ match }: { match: MatchWithTeams }) => {
    const [homeScore, setHomeScore] = useState<number>(match.home_score || 0)
    const [awayScore, setAwayScore] = useState<number>(match.away_score || 0)
    const [status, setStatus] = useState<'pending' | 'in_progress' | 'finished'>(
      match.status
    )

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      handleUpdateMatch(match.id, homeScore, awayScore, status)
    }

    return (
      <form onSubmit={handleSubmit} className="p-4 border rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <Badge variant="outline">{getPhaseLabel(match.phase)}</Badge>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatDate(match.match_date)}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="font-medium">{match.home_team.name}</span>
            <span className="text-muted-foreground">vs</span>
            <span className="font-medium">{match.away_team.name}</span>
          </div>
          {getStatusBadge(match.status)}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              max="20"
              value={homeScore}
              onChange={(e) => setHomeScore(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 text-center"
              disabled={match.status === 'finished'}
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              min="0"
              max="20"
              value={awayScore}
              onChange={(e) => setAwayScore(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 text-center"
              disabled={match.status === 'finished'}
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="pending">Pendente</option>
            <option value="in_progress">Em Andamento</option>
            <option value="finished">Finalizada</option>
          </select>

          <Button type="submit" size="sm" disabled={saving === match.id}>
            <Save className="h-4 w-4 mr-2" />
            {saving === match.id ? '...' : 'Salvar'}
          </Button>
        </div>
      </form>
    )
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
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Administração
        </h1>
        <p className="text-muted-foreground">
          Gerencie os placares e status das partidas da Copa do Mundo 2026
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Partidas</CardTitle>
          <CardDescription>
            Atualize os placares e status das partidas. Ao marcar como "Finalizada", os pontos serão calculados automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allMatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhuma partida encontrada</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allMatches.map((match) => (
                <MatchForm key={match.id} match={match} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
