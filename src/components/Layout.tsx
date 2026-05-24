import { Outlet, Link, useLocation } from 'react-router-dom'
import { Trophy, Home, Users, Target, LayoutDashboard, LogOut, Shield } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from './ui/button'

export default function Layout() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()

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
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center space-x-2">
                <Trophy className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold">Bolão Copa 2026</span>
              </Link>
              <div className="flex space-x-4">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.path
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
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
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {profile?.name || user?.email}
              </span>
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
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
