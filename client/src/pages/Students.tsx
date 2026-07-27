import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { Search, ChevronLeft, ChevronRight, User } from 'lucide-react';

export default function Students() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [school, setSchool] = useState('');
  const [program, setProgram] = useState('');

  const { data: filters } = useQuery({
    queryKey: ['student-filters'],
    queryFn: () => api.get('/students/filters').then(r => r.data)
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['students', page, search, school, program],
    queryFn: () => api.get('/students', { params: { page, limit: 20, search, school, program } }).then(r => r.data)
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">
            {data?.total ? `${data.total.toLocaleString()} students` : 'All enrolled students'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search by name, reg. no, father's name..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          <select className="select w-auto" value={school} onChange={e => { setSchool(e.target.value); setPage(1); }}>
            <option value="">All Schools</option>
            {filters?.schools?.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select w-auto" value={program} onChange={e => { setProgram(e.target.value); setPage(1); }}>
            <option value="">All Programs</option>
            {filters?.programs?.map((p: string) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button type="submit" className="btn-primary">Search</button>
          <button type="button" className="btn-secondary" onClick={() => { setSearch(''); setSearchInput(''); setSchool(''); setProgram(''); setPage(1); }}>
            Reset
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="table-container card">
        <table className="table">
          <thead>
            <tr>
              <th>Reg. No.</th>
              <th>Student Name</th>
              <th>Father's Name</th>
              <th>School</th>
              <th>Program</th>
              <th>Campus</th>
              <th>Date of Joining</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : !data?.students?.length ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No students found</td></tr>
            ) : (
              data.students.map((s: any) => (
                <tr key={s.id}>
                  <td><span className="font-mono text-xs text-blue-700 font-semibold">{s.registration_no}</span></td>
                  <td className="font-medium text-gray-900">{s.student_name}</td>
                  <td className="text-gray-600">{s.father_name}</td>
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

      {/* Pagination */}
      {data?.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm text-gray-500">
            Page {data.page} of {data.totalPages} ({data.total} total)
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary py-1.5 px-3" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn-secondary py-1.5 px-3" onClick={() => setPage(p => p + 1)} disabled={page >= data.totalPages}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
