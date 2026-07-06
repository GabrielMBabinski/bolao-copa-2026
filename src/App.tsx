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
  // Puxamos o profile do cache do seu hook (sem fazer nova requisição)
  const { user, loading, profile } = useAuth();
  const navigate = useNavigate();

  // O LEÃO DE CHÁCARA VIA SATÉLITE (Supabase Realtime)
  useEffect(() => {
    if (!user) return;

    // 1. Verifica se no cache ele já constava como bloqueado
    if (profile?.block_message) {
      supabase.auth.signOut().then(() => navigate('/auth'));
      return;
    }

    // 2. Fica escutando atualizações no banco sem gastar requisições
    const banListener = supabase
      .channel('ban-check')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', // Só escuta se algo for atualizado
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`, // Escuta APENAS o perfil dele, economizando memória
        },
        async (payload) => {
          // O Supabase enviou um sinal de que a linha dele foi alterada.
          // Tem mensagem de bloqueio na atualização?
          if (payload.new.block_message) {
            // Chuta ele pra fora EM TEMPO REAL
            await supabase.auth.signOut();
            navigate('/auth');
          }
        }
      )
      .subscribe();

    // Desliga o rádio se o usuário fechar a página
    return () => {
      supabase.removeChannel(banListener);
    };
  }, [user, profile, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  return <>{children}</>;
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