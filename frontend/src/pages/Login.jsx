import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiLockClosed, HiUser } from "react-icons/hi";

import { useAuth } from "../services/auth/authProvider";
import { loginUser } from "../services/auth/authService";
import loginImg from "../assets/login.jpg";

const Login = () => {
  const { setToken } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
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
    <div className='min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-slate-950'>
      <div className='relative hidden lg:block'>
        <img className='w-full h-full object-cover opacity-80' src={loginImg} alt='Security monitoring' />
        <div className='absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent' />
        <div className='absolute bottom-10 left-10 right-10 text-white'>
          <p className='text-cyan-300 text-sm font-semibold tracking-wide'>ABUSEBOX</p>
          <h1 className='text-4xl font-bold mt-3 leading-tight'>Stay ahead of blacklist incidents with fast response workflows.</h1>
        </div>
      </div>

      <div className='flex items-center justify-center px-6 py-12'>
        <form className='w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-black/30' onSubmit={handleLogin}>
          <p className='text-slate-400 text-sm'>Welcome back</p>
          <h2 className='text-white text-3xl font-bold mt-1'>Sign in to AbuseBox</h2>

          <div className='mt-7 space-y-4'>
            <label className='block'>
              <span className='text-slate-300 text-sm'>Username</span>
              <div className='mt-2 relative'>
                <HiUser className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-500' />
                <input
                  className='w-full rounded-xl bg-slate-800 border border-slate-700 pl-10 pr-3 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500'
                  placeholder='admin'
                  type='text'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete='username'
                />
              </div>
            </label>

            <label className='block'>
              <span className='text-slate-300 text-sm'>Password</span>
              <div className='mt-2 relative'>
                <HiLockClosed className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-500' />
                <input
                  className='w-full rounded-xl bg-slate-800 border border-slate-700 pl-10 pr-3 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500'
                  placeholder='••••••••'
                  type='password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete='current-password'
                />
              </div>
            </label>
          </div>

          <button
            className='w-full mt-7 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 text-slate-950 font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity'
            disabled={loading || !username.trim() || !password}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          {detail ? <p className='text-red-400 text-sm mt-4'>{detail}</p> : null}

          <div className='mt-6 rounded-xl border border-slate-800 bg-slate-800/50 p-3'>
            <p className='text-xs text-slate-400'>Local default credentials</p>
            <p className='text-sm text-slate-200 mt-1'><span className='font-semibold'>admin</span> / <span className='font-semibold'>password123</span></p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
