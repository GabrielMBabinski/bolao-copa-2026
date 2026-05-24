import { useEffect, useState } from 'react'
import { groups } from '@/lib/supabaseClient'
import type { GroupStanding } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Users, AlertCircle } from 'lucide-react'
import TeamFlag from '@/components/TeamFlag'

export default function Groups() {
  const [allStandings, setAllStandings] = useState<Array<{ group: string; data: GroupStanding[] }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadStandings() {
      try {
        setLoading(true)
        setError(null)
        const standings = await groups.getAllStandings()
        if (isMounted) {
          setAllStandings(standings)
        }
      } catch (error: any) {
        console.error('Erro ao carregar classificações:', error)
        if (isMounted) {
          setError(error?.message || 'Erro ao carregar classificações. Verifique se o schema foi executado no banco de dados.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadStandings()

    return () => {
      isMounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <h3 className="font-medium">Erro ao carregar classificações</h3>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Classificação dos Grupos</h1>
        <p className="text-muted-foreground">
          Acompanhe a tabela de classificação dos 12 grupos da Copa do Mundo 2026
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {allStandings.map(({ group, data }) => {
          const safeData = data || []
          return (
            <Card key={group}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Grupo {group}
                </CardTitle>
                <CardDescription>
                  {safeData.length} seleções
                </CardDescription>
              </CardHeader>
              <CardContent>
                {safeData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhuma partida realizada ainda
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Seleção</TableHead>
                        <TableHead className="text-center">J</TableHead>
                        <TableHead className="text-center">V</TableHead>
                        <TableHead className="text-center">E</TableHead>
                        <TableHead className="text-center">D</TableHead>
                        <TableHead className="text-center">SG</TableHead>
                        <TableHead className="text-center">Pts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {safeData.map((standing, index) => (
                        <TableRow key={standing.team_id}>
                          <TableCell className="font-medium">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <TeamFlag flagCode={standing.flag_code} />
                              <span className="font-medium">{standing.team_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{standing.played}</TableCell>
                          <TableCell className="text-center">{standing.won}</TableCell>
                          <TableCell className="text-center">{standing.drawn}</TableCell>
                          <TableCell className="text-center">{standing.lost}</TableCell>
                          <TableCell className="text-center font-medium">
                            {standing.goal_diff > 0 ? '+' : ''}{standing.goal_diff}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {standing.points}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
