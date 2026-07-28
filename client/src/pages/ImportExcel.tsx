import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download, X } from 'lucide-react';

export default function ImportExcel() {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [format, setFormat] = useState<'3' | '2'>('3');

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post('/imports/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }).then(r => r.data);
    },
    onSuccess: (data) => setResult(data),
    onError: (err: any) => setResult({ error: err.response?.data?.error || 'Import failed' })
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.endsWith('.xlsx')) setFile(dropped);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleImport = () => {
    if (!file) return;
    setResult(null);
    importMutation.mutate(file);
  };

  const downloadTemplate = (blank: boolean) => {
    const sheetsParam = format === '2' ? '&sheets=2' : '';
    api.get(`/imports/template/download?blank=${blank}${sheetsParam}`, { responseType: 'blob' }).then(res => {
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      const suffix = format === '2' ? '_2sheet' : '';
      a.download = blank ? `fee_ledger_blank_template${suffix}.xlsx` : `fee_ledger_sample_template${suffix}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const downloadErrors = () => {
    if (!result?.importId) return;
    api.get(`/imports/${result.importId}/error-report`, { responseType: 'blob' }).then(res => {
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `import_errors_${result.importId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="page-title">Import Excel</h1>
          <p className="page-subtitle">Upload student data, fee structure, and transactions from Excel</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => downloadTemplate(false)}>
            <Download size={15} /> Sample Template
          </button>
          <button className="btn-secondary" onClick={() => downloadTemplate(true)}>
            <Download size={15} /> Blank Template
          </button>
        </div>
      </div>

      {/* Format switch */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-600">Sheet format:</span>
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
          <button
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${format === '3' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            onClick={() => setFormat('3')}
          >
            3 sheets (Students / Fee_Structure / Transactions)
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${format === '2' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            onClick={() => setFormat('2')}
          >
            2 sheets (Students / Fee Details)
          </button>
        </div>
      </div>

      {/* Format Info */}
      <div className={`grid gap-4 mb-5 ${format === '3' ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {(format === '3' ? [
          { sheet: 'Sheet 1: Students', cols: 'Registration No, Student Name, Father\'s Name, School, Department, Program, Campus, Date of Joining, Date of Leaving' },
          { sheet: 'Sheet 2: Fee_Structure', cols: 'Registration No, Academic Year, Study Year, Fee Type, Installment, Fee Amount' },
          { sheet: 'Sheet 3: Transactions', cols: 'Registration No, Payment Date, Academic Year, Study Year, Fee Type, Installment, Amount Paid, Receipt No, EasyBuzz ID, Payment Mode' },
        ] : [
          { sheet: 'Sheet 1: Students', cols: 'Registration No, Student Name, Father\'s Name, School, Department, Program, Campus, Date of Joining, Date of Leaving' },
          { sheet: 'Sheet 2: Fee Details', cols: 'Registration No, Academic Year, Study Year, Fee Type, Installment, Fee Amount, Amount Paid, Payment Date, Receipt No, EasyBuzz ID, Payment Mode — leave the last 5 columns blank until that installment is actually paid; add another row with the same Fee Type/Installment to log a second partial payment.' },
        ]).map(({ sheet, cols }) => (
          <div key={sheet} className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet size={16} className="text-green-600" />
              <h3 className="font-semibold text-sm text-gray-900">{sheet}</h3>
            </div>
            <p className="text-xs text-gray-500">{cols}</p>
          </div>
        ))}
      </div>

      {/* Upload Zone */}
      <div className="card p-6 mb-5">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
            dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Upload size={32} className={`mx-auto mb-3 ${dragOver ? 'text-blue-500' : 'text-gray-300'}`} />
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <FileSpreadsheet size={18} className="text-green-600" />
              <span className="text-sm font-medium text-gray-900">{file.name}</span>
              <button onClick={() => { setFile(null); setResult(null); }} className="text-gray-400 hover:text-red-500 ml-1">
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <p className="text-gray-600 font-medium mb-1">Drag & drop your Excel file here</p>
              <p className="text-gray-400 text-sm mb-4">or click to browse</p>
              <label className="btn-secondary cursor-pointer">
                Browse File
                <input type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
              </label>
            </>
          )}
        </div>

        {file && (
          <div className="mt-4 flex justify-center">
            <button
              className="btn-primary px-8"
              onClick={handleImport}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> Processing...</>
              ) : (
                <><Upload size={16} /> Import & Validate</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {result && !result.error && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={18} className="text-green-600" />
            <h3 className="font-semibold text-gray-900">Import Validation Report</h3>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Students', value: result.totalStudents, color: 'text-blue-700' },
              { label: 'Fee Records', value: result.totalFeeRecords, color: 'text-purple-700' },
              { label: 'Transactions', value: result.totalTransactions, color: 'text-green-700' },
              { label: 'Valid Records', value: result.validRecords, color: 'text-green-700' },
              { label: 'Error Records', value: result.errorRecords, color: 'text-red-700' },
              { label: 'Duplicates', value: result.duplicateRecords, color: 'text-yellow-700' },
              { label: 'Unmatched', value: result.unmatchedRecords, color: 'text-orange-700' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {result.errors?.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-500" />
                  <h4 className="font-medium text-gray-900">Validation Errors ({result.errors.length})</h4>
                </div>
                <button className="btn-secondary text-xs py-1 px-3" onClick={downloadErrors}>
                  <Download size={13} /> Download Error Report
                </button>
              </div>
              <div className="table-container rounded-lg border border-red-100 max-h-64 overflow-y-auto">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>Sheet</th><th>Row</th><th>Reg. No.</th><th>Error Type</th><th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.slice(0, 100).map((e: any, i: number) => (
                      <tr key={i}>
                        <td>{e.sheet}</td>
                        <td>{e.row}</td>
                        <td className="font-mono text-xs">{e.registration_no || '-'}</td>
                        <td><span className="badge badge-red">{e.errorType}</span></td>
                        <td>{e.message}</td>
                      </tr>
                    ))}
                    {result.errors.length > 100 && (
                      <tr><td colSpan={5} className="text-center text-gray-400 py-2">... and {result.errors.length - 100} more errors. Download the error report for full details.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {result.errorRecords === 0 && (
            <div className="mt-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center">
              ✓ All records imported successfully!
            </div>
          )}
        </div>
      )}

      {result?.error && (
        <div className="card p-5">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle size={18} />
            <p className="font-medium">{result.error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
