import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Plus, X } from 'lucide-react';

export default function Adjustments() {
  const qc = useQueryClient();
  const [regNo, setRegNo] = useState('');
  const [regNoInput, setRegNoInput] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    registration_no: '', academic_year: '', study_year: '', fee_type: '',
    installment: '', adjustment_type: 'adjustment', amount: '', reason: ''
  });

  const { data: adjustments, isLoading } = useQuery({
    queryKey: ['adjustments', regNo],
    queryFn: () => api.get('/adjustments', { params: { registration_no: regNo } }).then(r => r.data)
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/adjustments', { ...data, amount: parseFloat(data.amount) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adjustments'] });
      setShowForm(false);
      setForm({ registration_no: '', academic_year: '', study_year: '', fee_type: '', installment: '', adjustment_type: 'adjustment', amount: '', reason: '' });
    }
  });

  const STUDY_YEARS = ['Freshman Year', 'Sophomore Year', 'Junior Year', 'Senior Year I', 'Senior Year II'];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="page-title">Adjustments</h1>
          <p className="page-subtitle">Refunds, adjustments, and waivers</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> New Adjustment</button>
      </div>

      {showForm && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">New Adjustment / Refund</h3>
            <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Registration No *', key: 'registration_no', type: 'text' },
              { label: 'Academic Year', key: 'academic_year', type: 'text', placeholder: 'e.g. 2024-25' },
              { label: 'Amount (₹) *', key: 'amount', type: 'number' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                <input
                  className="input"
                  type={f.type}
                  placeholder={f.placeholder || ''}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Study Year</label>
              <select className="select" value={form.study_year} onChange={e => setForm(prev => ({ ...prev, study_year: e.target.value }))}>
                <option value="">All</option>
                {STUDY_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Adjustment Type *</label>
              <select className="select" value={form.adjustment_type} onChange={e => setForm(prev => ({ ...prev, adjustment_type: e.target.value }))}>
                <option value="adjustment">Adjustment</option>
                <option value="refund">Refund</option>
                <option value="waiver">Waiver</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Installment</label>
              <select className="select" value={form.installment} onChange={e => setForm(prev => ({ ...prev, installment: e.target.value }))}>
                <option value="">All</option>
                {['I','II','III','IV'].map(i => <option key={i} value={i}>Installment {i}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
              <textarea
                className="input resize-none h-16"
                placeholder="Reason for adjustment..."
                value={form.reason}
                onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              className="btn-primary"
              onClick={() => mutation.mutate(form)}
              disabled={!form.registration_no || !form.amount || mutation.isPending}
            >
              {mutation.isPending ? 'Saving...' : 'Save Adjustment'}
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          {mutation.isError && <p className="text-red-600 text-sm mt-2">Failed to save adjustment</p>}
        </div>
      )}

      {/* Filter */}
      <div className="card p-4 mb-4">
        <form onSubmit={e => { e.preventDefault(); setRegNo(regNoInput); }} className="flex gap-3">
          <input className="input flex-1" placeholder="Filter by Registration No..." value={regNoInput} onChange={e => setRegNoInput(e.target.value)} />
          <button type="submit" className="btn-primary">Filter</button>
          <button type="button" className="btn-secondary" onClick={() => { setRegNo(''); setRegNoInput(''); }}>Reset</button>
        </form>
      </div>

      <div className="table-container card">
        <table className="table">
          <thead>
            <tr>
              <th>Reg. No.</th>
              <th>Student Name</th>
              <th>Type</th>
              <th>Study Year</th>
              <th>Fee Type</th>
              <th className="text-right">Amount (₹)</th>
              <th>Reason</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : !adjustments?.length ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">No adjustments found</td></tr>
            ) : (
              adjustments.map((a: any) => (
                <tr key={a.id}>
                  <td><span className="font-mono text-xs text-blue-700 font-semibold">{a.registration_no}</span></td>
                  <td>{a.student_name}</td>
                  <td>
                    <span className={`badge ${a.adjustment_type === 'refund' ? 'badge-red' : a.adjustment_type === 'waiver' ? 'badge-yellow' : 'badge-blue'}`}>
                      {a.adjustment_type}
                    </span>
                  </td>
                  <td>{a.study_year || '-'}</td>
                  <td>{a.fee_type || '-'}</td>
                  <td className="text-right font-semibold">₹{a.amount.toLocaleString('en-IN')}</td>
                  <td className="max-w-[180px] truncate text-gray-500">{a.reason || '-'}</td>
                  <td>{new Date(a.created_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
