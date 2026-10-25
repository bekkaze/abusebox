import { StatusTag } from '../shared/ui';

// Code + word so status never relies on colour alone.
export default function ProviderStatusBadge({ status }) {
  return <StatusTag status={status} />;
}
