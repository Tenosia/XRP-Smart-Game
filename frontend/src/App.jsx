import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import IdeaDetail from './pages/IdeaDetail.jsx';
import CreateIdea from './pages/CreateIdea.jsx';
import Wallet from './pages/Wallet.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Admin from './pages/Admin.jsx';
import Whitepaper from './pages/Whitepaper.jsx';
import FAQ from './pages/FAQ.jsx';

function Protected({ children, admin }) {
  const { user, loading } = useAuth();
  if (loading)
    return <div className="flex min-h-[60vh] items-center justify-center text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

// Redirect legacy /markets links (idea detail kept; list → home).
function MarketRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/ideas/${id}` : '/'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/ideas/:id" element={<IdeaDetail />} />
        <Route path="/whitepaper" element={<Whitepaper />} />
        <Route path="/faq" element={<FAQ />} />
        {/* the ideas list now lives on the home page */}
        <Route path="/ideas" element={<Navigate to="/" replace />} />
        <Route path="/rankings" element={<Navigate to="/" replace />} />
        <Route path="/create" element={<Protected><CreateIdea /></Protected>} />
        <Route path="/wallet" element={<Protected><Wallet /></Protected>} />
        <Route path="/portfolio" element={<Protected><Portfolio /></Protected>} />
        <Route path="/admin" element={<Protected admin><Admin /></Protected>} />

        {/* legacy redirects */}
        <Route path="/markets" element={<MarketRedirect />} />
        <Route path="/markets/:id" element={<MarketRedirect />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
