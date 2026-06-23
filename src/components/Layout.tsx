import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Trophy, Home, Users, Target, LogOut, Shield, Sun, Moon, Menu, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from './ui/button'
import UserAvatar from '@/components/UserAvatar' 
import AnnoyingPaywall from '@/components/AnnoyingPaywall'
import FakeAds from '@/components/FakeAds'
import AudioPlayer from '@/components/AudioPlayer'
import { startAudioOnInteract } from '@/lib/audio' // <-- IMPORTAÇÃO DO ÁUDIO AQUI

export default function Layout() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // --- LÓGICA DO MODO ESCURO ---
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);
  // ------------------------------

  // --- ARMADILHA ANTI-HACKER (F12) ---
  useEffect(() => {
    if (import.meta.env.DEV) return; 

    const antiHackerTrap = setInterval(() => {
      const before = new Date().getTime()
      debugger; 
      const after = new Date().getTime()
      if (after - before > 100) {
        window.location.reload()
      }
    }, 1000)

    return () => clearInterval(antiHackerTrap)
  }, [])
  // -----------------------------------

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/grupos', label: 'Grupos', icon: Users },
    { path: '/palpites', label: 'Palpites', icon: Target },
    { path: '/ranking', label: 'Ranking', icon: Trophy },
  ]

  if (profile?.is_admin) {
    navItems.push({ path: '/admin', label: 'Admin', icon: Shield })
  }

  return (
    <div className="min-h-screen bg-background relative">
      <AnnoyingPaywall />
      <FakeAds />
      <nav className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            
            <Link to="/" onClick={startAudioOnInteract} className="flex items-center space-x-2">
              <Trophy className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold truncate">Bolão Copa 2026</span>
            </Link>

            {/* CENTRO: Links de Navegação (Desktop) */}
            <div className="hidden md:flex space-x-4">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={startAudioOnInteract} // <-- DISPARA O ÁUDIO AO CLICAR
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
            
            {/* LADO DIREITO: Tema, Usuário e Sair (Desktop) */}
            <div className="hidden md:flex items-center space-x-4">
              <button 
                onClick={() => setIsDark(!isDark)} 
                className="p-2 rounded-full hover:bg-muted transition-colors flex items-center justify-center"
                title="Alternar tema"
              >
                {isDark ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-foreground" />}
              </button>

              <Link 
                to="/profile"
                onClick={startAudioOnInteract}
                className="flex items-center space-x-2 bg-muted/40 hover:bg-muted/80 transition-colors pl-2 pr-3 py-1 rounded-full border border-border/40 cursor-pointer"
                title="Editar Perfil"
              >
                <UserAvatar name={profile?.name || user?.email} url={profile?.avatar_url} className="w-7 h-7 text-xs" />
                <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
                  {profile?.name || user?.email}
                </span>
              </Link>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </Button>
            </div>

            {/* BOTÃO HAMBÚRGUER + AVATAR RÁPIDO (Mobile) */}
            <div className="md:hidden flex items-center space-x-2">
              <button 
                onClick={() => setIsDark(!isDark)} 
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                {isDark ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-foreground" />}
              </button>

              <Link to="/profile" onClick={startAudioOnInteract}>
                <UserAvatar name={profile?.name || user?.email} url={profile?.avatar_url} className="w-7 h-7 text-xs mr-1 hover:opacity-80 transition-opacity" />
              </Link>

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-foreground hover:bg-muted rounded-md transition-colors"
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* MENU DROPDOWN DO CELULAR */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t bg-card px-4 py-4 space-y-3 shadow-lg">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      startAudioOnInteract(); // <-- DISPARA O ÁUDIO NO MOBILE
                    }}
                    className={`flex items-center space-x-2 px-3 py-3 rounded-md text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
            
            <div className="pt-4 border-t flex flex-col space-y-3">
              <Link 
                to="/profile" 
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  startAudioOnInteract();
                }}
                className="flex items-center space-x-3 px-3 py-2 rounded-md hover:bg-muted transition-colors cursor-pointer"
              >
                <UserAvatar name={profile?.name || user?.email} url={profile?.avatar_url} className="w-10 h-10 text-base" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-foreground truncate">
                    {profile?.name || 'Utilizador'}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    Editar foto de perfil
                  </span>
                </div>
              </Link>

              <Button
                variant="destructive"
                onClick={signOut}
                className="w-full flex items-center justify-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair da Conta</span>
              </Button>
            </div>
          </div>
        )}
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
      
      {/* O COMPONENTE DE ÁUDIO RENDERIZADO AQUI NO FINAL */}
      <AudioPlayer />
    </div>
  )
}