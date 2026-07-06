import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Groups from './pages/Groups'
import Predictions from './pages/Predictions'
import Ranking from './pages/Ranking'
import Admin from './pages/Admin'
import Profile from './pages/Profile'
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Puxamos o profile que já vem do seu hook
  const { user, loading, profile } = useAuth();
  const navigate = useNavigate();

  // O LEÃO DE CHÁCARA: Roda em TODAS as páginas protegidas
  useEffect(() => {
    const kickBannedUser = async () => {
      if (profile?.block_message) {
        // 1. Rasga a credencial dele (desloga do navegador na hora)
        await supabase.auth.signOut();
        
        // 2. Chuta ele de volta pra porta de entrada (sua rota é /auth)
        navigate('/auth'); 
      }
    };

    if (profile) {
      kickBannedUser();
    }
  }, [profile, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" />
  }

  // Enquanto o Leão de Chácara expulsa ele, não renderiza o site por baixo
  if (profile?.block_message) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-lg text-red-500 font-bold animate-pulse">
          Verificando permissões...
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" />
  }

  if (!profile?.is_admin) {
    return <Navigate to="/" />
  }

  return <>{children}</>
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="grupos" element={<Groups />} />
            <Route path="palpites" element={<Predictions />} />
            <Route path="ranking" element={<Ranking />} />
            <Route path="/profile" element={<Profile />} />
            <Route
              path="admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App