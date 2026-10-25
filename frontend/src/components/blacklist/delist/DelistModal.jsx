import { Fragment, useId, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { HiOutlineArrowTopRightOnSquare } from 'react-icons/hi2';
import { toast } from 'react-toastify';
import DelistService from '../../../services/blacklist/delist';
import { hasOfficialRemovalPage, removalPageFor } from './constant';
import { Field, Fields, inputClass, linkClass, primaryButtonClass, secondaryButtonClass, Spinner } from '../../shared/ui';

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
            <Dialog.Overlay className="fixed inset-0 bg-scrim/50" />
          </Transition.Child>
          <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 translate-y-2" enterTo="opacity-100 translate-y-0" leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-2">
            <div className="inline-block w-full max-w-lg p-5 sm:p-6 my-8 text-left align-middle transition-all transform bg-paper rounded-md border border-rule shadow-[0_12px_32px_rgb(0_0_0/0.18)]">
              <Dialog.Title as="h2" className="text-base font-semibold text-ink break-words">
                Request removal from <span className="font-mono">{provider}</span>
              </Dialog.Title>
              <Fields className="mt-3 pb-4 border-b border-rule">
                <Field name="List"><span className="font-mono text-[13px] break-all">{provider}</span></Field>
                <Field name="Listed-Target"><span className="font-mono text-[13px] break-all">{target}</span></Field>
              </Fields>

              <ol className="mt-4 space-y-3 text-sm text-ink list-decimal pl-5 marker:font-mono marker:text-xs marker:text-ink-2">
                <li>Fix what caused the listing first: a compromised mailbox, an open relay, or missing reverse DNS. Most lists re-add addresses that keep sending spam.</li>
                <li>
                  Submit the request on the provider&apos;s site.{' '}
                  <a href={removalPageFor(provider)} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 ${linkClass}`}>
                    {official ? 'Open removal page' : 'Search for the removal page'} <HiOutlineArrowTopRightOnSquare aria-hidden="true" />
                  </a>
                </li>
                <li>Mark it as requested here so the listing shows as in progress until the next check clears it.</li>
              </ol>

              <div className="mt-5">
                <label htmlFor={`${id}-note`} className="block text-sm font-medium text-ink mb-1.5">
                  Note <span className="font-normal text-ink-2">(optional)</span>
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

              <div className="mt-6 pt-4 border-t border-rule flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
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
