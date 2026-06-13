import { useEffect, useState } from 'react'
import { groups } from '@/lib/supabaseClient'
import type { GroupStanding } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
        <div className="text-lg animate-pulse">Carregando...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
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
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Classificação dos Grupos</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Acompanhe a tabela de classificação dos 12 grupos da Copa do Mundo 2026
        </p>
      </div>

      {/* A classe grid já está perfeitamente responsiva aqui! */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        {allStandings.map(({ group, data }) => {
          const safeData = data || []
          return (
            <Card key={group} className="overflow-hidden">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Users className="h-5 w-5 text-primary" />
                  Grupo {group}
                </CardTitle>
                <CardDescription>
                  {safeData.length} seleções
                </CardDescription>
              </CardHeader>
              
              {/* Diminuímos o padding horizontal (px-2) apenas no celular para caber mais tabela */}
              <CardContent className="px-2 sm:px-6">
                {safeData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    Nenhuma partida realizada ainda
                  </p>
                ) : (
                  /* A MÁGICA DA ROLAGEM ACONTECE NESTA DIV ABAIXO */
                  <div className="overflow-x-auto w-full pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <Table className="min-w-[450px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8 text-center text-xs sm:text-sm px-1 sm:px-4">#</TableHead>
                          <TableHead className="text-xs sm:text-sm">Seleção</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm px-1 sm:px-4">Pts</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm px-1 sm:px-4 text-muted-foreground">J</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm px-1 sm:px-4 text-muted-foreground">V</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm px-1 sm:px-4 text-muted-foreground">E</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm px-1 sm:px-4 text-muted-foreground">D</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm px-1 sm:px-4">SG</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {safeData.map((standing, index) => (
                          <TableRow key={standing.team_id}>
                            <TableCell className="font-medium text-center px-1 sm:px-4">
                              {index + 1}
                            </TableCell>
                            <TableCell className="px-1 sm:px-4">
                              <div className="flex items-center gap-2">
                                <TeamFlag flagCode={standing.flag_code} />
                                <span className="font-medium text-sm truncate max-w-[100px] sm:max-w-none">{standing.team_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-bold text-primary px-1 sm:px-4">
                              {standing.points}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground px-1 sm:px-4">{standing.played}</TableCell>
                            <TableCell className="text-center text-muted-foreground px-1 sm:px-4">{standing.won}</TableCell>
                            <TableCell className="text-center text-muted-foreground px-1 sm:px-4">{standing.drawn}</TableCell>
                            <TableCell className="text-center text-muted-foreground px-1 sm:px-4">{standing.lost}</TableCell>
                            <TableCell className="text-center font-medium px-1 sm:px-4">
                              {standing.goal_diff > 0 ? '+' : ''}{standing.goal_diff}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}