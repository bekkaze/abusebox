import { Link } from 'react-router-dom';
import { useAuth } from '../services/auth/authProvider';

export default function NotFound() {
  const { token } = useAuth();
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Page not found</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">The page you asked for doesn&apos;t exist or has moved.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to={token ? '/dashboard' : '/'} className="inline-flex items-center h-11 px-5 rounded-lg font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-colors">
            {token ? 'Go to dashboard' : 'Go to home'}
          </Link>
          <Link to="/quick-check" className="inline-flex items-center h-11 px-5 rounded-lg font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Run a quick check
          </Link>
        </div>
      </div>
    </main>
  );
}
