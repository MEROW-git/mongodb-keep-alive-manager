import React from 'react';
import { CheckCircle2, XCircle, Clock, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

export default function LogTable({
  logs = [],
  pagination = {},
  onPageChange,
  statusFilter,
  setStatusFilter,
  onRefresh,
  onClearLogs,
  isLoading,
}) {
  return (
    <div className="glass-panel rounded-2xl bg-cardBg/90 border border-gray-800/80 overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 sm:p-5 border-b border-gray-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Execution Logs</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Audit trail of all automated & manual keep-alive pings
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Filter Buttons */}
          <div className="flex bg-gray-900/90 rounded-lg p-1 border border-gray-800 text-xs">
            {['ALL', 'SUCCESS', 'FAILED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  statusFilter === st
                    ? 'bg-mongo text-black font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh logs"
            className="p-1.5 rounded-lg border border-gray-800 bg-gray-900/90 text-gray-300 hover:text-white hover:border-gray-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-mongo' : ''}`} />
          </button>

          {/* Clear Logs */}
          {onClearLogs && (
            <button
              onClick={onClearLogs}
              title="Clear all logs"
              className="p-1.5 rounded-lg border border-gray-800 bg-gray-900/90 text-gray-400 hover:text-red-400 hover:border-red-900/50 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0B1120]/70 text-gray-400 uppercase font-mono tracking-wider border-b border-gray-800/80">
            <tr>
              <th className="py-3 px-4 sm:px-6">Timestamp</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Latency</th>
              <th className="py-3 px-4 sm:px-6">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 font-mono">
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-gray-500 font-sans">
                  {isLoading ? 'Loading logs...' : 'No logs recorded yet.'}
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isSuccess = log.status === 'SUCCESS';
                return (
                  <tr key={log.id} className="hover:bg-gray-800/30 transition">
                    <td className="py-3 px-4 sm:px-6 text-gray-300 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        <span>{log.formattedTime || log.timestamp}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-white font-semibold">
                      <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                        {log.action || 'PING'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          isSuccess
                            ? 'bg-mongo/10 text-mongo border border-mongo/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {isSuccess ? (
                          <CheckCircle2 className="w-3 h-3 text-mongo" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-400" />
                        )}
                        <span>{log.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white">
                      <span className={isSuccess ? 'text-mongo' : 'text-gray-400'}>
                        {log.responseTime}
                      </span>
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-gray-400 font-sans max-w-xs truncate">
                      {isSuccess ? 'Database ping completed' : log.error || 'Connection failed'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="p-4 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
          <div>
            Showing Page <span className="font-semibold text-white">{pagination.page}</span> of{' '}
            <span className="font-semibold text-white">{pagination.totalPages}</span> ({pagination.total} total)
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg border border-gray-800 bg-gray-900 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-lg border border-gray-800 bg-gray-900 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
