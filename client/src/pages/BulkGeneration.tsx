import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../api/client';
import { Download, Users, Filter, CheckSquare, Square, Loader2 } from 'lucide-react';

export default function BulkGeneration() {
  const [filters, setFilters] = useState({ school: '', program: '', department: '', academic_year: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const { data: filterOptions } = useQuery({
    queryKey: ['student-filters'],
    queryFn: () => api.get('/students/filters').then(r => r.data)
  });

  const { data: academicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => api.get('/fee-structure/academic-years').then(r => r.data)
  });

  const { data: candidates, isLoading, refetch } = useQuery({
    queryKey: ['bulk-candidates', filters],
    queryFn: () => api.get('/ledger/bulk-candidates', { params: filters }).then(r => r.data),
    enabled: Object.values(filters).some(v => v !== '')
  });

  const students: any[] = candidates || [];
  const allSelected = students.length > 0 && students.every(s => selected.has(s.registration_no));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(students.map(s => s.registration_no)));
    }
  };

  const toggleStudent = (regNo: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(regNo) ? next.delete(regNo) : next.add(regNo);
      return next;
    });
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setSelected(new Set());
    refetch();
  };

  const downloadCombinedPdf = async () => {
    if (!selected.size) return;
    const registration_numbers = [...selected];
    setGenerating(true);
    try {
      const res = await api.post('/ledger/bulk/pdf', { registration_numbers, combined: true }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulk_fee_ledgers_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  };

  const downloadIndividualPdfs = async () => {
    if (!selected.size) return;
    const regNos = [...selected];
    setGenerating(true);
    setProgress({ current: 0, total: regNos.length });

    for (let i = 0; i < regNos.length; i++) {
      const regNo = regNos[i];
      try {
        const res = await api.get(`/ledger/student/${regNo}/pdf`, { responseType: 'blob' });
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `fee_ledger_${regNo}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        // Small delay to avoid overwhelming the browser
        await new Promise(r => setTimeout(r, 300));
      } catch {}
      setProgress({ current: i + 1, total: regNos.length });
    }
    setGenerating(false);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="page-title">Bulk Generation</h1>
          <p className="page-subtitle">Generate fee ledgers for multiple students at once</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && !generating && (
            <>
              <button className="btn-secondary" onClick={downloadIndividualPdfs}>
                <Download size={16} /> Individual PDFs ({selected.size})
              </button>
              <button className="btn-primary" onClick={downloadCombinedPdf}>
                <Download size={16} /> Combined PDF ({selected.size})
              </button>
            </>
          )}
          {generating && (
            <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
              <Loader2 size={16} className="animate-spin" />
              {progress.total > 1 ? `Generating ${progress.current}/${progress.total}...` : 'Generating...'}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <form onSubmit={handleApplyFilters} className="flex gap-3 flex-wrap">
          <select className="select w-auto" value={filters.school} onChange={e => setFilters(f => ({ ...f, school: e.target.value }))}>
            <option value="">All Schools</option>
            {filterOptions?.schools?.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select w-auto" value={filters.program} onChange={e => setFilters(f => ({ ...f, program: e.target.value }))}>
            <option value="">All Programs</option>
            {filterOptions?.programs?.map((p: string) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="select w-auto" value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))}>
            <option value="">All Departments</option>
            {filterOptions?.departments?.map((d: string) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="select w-auto" value={filters.academic_year} onChange={e => setFilters(f => ({ ...f, academic_year: e.target.value }))}>
            <option value="">All Academic Years</option>
            {academicYears?.map((y: string) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="submit" className="btn-primary"><Filter size={15} /> Apply</button>
          <button type="button" className="btn-secondary" onClick={() => { setFilters({ school:'',program:'',department:'',academic_year:'' }); setSelected(new Set()); }}>Reset</button>
        </form>
      </div>

      {/* Student List */}
      {!Object.values(filters).some(v => v) ? (
        <div className="card p-12 text-center text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Select filters to load students</p>
        </div>
      ) : (
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={toggleAll} className="text-gray-500 hover:text-blue-600">
                {allSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
              </button>
              <span className="text-sm font-medium text-gray-700">
                {isLoading ? 'Loading...' : `${students.length} students found`}
              </span>
              {selected.size > 0 && (
                <span className="badge badge-blue">{selected.size} selected</span>
              )}
            </div>
            {students.length > 0 && (
              <button className="text-xs text-blue-600 hover:underline" onClick={toggleAll}>
                {allSelected ? 'Deselect All' : `Select All (${students.length})`}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>Reg. No.</th>
                  <th>Student Name</th>
                  <th>School</th>
                  <th>Program</th>
                  <th>Campus</th>
                  <th>Date of Joining</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading students...</td></tr>
                ) : !students.length ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">No students match the selected filters</td></tr>
                ) : (
                  students.map((s: any) => (
                    <tr key={s.registration_no} className={selected.has(s.registration_no) ? 'bg-blue-50' : ''}>
                      <td>
                        <button onClick={() => toggleStudent(s.registration_no)} className="text-gray-400 hover:text-blue-600">
                          {selected.has(s.registration_no)
                            ? <CheckSquare size={16} className="text-blue-600" />
                            : <Square size={16} />
                          }
                        </button>
                      </td>
                      <td><span className="font-mono text-xs text-blue-700 font-semibold">{s.registration_no}</span></td>
                      <td className="font-medium">{s.student_name}</td>
                      <td>{s.school}</td>
                      <td>{s.program}</td>
                      <td>{s.campus}</td>
                      <td>{s.date_of_joining ? new Date(s.date_of_joining).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
