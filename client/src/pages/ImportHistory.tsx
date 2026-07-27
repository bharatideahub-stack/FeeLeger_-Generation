import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { Download, CheckCircle, AlertCircle, Clock } from 'lucide-react';

export default function ImportHistory() {
  const { data: imports, isLoading } = useQuery({
    queryKey: ['imports'],
    queryFn: () => api.get('/imports').then(r => r.data)
  });

  const downloadErrors = (importId: number) => {
    api.get(`/imports/${importId}/error-report`, { responseType: 'blob' }).then(res => {
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `import_errors_${importId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Import History</h1>
        <p className="page-subtitle">All Excel import records and validation results</p>
      </div>

      <div className="table-container card">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>File Name</th>
              <th>Status</th>
              <th>Students</th>
              <th>Fee Records</th>
              <th>Transactions</th>
              <th>Valid</th>
              <th>Errors</th>
              <th>Duplicates</th>
              <th>Imported By</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={12} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : !imports?.length ? (
              <tr><td colSpan={12} className="text-center py-10 text-gray-400">No imports yet. Upload an Excel file to get started.</td></tr>
            ) : (
              imports.map((imp: any) => (
                <tr key={imp.id}>
                  <td className="text-gray-400">{imp.id}</td>
                  <td className="font-medium text-xs max-w-[150px] truncate" title={imp.file_name}>{imp.file_name}</td>
                  <td>
                    {imp.status === 'completed' && <span className="badge badge-green flex items-center gap-1"><CheckCircle size={10} /> Completed</span>}
                    {imp.status === 'failed' && <span className="badge badge-red flex items-center gap-1"><AlertCircle size={10} /> Failed</span>}
                    {imp.status === 'processing' && <span className="badge badge-yellow flex items-center gap-1"><Clock size={10} /> Processing</span>}
                  </td>
                  <td className="text-center">{imp.total_students}</td>
                  <td className="text-center">{imp.total_fee_records}</td>
                  <td className="text-center">{imp.total_transactions}</td>
                  <td className="text-center text-green-700 font-semibold">{imp.valid_records}</td>
                  <td className="text-center">
                    {imp.error_records > 0 ? <span className="badge badge-red">{imp.error_records}</span> : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="text-center">
                    {imp.duplicate_records > 0 ? <span className="badge badge-yellow">{imp.duplicate_records}</span> : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="text-gray-500">{imp.imported_by_name || '-'}</td>
                  <td className="text-xs text-gray-400">{new Date(imp.created_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
                  <td>
                    {imp.error_records > 0 && (
                      <button className="btn-secondary text-xs py-1 px-2" onClick={() => downloadErrors(imp.id)}>
                        <Download size={12} /> Errors
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
