import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function FeeStructure() {
  const [regNo, setRegNo] = useState('');
  const [regNoInput, setRegNoInput] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [studyYear, setStudyYear] = useState('');

  const { data: academicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => api.get('/fee-structure/academic-years').then(r => r.data)
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ['fee-structure', regNo, academicYear, studyYear],
    queryFn: () => api.get('/fee-structure', { params: { registration_no: regNo, academic_year: academicYear, study_year: studyYear } }).then(r => r.data),
    enabled: !!(regNo || academicYear || studyYear)
  });

  const STUDY_YEARS = ['Freshman Year', 'Sophomore Year', 'Junior Year', 'Senior Year I', 'Senior Year II'];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setRegNo(regNoInput);
  };

  // Group by reg_no + study_year for display
  const totalFee = items?.reduce((s: number, i: any) => s + i.fee_amount, 0) || 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Fee Structure</h1>
        <p className="page-subtitle">View and manage fee structure per student</p>
      </div>

      <div className="card p-4 mb-4">
        <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              className="input"
              placeholder="Enter Registration Number..."
              value={regNoInput}
              onChange={e => setRegNoInput(e.target.value)}
            />
          </div>
          <select className="select w-auto" value={academicYear} onChange={e => setAcademicYear(e.target.value)}>
            <option value="">All Academic Years</option>
            {academicYears?.map((y: string) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="select w-auto" value={studyYear} onChange={e => setStudyYear(e.target.value)}>
            <option value="">All Study Years</option>
            {STUDY_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="submit" className="btn-primary"><Search size={15} /> Search</button>
          <button type="button" className="btn-secondary" onClick={() => { setRegNo(''); setRegNoInput(''); setAcademicYear(''); setStudyYear(''); }}>Reset</button>
        </form>
      </div>

      {!regNo && !academicYear && !studyYear ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-lg font-medium">Enter a filter to view fee structure</p>
          <p className="text-sm mt-1">Search by Registration Number, Academic Year, or Study Year</p>
        </div>
      ) : (
        <>
          {totalFee > 0 && (
            <div className="mb-3 px-1 flex justify-end">
              <span className="text-sm font-semibold text-gray-700">
                Total Fee: <span className="text-blue-700">₹{totalFee.toLocaleString('en-IN')}</span>
              </span>
            </div>
          )}
          <div className="table-container card">
            <table className="table">
              <thead>
                <tr>
                  <th>Reg. No.</th>
                  <th>Student Name</th>
                  <th>Academic Year</th>
                  <th>Study Year</th>
                  <th>Fee Type</th>
                  <th>Installment</th>
                  <th className="text-right">Fee Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading...</td></tr>
                ) : !items?.length ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">No fee structure records found</td></tr>
                ) : (
                  items.map((item: any) => (
                    <tr key={item.id}>
                      <td><span className="font-mono text-xs text-blue-700 font-semibold">{item.registration_no}</span></td>
                      <td className="font-medium">{item.student_name}</td>
                      <td>{item.academic_year}</td>
                      <td>
                        <span className="badge badge-blue">{item.study_year}</span>
                      </td>
                      <td>{item.fee_type}</td>
                      <td><span className="badge badge-gray">Inst. {item.installment}</span></td>
                      <td className="text-right font-semibold text-gray-900">₹{item.fee_amount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
