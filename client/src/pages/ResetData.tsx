import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default function ResetData() {
  const [confirmText, setConfirmText] = useState('');
  const [result, setResult] = useState<any>(null);

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data)
  });

  const wipeMutation = useMutation({
    mutationFn: () => api.post('/admin/wipe-data', { confirm: confirmText }).then(r => r.data),
    onSuccess: (data) => { setResult({ success: true, ...data }); setConfirmText(''); },
    onError: (err: any) => setResult({ success: false, error: err.response?.data?.error || 'Wipe failed' })
  });

  const canWipe = confirmText === 'WIPE';

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Reset Data</h1>
        <p className="page-subtitle">Permanently erase all students, fee structure, transactions, and imports</p>
      </div>

      <div className="card p-5 mb-5 border-red-200">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-red-600" />
          <h3 className="font-semibold text-gray-900">This cannot be undone</h3>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Students', value: stats?.totalStudents ?? '—' },
            { label: 'Transactions', value: stats?.totalTransactions ?? '—' },
            { label: 'Ledgers Generated', value: stats?.ledgersGenerated ?? '—' },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-600 mb-4">
          This deletes every student, fee structure item, transaction, deposit, adjustment, import record, and ledger generation entry.
          Your login and other user accounts are not affected. Type <span className="font-mono font-bold text-gray-900">WIPE</span> below to confirm.
        </p>

        <div className="flex items-center gap-3">
          <input
            className="input max-w-xs font-mono"
            placeholder="Type WIPE to confirm"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
          />
          <button
            className="btn-danger"
            disabled={!canWipe || wipeMutation.isPending}
            onClick={() => wipeMutation.mutate()}
          >
            <Trash2 size={15} />
            {wipeMutation.isPending ? 'Wiping...' : 'Wipe All Data'}
          </button>
        </div>

        {result && (
          <div className={`mt-4 px-4 py-3 rounded-lg text-sm ${result.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {result.success
              ? `Done. Cleared ${result.cleared?.students ?? 0} students, ${result.cleared?.imports ?? 0} imports, ${result.cleared?.ledgers ?? 0} ledger records.`
              : result.error}
          </div>
        )}
      </div>
    </div>
  );
}
