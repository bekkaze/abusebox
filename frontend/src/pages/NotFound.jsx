import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../services/auth/authProvider';
import { Field, Fields, primaryButtonClass, secondaryButtonClass } from '../components/shared/ui';

export default function NotFound() {
  const { token } = useAuth();
  const { pathname } = useLocation();
  return (
    <main className="min-h-screen flex items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-[1.75rem] leading-none font-semibold text-s4">404</span>
          <span className="text-2xl font-semibold tracking-tight text-ink">No such page</span>
        </h1>
        <Fields className="mt-4 pt-3 border-t border-rule">
          <Field name="Requested"><span className="font-mono text-[13px] break-all">{pathname}</span></Field>
          <Field name="Status">Not found. The page doesn&apos;t exist or has moved.</Field>
        </Fields>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to={token ? '/dashboard' : '/'} className={`${primaryButtonClass} hover:no-underline`}>
            {token ? 'Go to dashboard' : 'Go to home'}
          </Link>
          <Link to="/quick-check" className={`${secondaryButtonClass} hover:no-underline`}>
            Run a quick check
          </Link>
        </div>
      </div>
    </main>
  );
}
