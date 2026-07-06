import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
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
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  // O LEÃO DE CHÁCARA: Roda toda vez que a página inicial é aberta
  useEffect(() => {
    const checkBannedStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('block_message')
          .eq('id', user.id)
          .single();

        // Se o leão de chácara ver que ele está bloqueado...
        if (profile?.block_message) {
          // 1. Rasga a credencial dele (desloga do navegador na hora)
          await supabase.auth.signOut();
          
          // 2. Chuta ele de volta pra porta de entrada
          navigate('/login'); // (ou window.location.href = '/login' se não tiver o navigate)
        }
      }
    };

    checkBannedStatus();
  }, []);

  // ... resto do código da sua Home ...

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

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
