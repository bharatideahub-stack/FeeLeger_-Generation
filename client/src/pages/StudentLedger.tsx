import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { Search, FileText, Download, Printer, RefreshCw } from 'lucide-react';

const STUDY_YEAR_ORDER = ['Freshman Year', 'Sophomore Year', 'Junior Year', 'Senior Year I', 'Senior Year II'];

function formatCurrency(n: number): string {
  if (!n) return '';
  return n.toLocaleString('en-IN');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
  } catch { return dateStr; }
}

function LedgerPreview({ data }: { data: any }) {
  const { student, deposits, year_sections, summary } = data;
  const totalDeposit = deposits?.reduce((s: number, d: any) => s + d.amount, 0) || 0;

  return (
    <div className="ledger-preview bg-white" style={{ width: '100%', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px' }}>

      {/* Header */}
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: 'none', marginBottom: 0 }}>
        <colgroup>
          <col style={{ width: '20%' }} />
          <col style={{ width: '62%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={{ width: '20%', border: 'none', padding: '8px', verticalAlign: 'top' }}>
              <div style={{ fontWeight: 'bold', fontSize: '12.5px', lineHeight: '1.4' }}>AURORA HIGHER EDUCATION</div>
              <div style={{ fontWeight: 'bold', fontSize: '12.5px' }}>AND RESEARCH ACADEMY</div>
              <div style={{ fontSize: '9px', marginTop: '4px', lineHeight: '1.5' }}>(Deemed-to-be-University Estd.u/s.03 of UGC Act 1956)</div>
              <div style={{ fontSize: '9px', lineHeight: '1.5' }}>UPPAL, HYDERABAD - 500 098</div>
            </td>
            <td style={{ textAlign: 'center', verticalAlign: 'top', border: 'none', padding: '20px 14px 14px' }}>
              <span style={{ fontSize: '28px', fontWeight: 'bold', letterSpacing: '3px' }}>FEE LEDGER</span>
            </td>
            <td style={{ width: '18%', border: 'none', padding: '4px 0 4px 4px' }}>
              <img
                src="/aurora-logo.jpg"
                alt="Aurora Higher Education and Research Academy"
                style={{ display: 'block', marginLeft: 'auto', maxWidth: '100%', maxHeight: '78px', objectFit: 'contain' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Student Info */}
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '2px' }}>
        <colgroup>
          <col style={{ width: '13%' }} />
          <col style={{ width: '37%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '37%' }} />
        </colgroup>
        <tbody>
          {[
            ['Student Name', student.student_name, 'Registration No.', student.registration_no],
            ["Father's Name", student.father_name, 'Campus', student.campus],
            ['School', student.school, 'Programme', student.program],
            ['Date of Joining', formatDate(student.date_of_joining), 'Date of Leaving', formatDate(student.date_of_leaving)],
          ].map(([l1, v1, l2, v2], i) => (
            <tr key={i}>
              <td style={{ width: '13%', backgroundColor: '#e8e8e8', border: '1px solid #000', padding: '7px 10px', fontWeight: 'bold', fontSize: '12px' }}>{l1}</td>
              <td style={{ width: '24%', border: '1px solid #000', padding: '7px 10px', fontSize: '12px' }}>{v1}</td>
              <td style={{ width: '13%', backgroundColor: '#e8e8e8', border: '1px solid #000', padding: '7px 10px', fontWeight: 'bold', fontSize: '12px' }}>{l2}</td>
              <td style={{ border: '1px solid #000', padding: '7px 10px', fontSize: '12px' }}>{v2}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Deposit Section */}
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '16px' }}>
        <colgroup>
          <col style={{ width: '12%' }} /><col style={{ width: '11%' }} /><col style={{ width: '21%' }} /><col style={{ width: '6%' }} />
          <col style={{ width: '12%' }} /><col style={{ width: '11%' }} /><col style={{ width: '21%' }} /><col style={{ width: '6%' }} />
        </colgroup>
        <tbody>
          <tr>
            {[0, 1].map(half => (
              <>
                <td key={`h-dep-${half}`} style={{ width: '12%', backgroundColor: '#e0e0e0', border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: 'bold', fontSize: '10.5px' }}>Deposits</td>
                <td key={`h-amt-${half}`} style={{ width: '11%', backgroundColor: '#e0e0e0', border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: 'bold', fontSize: '10.5px' }}>Amount</td>
                <td key={`h-rpt-${half}`} style={{ width: '21%', backgroundColor: '#e0e0e0', border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: 'bold', fontSize: '10.5px' }}>Receipt No. & Date</td>
                <td key={`h-sgn-${half}`} style={{ width: '6%', backgroundColor: '#e0e0e0', border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: 'bold', fontSize: '10.5px' }}>Sign.</td>
              </>
            ))}
          </tr>
          <tr>
            {[0, 1].map(half => {
              const dep = deposits[half] || null;
              return (
                <>
                  <td key={`d-dep-${half}`} style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '11px', height: '26px' }}>Deposit</td>
                  <td key={`d-amt-${half}`} style={{ border: '1px solid #000', padding: '5px', textAlign: 'right', fontSize: '11px' }}>{dep ? formatCurrency(dep.amount) : ''}</td>
                  <td key={`d-rpt-${half}`} style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '10px' }}>{dep ? `${dep.receipt_no || ''} ${dep.deposit_date ? '/ '+formatDate(dep.deposit_date) : ''}` : ''}</td>
                  <td key={`d-sgn-${half}`} style={{ border: '1px solid #000', padding: '5px' }}></td>
                </>
              );
            })}
          </tr>
        </tbody>
      </table>

      {/* Year Sections */}
      {year_sections.map((ys: any) => (
        <YearSection key={ys.study_year} yearSection={ys} />
      ))}

      {/* Summary */}
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '16px' }}>
        <colgroup>
          <col style={{ width: '3%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '49%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td rowSpan={3} style={{ width: '3%', border: '1px solid #000', padding: '4px', verticalAlign: 'middle', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              Annexed
            </td>
            <td style={{ width: '14%', border: '1px solid #000', padding: '6px 10px', fontWeight: 'bold', fontSize: '12px' }}>Deposit</td>
            <td style={{ width: '10%', border: '1px solid #000', padding: '6px 10px', textAlign: 'right', fontSize: '12px' }}>{formatCurrency(totalDeposit)}</td>
            <td style={{ width: '14%', border: '1px solid #000', padding: '6px 10px', fontWeight: 'bold', fontSize: '12px' }}>Total Fee</td>
            <td style={{ width: '10%', border: '1px solid #000', padding: '6px 10px', textAlign: 'right', fontSize: '12px' }}>{formatCurrency(summary.total_fee)}</td>
            <td rowSpan={3} style={{ border: '1px solid #000', padding: '6px 10px', fontWeight: 'bold', fontSize: '12px', verticalAlign: 'top' }}>Remarks</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #000', padding: '6px 10px', fontWeight: 'bold', fontSize: '12px' }}>Refund / Adjustment</td>
            <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'right', fontSize: '12px' }}>{formatCurrency(summary.total_refund_adjustment)}</td>
            <td style={{ border: '1px solid #000', padding: '6px 10px', fontWeight: 'bold', fontSize: '12px' }}>Amount Paid</td>
            <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'right', fontSize: '12px' }}>{formatCurrency(summary.total_paid)}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #000', padding: '6px 10px', fontWeight: 'bold', fontSize: '12px' }}>Due</td>
            <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold', color: summary.due > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(summary.due)}</td>
            <td style={{ border: '1px solid #000', padding: '6px 10px', fontWeight: 'bold', fontSize: '12px' }}>Due</td>
            <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold', color: summary.due > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(summary.due)}</td>
          </tr>
        </tbody>
      </table>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', padding: '0 16px' }}>
        {['Assistant', 'Accountant', 'Finance Officer'].map(sig => (
          <div key={sig} style={{ textAlign: 'center', width: '30%' }}>
            <div style={{ borderBottom: '1px solid #000', marginBottom: '6px', paddingBottom: '22px' }}></div>
            <div style={{ fontSize: '12px' }}>{sig}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function YearSection({ yearSection }: { yearSection: any }) {
  const installments = ['I', 'II', 'III', 'IV'];
  const cellStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    border: '1px solid #000', padding: '5px 7px', textAlign: 'center', fontSize: '10.5px',
    ...extra
  });

  return (
    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '16px' }}>
      <colgroup>
        <col style={{ width: '15%' }} />
        <col style={{ width: '7%' }} />
        {installments.map(inst => (
          <>
            <col key={`c-fp-${inst}`} style={{ width: '7%' }} />
            <col key={`c-rd-${inst}`} style={{ width: '11%' }} />
          </>
        ))}
        <col style={{ width: '6%' }} />
      </colgroup>
      <tbody>
        {/* Year Header */}
        <tr>
          <td colSpan={2 + installments.length * 2 + 1} style={{ ...cellStyle(), backgroundColor: '#d0d0d0', fontWeight: 'bold', fontSize: '12.5px', textAlign: 'left', paddingLeft: '10px' }}>
            {yearSection.study_year}
          </td>
        </tr>
        {/* Column Headers Row 1 */}
        <tr>
          <td rowSpan={2} style={{ ...cellStyle({ backgroundColor: '#e8e8e8', fontWeight: 'bold', width: '15%', verticalAlign: 'middle' }) }}>Fee Details</td>
          <td rowSpan={2} style={{ ...cellStyle({ backgroundColor: '#e8e8e8', fontWeight: 'bold', width: '7%', verticalAlign: 'middle' }) }}>Fee Fixed</td>
          {installments.map(inst => (
            <td key={inst} colSpan={2} style={{ ...cellStyle({ backgroundColor: '#e8e8e8', fontWeight: 'bold' }) }}>
              Instalment {inst}
            </td>
          ))}
          <td rowSpan={2} style={{ ...cellStyle({ backgroundColor: '#e8e8e8', fontWeight: 'bold', width: '6%', verticalAlign: 'middle', fontSize: '9px' }) }}>
            Sign.<br/>Asst.Acct.
          </td>
        </tr>
        {/* Column Headers Row 2 */}
        <tr>
          {installments.map(inst => (
            <>
              <td key={`fp-${inst}`} style={{ ...cellStyle({ backgroundColor: '#f0f0f0', fontWeight: 'bold', width: '7%' }), fontSize: '9px' }}>Fee Paid</td>
              <td key={`rd-${inst}`} style={{ ...cellStyle({ backgroundColor: '#f0f0f0', fontWeight: 'bold', width: '11%' }), fontSize: '9px' }}>Receipt No. & Date</td>
            </>
          ))}
        </tr>
        {/* Data Rows */}
        {yearSection.fee_rows.map((feeRow: any) => {
          const totalFixed = Object.values(feeRow.installments).reduce((s: number, inst: any) => s + inst.fee_fixed, 0);
          return (
            <tr key={feeRow.fee_type}>
              <td style={{ ...cellStyle({ textAlign: 'left', paddingLeft: '8px' }) }}>{feeRow.fee_type}</td>
              <td style={{ ...cellStyle({ textAlign: 'right' }) }}>{totalFixed ? formatCurrency(totalFixed) : ''}</td>
              {installments.map(inst => {
                const instData = feeRow.installments[inst] || { total_paid: 0, receipt_display: '' };
                return (
                  <>
                    <td key={`fp-${inst}`} style={{ ...cellStyle({ textAlign: 'right' }) }}>{instData.total_paid ? formatCurrency(instData.total_paid) : ''}</td>
                    <td key={`rd-${inst}`} style={{ ...cellStyle(), fontSize: '9px' }}>{instData.receipt_display || ''}</td>
                  </>
                );
              })}
              <td style={cellStyle()}></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function StudentLedger() {
  const [regNoInput, setRegNoInput] = useState('');
  const [regNo, setRegNo] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ledger', regNo],
    queryFn: () => api.get(`/ledger/student/${regNo}`).then(r => r.data),
    enabled: !!regNo
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setRegNo(regNoInput.trim().toUpperCase());
  };

  const handleDownloadPdf = async () => {
    const res = await api.get(`/ledger/student/${regNo}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `fee_ledger_${regNo}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="page-title">Student Fee Ledger</h1>
          <p className="page-subtitle">Search and preview individual student fee ledgers</p>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4 mb-5">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1">
            <input
              className="input"
              placeholder="Enter Registration Number (e.g. 24A91A0501)..."
              value={regNoInput}
              onChange={e => setRegNoInput(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary"><Search size={16} /> View Ledger</button>
        </form>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="card p-12 text-center text-gray-400">
          <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-3"></div>
          <p>Loading ledger data...</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="card p-8 text-center">
          <p className="text-red-600 font-medium">Student not found or no data available for this registration number.</p>
          <p className="text-gray-400 text-sm mt-1">Verify the registration number and try again.</p>
        </div>
      )}

      {/* Ledger Preview */}
      {data && !isLoading && (
        <div>
          {/* Action Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-900">Fee Ledger Preview</h2>
              <span className="badge badge-blue">{data.student.registration_no}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => refetch()}><RefreshCw size={15} /> Refresh</button>
              <button className="btn-secondary" onClick={handlePrint}><Printer size={15} /> Print</button>
              <button className="btn-success" onClick={handleDownloadPdf}><Download size={15} /> Download PDF</button>
            </div>
          </div>

          {/* Summary Bar */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Fee', value: `₹${(data.summary.total_fee || 0).toLocaleString('en-IN')}`, color: 'text-gray-900' },
              { label: 'Amount Paid', value: `₹${(data.summary.total_paid || 0).toLocaleString('en-IN')}`, color: 'text-green-700' },
              { label: 'Deposit', value: `₹${(data.summary.total_deposit || 0).toLocaleString('en-IN')}`, color: 'text-blue-700' },
              { label: 'Due', value: `₹${(data.summary.due || 0).toLocaleString('en-IN')}`, color: data.summary.due > 0 ? 'text-red-700' : 'text-green-700' },
            ].map(s => (
              <div key={s.label} className="card p-3">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="card p-6 overflow-x-auto" id="ledger-print-area">
            <LedgerPreview data={data} />
          </div>
        </div>
      )}

      {!data && !isLoading && !isError && (
        <div className="card p-12 text-center text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Enter a Registration Number to view the Fee Ledger</p>
        </div>
      )}
    </div>
  );
}
