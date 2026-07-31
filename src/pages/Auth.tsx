{/*  import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Trophy, AlertOctagon } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  // NOVO: Estado para guardar os dados do castigo
  const [blockData, setBlockData] = useState<{ message: string; image?: string } | null>(null)
  
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        await signIn(email, password)

        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('block_message, block_image')
            .eq('id', user.id)
            .single()

          // Se tiver mensagem de bloqueio, ativa a Tela de Castigo
          if (profile?.block_message) {
            // Chuta ele pra fora na mesma hora
            await supabase.auth.signOut()
            
            // Mostra o card de bloqueio com os dados do banco
            setBlockData({
              message: profile.block_message,
              image: profile.block_image
            })
            
            setLoading(false)
            return
          }
        }
      } else {
        await signUp(email, password, name)
      }
      
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao processar sua solicitação')
    } finally {
      setLoading(false)
    }
  }

  // SE ELE ESTIVER BLOQUEADO, RENDERIZA A TELA DO CASTIGO
  if (blockData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.3)] animate-in zoom-in duration-300">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-2">
              <AlertOctagon className="h-16 w-16 text-red-500 animate-pulse" />
            </div>
            <CardTitle className="text-3xl font-black text-red-600 uppercase tracking-wider">
              Acesso Suspenso
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 text-center pt-4">
            
            {/* Se você colocou o link de uma imagem no banco, ela aparece aqui! 
            {blockData.image && (
              <div className="w-full rounded-xl overflow-hidden border-2 border-red-500/30">
                <img 
                  src={blockData.image} 
                  alt="Meme de Castigo" 
                  className="w-full h-auto object-cover"
                />
              </div>
            )}
            
            <p className="font-bold text-lg text-foreground/90 bg-muted/50 p-4 rounded-lg border">
              {blockData.message}
            </p>
            
            <Button 
              variant="destructive" 
              className="w-full font-bold"
              onClick={() => setBlockData(null)}
            >
              Voltar e Refletir
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // SE NÃO ESTIVER BLOQUEADO, MOSTRA O FORMULÁRIO DE LOGIN NORMAL
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Trophy className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Bolão Copa 2026</CardTitle>
          <CardDescription>
            {isLogin ? 'Entre para fazer seus palpites' : 'Crie sua conta para participar'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ... Todo o resto do seu formulário continua igualzinho ... 
            {!isLogin && (
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">Nome</label>
                <Input id="name" type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required={!isLogin} />
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Senha</label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-primary hover:underline">
              {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
  */}


  export default function Manutencao() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-800">Em manutenção. Voltamos em breve!</h1>
    </main>
  );
}