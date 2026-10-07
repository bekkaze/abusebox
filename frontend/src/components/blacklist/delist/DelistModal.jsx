import { Fragment, useId, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { HiExternalLink } from 'react-icons/hi';
import { toast } from 'react-toastify';
import DelistService from '../../../services/blacklist/delist';
import { hasOfficialRemovalPage, removalPageFor } from './constant';
import { inputClass, primaryButtonClass, secondaryButtonClass, Spinner } from '../../shared/ui';

const DelistModal = ({ isOpen, onClose, provider, target, checkId, onRecorded }) => {
  const id = useId();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const official = hasOfficialRemovalPage(provider);

  const close = () => {
    if (saving) return;
    setNote('');
    onClose();
  };

  const markRequested = async () => {
    if (!checkId) {
      toast.error('Re-check this asset first, then try again.');
      return;
    }
    setSaving(true);
    try {
      await DelistService().delistRequest({
        provider,
        delist_required_data: { id: checkId, comment: note.trim() },
      });
      toast.success(`Removal request for ${provider} recorded`);
      setNote('');
      onRecorded?.();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Could not record the request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={close}>
        <div className="min-h-screen px-4 text-center">
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <Dialog.Overlay className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm" />
          </Transition.Child>
          <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4" enterTo="opacity-100 translate-y-0" leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-4">
            <div className="inline-block w-full max-w-lg p-6 my-8 text-left align-middle transition-all transform bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700">
              <Dialog.Title as="h2" className="text-xl font-semibold text-slate-900 dark:text-white break-words">
                Request removal from {provider}
              </Dialog.Title>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 break-all">Listed target: {target}</p>

              <ol className="mt-5 space-y-3 text-sm text-slate-700 dark:text-slate-300 list-decimal pl-5">
                <li>Fix what caused the listing first: a compromised mailbox, an open relay, or missing reverse DNS. Most lists re-add addresses that keep sending spam.</li>
                <li>
                  Submit the request on the provider&apos;s site.{' '}
                  <a href={removalPageFor(provider)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-cyan-700 dark:text-cyan-400 hover:underline">
                    {official ? 'Open removal page' : 'Search for the removal page'} <HiExternalLink aria-hidden="true" />
                  </a>
                </li>
                <li>Mark it as requested here so the listing shows as in progress until the next check clears it.</li>
              </ol>

              <div className="mt-5">
                <label htmlFor={`${id}-note`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Note <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id={`${id}-note`}
                  type="text"
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ticket number or what was fixed"
                  className={inputClass}
                />
              </div>

              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={close} disabled={saving} className={secondaryButtonClass}>Cancel</button>
                <button type="button" onClick={markRequested} disabled={saving} className={primaryButtonClass}>
                  {saving && <Spinner />}
                  {saving ? 'Saving' : 'Mark as requested'}
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default DelistModal;
