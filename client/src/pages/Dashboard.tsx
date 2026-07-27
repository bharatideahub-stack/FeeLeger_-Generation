import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { Users, IndianRupee, TrendingUp, AlertCircle, ArrowLeftRight, FileText } from 'lucide-react';

function StatCard({ title, value, icon, color, sub }: {
  title: string; value: string; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function formatCurrency(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data)
  });

  const { data: recentImports } = useQuery({
    queryKey: ['recent-imports'],
    queryFn: () => api.get('/dashboard/recent-imports').then(r => r.data)
  });

  const { data: recentLedgers } = useQuery({
    queryKey: ['recent-ledgers'],
    queryFn: () => api.get('/dashboard/recent-ledgers').then(r => r.data)
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of fee collection and student data</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard
          title="Total Students"
          value={isLoading ? '...' : (stats?.totalStudents || 0).toLocaleString()}
          icon={<Users size={20} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          title="Total Fee"
          value={isLoading ? '...' : formatCurrency(stats?.totalFee || 0)}
          icon={<IndianRupee size={20} className="text-purple-600" />}
          color="bg-purple-50"
        />
        <StatCard
          title="Collected"
          value={isLoading ? '...' : formatCurrency(stats?.totalCollected || 0)}
          icon={<TrendingUp size={20} className="text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          title="Total Due"
          value={isLoading ? '...' : formatCurrency(stats?.totalDue || 0)}
          icon={<AlertCircle size={20} className="text-red-600" />}
          color="bg-red-50"
        />
        <StatCard
          title="Transactions"
          value={isLoading ? '...' : (stats?.totalTransactions || 0).toLocaleString()}
          icon={<ArrowLeftRight size={20} className="text-orange-600" />}
          color="bg-orange-50"
        />
        <StatCard
          title="Ledgers Generated"
          value={isLoading ? '...' : (stats?.ledgersGenerated || 0).toLocaleString()}
          icon={<FileText size={20} className="text-teal-600" />}
          color="bg-teal-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Imports */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Imports</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {!recentImports?.length ? (
              <p className="px-5 py-8 text-center text-gray-400 text-sm">No imports yet</p>
            ) : (
              recentImports.slice(0, 5).map((imp: any) => (
                <div key={imp.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{imp.file_name}</p>
                    <p className="text-xs text-gray-400">{new Date(imp.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${imp.status === 'completed' ? 'badge-green' : imp.status === 'failed' ? 'badge-red' : 'badge-yellow'}`}>
                      {imp.status}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{imp.valid_records} valid</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Ledger Generations */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Ledger Generations</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {!recentLedgers?.length ? (
              <p className="px-5 py-8 text-center text-gray-400 text-sm">No ledgers generated yet</p>
            ) : (
              recentLedgers.slice(0, 5).map((l: any) => (
                <div key={l.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{l.student_name || 'Bulk Generation'}</p>
                    <p className="text-xs text-gray-400">{l.registration_no || `${l.student_count} students`}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${l.generation_type === 'individual' ? 'badge-blue' : 'badge-purple'}`} style={l.generation_type === 'bulk' ? {backgroundColor: '#f3e8ff', color: '#7c3aed'} : {}}>
                      {l.generation_type}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{new Date(l.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
