import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [regNo, setRegNo] = useState('');
  const [regNoInput, setRegNoInput] = useState('');
  const [academicYear, setAcademicYear] = useState('');

  const { data: academicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => api.get('/fee-structure/academic-years').then(r => r.data)
  });

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page, regNo, academicYear],
    queryFn: () => api.get('/transactions', {
      params: { page, limit: 50, registration_no: regNo, academic_year: academicYear }
    }).then(r => r.data)
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setRegNo(regNoInput);
    setPage(1);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">{data?.total ? `${data.total.toLocaleString()} transactions` : 'All payment transactions'}</p>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input className="input" placeholder="Registration Number..." value={regNoInput} onChange={e => setRegNoInput(e.target.value)} />
          </div>
          <select className="select w-auto" value={academicYear} onChange={e => { setAcademicYear(e.target.value); setPage(1); }}>
            <option value="">All Academic Years</option>
            {academicYears?.map((y: string) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="submit" className="btn-primary"><Search size={15} /> Search</button>
          <button type="button" className="btn-secondary" onClick={() => { setRegNo(''); setRegNoInput(''); setAcademicYear(''); setPage(1); }}>Reset</button>
        </form>
      </div>

      <div className="table-container card">
        <table className="table">
          <thead>
            <tr>
              <th>Reg. No.</th>
              <th>Student Name</th>
              <th>Payment Date</th>
              <th>Academic Year</th>
              <th>Study Year</th>
              <th>Fee Type</th>
              <th>Inst.</th>
              <th className="text-right">Amount (₹)</th>
              <th>Receipt No.</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : !data?.transactions?.length ? (
              <tr><td colSpan={10} className="text-center py-10 text-gray-400">No transactions found</td></tr>
            ) : (
              data.transactions.map((t: any) => (
                <tr key={t.id}>
                  <td><span className="font-mono text-xs text-blue-700 font-semibold">{t.registration_no}</span></td>
                  <td className="font-medium">{t.student_name}</td>
                  <td>{t.payment_date ? new Date(t.payment_date).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : '-'}</td>
                  <td>{t.academic_year}</td>
                  <td><span className="badge badge-blue" style={{fontSize:'10px'}}>{t.study_year}</span></td>
                  <td>{t.fee_type}</td>
                  <td><span className="badge badge-gray">Inst. {t.installment}</span></td>
                  <td className="text-right font-semibold text-green-700">₹{t.amount_paid.toLocaleString('en-IN')}</td>
                  <td className="font-mono text-xs">{t.receipt_no || '-'}</td>
                  <td>{t.payment_mode || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data?.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm text-gray-500">Page {data.page} of {data.totalPages} ({data.total} total)</p>
          <div className="flex gap-2">
            <button className="btn-secondary py-1.5 px-3" onClick={() => setPage(p => p - 1)} disabled={page === 1}><ChevronLeft size={16} /></button>
            <button className="btn-secondary py-1.5 px-3" onClick={() => setPage(p => p + 1)} disabled={page >= data.totalPages}><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
