import React, { useEffect, useState, useCallback } from 'react';
import { Lock, Users } from 'lucide-react';
import { privacyAPI } from '../services/api';

/**
 * Task 042 (WES CRM handoff): the one-line question asked when a NEW project or task is saved,
 * and the small switch that changes it later. Business = everyone the project is shared with
 * sees it; Private = only you.
 */
export default function PrivacyQuestion({ onChoose, onBack, busy, error }) {
  return (
    <div className="border border-gray-200 bg-gray-50 rounded-lg p-3" data-testid="privacy-question">
      <p className="text-sm font-medium text-gray-800 mb-2">Should this record be private?</p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => onChoose('business')}
          className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
          Business - others can see
        </button>
        <button type="button" disabled={busy} onClick={() => onChoose('private')}
          className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50">
          Private - only me
        </button>
        {onBack && (
          <button type="button" disabled={busy} onClick={onBack}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
            Back
          </button>
        )}
      </div>
    </div>
  );
}

/** "🔒 Private" next to a name in lists (shown only on the owner's own Private items). */
export function PrivateBadge({ privacy }) {
  if (privacy !== 'private') return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-700" title="Private - only you can see it">
      <Lock className="w-3 h-3" /> Private
    </span>
  );
}

/** The switch on a project or task: only its owner sees it. type: 'project' | 'task'. */
export function PrivacySwitch({ type, id, onChanged }) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setInfo(await privacyAPI.get(type, id)); } catch { setInfo(null); }
  }, [type, id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  if (!info || !info.can_change) return null;
  const isPrivate = info.privacy === 'private';

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      await privacyAPI.set(type, id, isPrivate ? 'business' : 'private');
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message || 'Could not change it.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2" data-testid={`privacy-switch-${type}`}>
      <button type="button" onClick={toggle} disabled={busy}
        title={isPrivate ? 'Private - only you can see it. Click to make it Business.' : 'Business - others it is shared with can see it. Click to make it Private.'}
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${isPrivate
          ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-gray-50 text-gray-700 border-gray-200'} disabled:opacity-50`}>
        {isPrivate ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />}
        {isPrivate ? 'Private' : 'Business'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
