import React, { useState, useEffect } from 'react';
import LogTable from '../components/LogTable';
import api from '../services/api';
import { FileText, Download, CheckCircle2 } from 'lucide-react';

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const fetchLogs = async (page = 1, status = statusFilter) => {
    setIsLoading(true);
    try {
      const data = await api.getLogs({ page, limit: 15, status });
      setLogs(data.logs || []);
      setPagination(data.pagination || {});
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1, statusFilter);
  }, [statusFilter]);

  const handlePageChange = (newPage) => {
    fetchLogs(newPage, statusFilter);
  };

  const handleClearLogs = async () => {
    if (window.confirm('Are you sure you want to delete all keep-alive logs?')) {
      try {
        await api.clearLogs();
        setFeedback('All logs cleared successfully.');
        setTimeout(() => setFeedback(''), 3000);
        fetchLogs(1, statusFilter);
      } catch (err) {
        alert('Failed to clear logs: ' + err.message);
      }
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Timestamp', 'Action', 'Status', 'ResponseTime', 'Error'];
    const rows = logs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.action}"`,
      `"${l.status}"`,
      `"${l.responseTime}"`,
      `"${(l.error || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mongodb_keepalive_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 bg-cardBg/90 border border-gray-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <FileText className="w-5 h-5 text-mongo" />
            <h1 className="text-xl font-bold text-white">MongoDB Activity Logs</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Detailed chronological logs of all database ping cycles and network health checks.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-mongo/10 border border-mongo/30 text-mongo text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Table */}
      <LogTable
        logs={logs}
        pagination={pagination}
        onPageChange={handlePageChange}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onRefresh={() => fetchLogs(pagination.page, statusFilter)}
        onClearLogs={handleClearLogs}
        isLoading={isLoading}
      />
    </div>
  );
}
