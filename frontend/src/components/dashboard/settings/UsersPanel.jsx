import { Fragment, useCallback, useEffect, useId, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'react-toastify';
import { HiOutlineUserPlus } from 'react-icons/hi2';
import { createUser, listUsers, updateUser } from '../../../services/users';
import { SkeletonLine } from '../../shared/Skeleton';
import { Alert, EmptyState, Section, Spinner, inputClass, primaryButtonClass, secondaryButtonClass } from '../../shared/ui';

const labelClass = 'block text-sm font-medium text-ink mb-1.5';
const helpClass = 'mt-1.5 text-xs text-ink-2';
const thClass = 'px-3 py-2 font-mono text-xs font-normal text-ink-2 border-b border-rule text-left whitespace-nowrap';
const rowActionClass = 'font-medium hover:underline underline-offset-2 disabled:opacity-50 disabled:no-underline';

function Modal({ open, onClose, title, description, children }) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={onClose}>
        <div className="min-h-screen px-4 text-center">
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <Dialog.Overlay className="fixed inset-0 bg-scrim/50" />
          </Transition.Child>
          <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 translate-y-2" enterTo="opacity-100 translate-y-0" leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-2">
            <div className="inline-block w-full max-w-md p-5 my-8 text-left align-middle transition-all transform bg-paper rounded-md border border-rule shadow-[0_12px_32px_rgb(0_0_0/0.18)]">
              <Dialog.Title as="h2" className="text-base font-semibold text-ink">{title}</Dialog.Title>
              {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
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
          <label htmlFor={`${id}-username`} className={labelClass}>Username</label>
          <input id={`${id}-username`} autoComplete="off" autoCapitalize="off" spellCheck="false" required value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className={labelClass}>Email</label>
          <input id={`${id}-email`} type="email" autoComplete="off" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} aria-describedby={`${id}-email-help`} />
          <p id={`${id}-email-help`} className={helpClass}>Alerts for this user&apos;s assets go here.</p>
        </div>
        <div>
          <label htmlFor={`${id}-password`} className={labelClass}>Temporary password</label>
          <input id={`${id}-password`} type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputClass} aria-describedby={`${id}-password-help`} />
          <p id={`${id}-password-help`} className={helpClass}>At least 8 characters. Ask them to change it in Settings.</p>
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={form.admin} onChange={(e) => setForm((f) => ({ ...f, admin: e.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-rule-strong accent-accent" />
          <span>
            <span className="block text-sm font-medium text-ink">Admin</span>
            <span className="block text-xs text-ink-2">Can change instance settings and manage users.</span>
          </span>
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
          <label htmlFor={`${id}-password`} className={labelClass}>New password</label>
          <input id={`${id}-password`} type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} aria-describedby={`${id}-password-help`} />
          <p id={`${id}-password-help`} className={helpClass}>At least 8 characters.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={secondaryButtonClass} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className={primaryButtonClass} disabled={saving || password.length < 8}>{saving && <Spinner />} Reset password</button>
        </div>
      </form>
    </Modal>
  );
}

function RoleTag({ admin }) {
  return admin
    ? <span className="inline-flex rounded px-1.5 py-0.5 text-xs font-semibold text-ink bg-sunk ring-1 ring-inset ring-rule-strong">Admin</span>
    : <span className="text-sm text-ink-2">User</span>;
}

function TableSkeleton() {
  return (
    <tbody aria-busy="true">
      {[0, 1, 2].map((row) => (
        <tr key={row} className="border-b border-rule last:border-b-0">
          <td className="px-3 py-3"><SkeletonLine className="h-4 w-24" /></td>
          <td className="px-3 py-3"><SkeletonLine className="h-4 w-40" /></td>
          <td className="px-3 py-3"><SkeletonLine className="h-4 w-12" /></td>
          <td className="px-3 py-3"><SkeletonLine className="h-4 w-6" /></td>
          <td className="px-3 py-3"><SkeletonLine className="h-4 w-48 ml-auto" /></td>
        </tr>
      ))}
    </tbody>
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
    <Section
      title="Users"
      action={(
        <button type="button" className={primaryButtonClass} onClick={() => setAdding(true)}>
          <HiOutlineUserPlus className="text-base" aria-hidden="true" /> Add user
        </button>
      )}
    >
      <p className="text-xs text-ink-2 -mt-1 mb-3">Public sign-up is disabled; add people here.</p>

      {users !== null && users.length === 0 ? (
        <EmptyState title="No users to show">
          The user list could not be loaded or is empty. Reload the page, or select Add user to give someone access.
        </EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-md border border-rule">
          <table className="w-full min-w-[640px] text-sm border-collapse">
            <thead className="bg-sunk">
              <tr>
                <th scope="col" className={thClass}>User</th>
                <th scope="col" className={thClass}>Email</th>
                <th scope="col" className={thClass}>Role</th>
                <th scope="col" className={`${thClass} text-right`}>Assets</th>
                <th scope="col" className={thClass}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            {users === null ? <TableSkeleton /> : (
              <tbody>
                {users.map((user) => {
                  const self = user.id === currentUserId;
                  const busy = busyId === user.id;
                  return (
                    <tr key={user.id} className="border-b border-rule last:border-b-0 align-middle hover:bg-sunk/60">
                      <td className={`px-3 py-2.5 whitespace-nowrap ${user.is_active ? '' : 'opacity-60'}`}>
                        <span className="font-medium text-ink">{user.username}</span>
                        {self && <span className="ml-1.5 text-xs text-ink-2">(you)</span>}
                      </td>
                      <td className={`px-3 py-2.5 text-ink-2 break-all ${user.is_active ? '' : 'opacity-60'}`}>{user.email}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <RoleTag admin={user.is_superuser} />
                          {!user.is_active && <span className="inline-flex rounded px-1.5 py-0.5 text-xs font-semibold text-s5 bg-s5-soft">Deactivated</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">{user.asset_count}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-x-4 whitespace-nowrap">
                          {busy && <Spinner className="h-4 w-4 text-ink-2" />}
                          {!self && (
                            <button type="button" disabled={busy} className={`${rowActionClass} text-accent`} onClick={() => change(user, { is_superuser: !user.is_superuser }, user.is_superuser ? `${user.username} is no longer an admin` : `${user.username} is now an admin`)}>
                              {user.is_superuser ? 'Remove admin' : 'Make admin'}
                            </button>
                          )}
                          <button type="button" disabled={busy} className={`${rowActionClass} text-accent`} onClick={() => setResetting(user)}>
                            Reset password
                          </button>
                          {!self && (
                            <button type="button" disabled={busy} className={`${rowActionClass} ${user.is_active ? 'text-s5' : 'text-accent'}`} onClick={() => change(user, { is_active: !user.is_active }, user.is_active ? `${user.username} deactivated and signed out` : `${user.username} reactivated`)}>
                              {user.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      )}

      <AddUserDialog open={adding} onClose={() => setAdding(false)} onCreated={load} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
    </Section>
  );
}
