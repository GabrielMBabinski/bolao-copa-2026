import { useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Camera, Loader2 } from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'

export default function Profile() {
  const { user, profile } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Você deve selecionar uma imagem para fazer upload.')
      }

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      // Cria um nome de arquivo único para não sobrescrever acidentalmente
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      // 1. Faz o upload da imagem para o bucket "avatars"
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // 2. Pega a URL pública da imagem recém-enviada
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // 3. Atualiza a tabela profiles com a nova URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user?.id)

      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      alert('Foto de perfil atualizada com sucesso!')
      
      // Opcional: Recarregar a página para forçar a atualização do avatar na Navbar
      window.location.reload()

    } catch (error: any) {
      console.error('Erro no upload:', error.message)
      alert('Erro ao atualizar a foto. Tente uma imagem menor.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Meu Perfil</h1>
        <p className="text-muted-foreground">Personalize a sua foto para o ranking.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Foto de Perfil</CardTitle>
          <CardDescription>
            Escolha uma imagem para ser exibida ao lado do seu nome.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 py-6">
          <div className="relative group">
            <UserAvatar 
              name={profile?.name || 'User'} 
              url={avatarUrl} 
              className="w-32 h-32 text-4xl shadow-md border-4 border-muted" 
            />
            
            {/* Máscara de hover e botão de trocar */}
            <div 
              className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              ) : (
                <>
                  <Camera className="h-8 w-8 text-white mb-1" />
                  <span className="text-white text-xs font-bold uppercase tracking-wider">Alterar</span>
                </>
              )}
            </div>
          </div>

          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png, image/jpeg, image/jpg, image/webp"
            className="hidden"
          />

          <Button 
            variant="outline" 
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Enviando imagem...' : 'Selecionar nova foto'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}