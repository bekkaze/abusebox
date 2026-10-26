import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../services/auth/authProvider";
import { loginUser } from "../services/auth/authService";
import { Alert, Spinner, cardClass, inputClass, primaryButtonClass } from "../components/shared/ui";

const labelClass = "block text-sm font-medium text-ink mb-1.5";

const Login = () => {
  const id = useId();
  const { setToken } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setDetail("Enter your username and password.");
      return;
    }
    setLoading(true);
    setDetail("");

    try {
      const response = await loginUser(username.trim(), password);
      if (response.data.access) {
        setToken(response.data.access, response.data.refresh);
        navigate("/dashboard/", { replace: true });
      } else {
        setDetail("Login failed: Access token not found in response.");
      }
    } catch (error) {
      setDetail("Login failed. Check your username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <img src="/logo.png" alt="" className="h-9 w-9 rounded-md object-cover" />
          <span className="text-xl font-semibold tracking-tight text-ink">AbuseBox</span>
        </div>

        <form className={`${cardClass} p-6`} onSubmit={handleLogin} noValidate>
          <h1 className="text-base font-semibold text-ink">Sign in</h1>

          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor={`${id}-username`} className={labelClass}>Username</label>
              <input
                id={`${id}-username`}
                className={inputClass}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="off"
                spellCheck="false"
                aria-invalid={Boolean(detail)}
              />
            </div>

            <div>
              <label htmlFor={`${id}-password`} className={labelClass}>Password</label>
              <input
                id={`${id}-password`}
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-invalid={Boolean(detail)}
              />
            </div>
          </div>

          {detail ? <Alert tone="error" className="mt-4">{detail}</Alert> : null}

          <button
            type="submit"
            className={`${primaryButtonClass} w-full mt-5`}
            disabled={loading}
          >
            {loading && <Spinner />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-2">
          New install? The default sign-in is <span className="font-mono text-ink">admin</span> / <span className="font-mono text-ink">password123</span>. Change it in Settings after you sign in.
        </p>
      </div>
    </main>
  );
};

export default Login;
