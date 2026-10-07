import { Fragment, useCallback, useEffect, useId, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'react-toastify';
import { HiUserAdd } from 'react-icons/hi';
import { createUser, listUsers, updateUser } from '../../../services/users';
import { Alert, Spinner, cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '../../shared/ui';

function Modal({ open, onClose, title, description, children }) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={onClose}>
        <div className="min-h-screen px-4 text-center">
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <Dialog.Overlay className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm" />
          </Transition.Child>
          <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4" enterTo="opacity-100 translate-y-0" leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-4">
            <div className="inline-block w-full max-w-md p-6 my-8 text-left align-middle transition-all transform bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700">
              <Dialog.Title as="h2" className="text-xl font-semibold text-slate-900 dark:text-white">{title}</Dialog.Title>
              {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
              {children}
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

function AddUserDialog({ open, onClose, onCreated }) {
  const id = useId();
  const [form, setForm] = useState({ username: '', email: '', password: '', admin: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (saving) return;
    setForm({ username: '', email: '', password: '', admin: false });
    setError('');
    onClose();
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const user = await createUser({ username: form.username.trim(), email: form.email.trim(), password: form.password });
      if (form.admin) await updateUser(user.id, { is_superuser: true });
      toast.success(`Added ${user.username}`);
      onCreated();
      setForm({ username: '', email: '', password: '', admin: false });
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Check the fields and try again. Passwords need at least 8 characters.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Add user" description="Each user has their own assets. Admins can also change instance settings and manage users.">
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <div>
          <label htmlFor={`${id}-username`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Username</label>
          <input id={`${id}-username`} autoComplete="off" required value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
          <input id={`${id}-email`} type="email" autoComplete="off" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Alerts for this user&apos;s assets go here.</p>
        </div>
        <div>
          <label htmlFor={`${id}-password`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Temporary password</label>
          <input id={`${id}-password`} type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputClass} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">At least 8 characters. Ask them to change it in Settings.</p>
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={form.admin} onChange={(e) => setForm((f) => ({ ...f, admin: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 accent-cyan-600" />
          <span className="text-sm text-slate-700 dark:text-slate-300">Admin</span>
        </label>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={secondaryButtonClass} onClick={close} disabled={saving}>Cancel</button>
          <button type="submit" className={primaryButtonClass} disabled={saving || !form.username.trim() || !form.email.trim() || form.password.length < 8}>
            {saving && <Spinner />} Add user
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordDialog({ user, onClose }) {
  const id = useId();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateUser(user.id, { new_password: password });
      toast.success(`Password reset for ${user.username}. They were signed out.`);
      setPassword('');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not reset the password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={Boolean(user)} onClose={() => !saving && onClose()} title={`Reset password for ${user?.username || ''}`} description="They'll be signed out everywhere and need this password to sign in again.">
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <div>
          <label htmlFor={`${id}-password`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">New password</label>
          <input id={`${id}-password`} type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryButtonClass} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className={primaryButtonClass} disabled={saving || password.length < 8}>{saving && <Spinner />} Reset password</button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPanel({ currentUserId }) {
  const [users, setUsers] = useState(null);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    listUsers().then(setUsers).catch(() => {
      setUsers([]);
      toast.error('Could not load users.');
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const change = async (user, patch, message) => {
    setBusyId(user.id);
    try {
      await updateUser(user.id, patch);
      toast.success(message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not update the user.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className={`${cardClass} p-6 space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Users</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Public sign-up is disabled; add people here.</p>
        </div>
        <button type="button" className={primaryButtonClass} onClick={() => setAdding(true)}>
          <HiUserAdd aria-hidden="true" /> Add user
        </button>
      </div>

      {users === null ? (
        <div className="flex justify-center py-8" aria-busy="true"><Spinner className="h-5 w-5 text-cyan-600" /></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
          <table className="w-full min-w-[640px] text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-700/60 text-left">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">User</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">Role</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">Assets</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {users.map((user) => {
                const self = user.id === currentUserId;
                const busy = busyId === user.id;
                return (
                  <tr key={user.id} className={user.is_active ? '' : 'opacity-60'}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-white">{user.username}{self && <span className="ml-1.5 text-xs font-normal text-slate-500">(you)</span>}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex flex-wrap gap-1.5">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${user.is_superuser ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                          {user.is_superuser ? 'Admin' : 'User'}
                        </span>
                        {!user.is_active && <span className="rounded px-2 py-0.5 text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">Deactivated</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{user.asset_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm font-medium">
                        {busy && <Spinner className="h-4 w-4 text-cyan-600" />}
                        {!self && (
                          <button type="button" disabled={busy} className="text-cyan-700 dark:text-cyan-400 hover:underline disabled:opacity-50" onClick={() => change(user, { is_superuser: !user.is_superuser }, user.is_superuser ? `${user.username} is no longer an admin` : `${user.username} is now an admin`)}>
                            {user.is_superuser ? 'Remove admin' : 'Make admin'}
                          </button>
                        )}
                        <button type="button" disabled={busy} className="text-cyan-700 dark:text-cyan-400 hover:underline disabled:opacity-50" onClick={() => setResetting(user)}>
                          Reset password
                        </button>
                        {!self && (
                          <button type="button" disabled={busy} className={`${user.is_active ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'} hover:underline disabled:opacity-50`} onClick={() => change(user, { is_active: !user.is_active }, user.is_active ? `${user.username} deactivated and signed out` : `${user.username} reactivated`)}>
                            {user.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddUserDialog open={adding} onClose={() => setAdding(false)} onCreated={load} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
    </section>
  );
}
