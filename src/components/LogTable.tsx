import React, { useState } from 'react';
import { FileDown, Trash2, CheckCircle, Search, AlertTriangle, ShieldCheck, Filter, Clock } from 'lucide-react';
import { ScanLog } from '../types';

interface LogTableProps {
  scanLogs: ScanLog[];
  onUpdateStatus: (id: string, status: 'removed' | 'dismissed') => void;
  onClearLogs: () => void;
  onRemoveLog: (id: string) => void;
}

export default function LogTable({
  scanLogs,
  onUpdateStatus,
  onClearLogs,
  onRemoveLog,
}: LogTableProps) {
  const [filterType, setFilterType] = useState<'all' | 'expired' | 'removed' | 'safe'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter logs
  const filteredLogs = scanLogs.filter(log => {
    // 1. Filter by status
    if (filterType === 'expired' && !log.isMatched) return false;
    if (filterType === 'removed' && log.status !== 'removed') return false;
    if (filterType === 'safe' && log.isMatched) return false;

    // 2. Filter by search text
    const query = searchQuery.toLowerCase();
    if (!query) return true;

    const matchesCode = log.scanCode.toLowerCase().includes(query);
    const matchesName = log.matchedItem?.name?.toLowerCase().includes(query) || false;
    const matchesLocation = log.matchedItem?.location?.toLowerCase().includes(query) || false;

    return matchesCode || matchesName || matchesLocation;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  // Export helper: creates and downloads CSV report with Excel BOM support
  const exportToCSV = (onlyAnomalies: boolean) => {
    const listToExport = onlyAnomalies 
      ? scanLogs.filter(log => log.isMatched) 
      : scanLogs;

    if (listToExport.length === 0) {
      alert(onlyAnomalies ? '当前没有异常（过期商品）记录，无需导出！' : '当前没有扫描记录可供导出！');
      return;
    }

    // CSV headers
    const headers = [
      '序号',
      '扫描时间',
      '商品条码/入库码',
      '比对结果',
      '商品名称/规格',
      '存放货架位置',
      '取出处置状态',
      '确认取出时间'
    ];

    const rows = listToExport.map((log, index) => {
      const matchResultText = log.isMatched ? '【过期商品 - 需取出】' : '正常通过';
      const statusText = log.status === 'removed' ? '已确认取出' : (log.isMatched ? '待取出处理' : '无需动作');
      const removedTimeText = log.removedTime ? new Date(log.removedTime).toLocaleString() : '-';
      
      return [
        index + 1,
        new Date(log.scanTime).toLocaleString(),
        `="${log.scanCode}"`, // Protect barcode formatting from turning into scientific notation in Excel
        matchResultText,
        log.matchedItem?.name || '-',
        log.matchedItem?.location || '-',
        statusText,
        removedTimeText
      ];
    });

    // Generate CSV content with UTF-8 BOM (\uFEFF) so Excel opens it with Chinese characters correctly
    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = onlyAnomalies 
      ? `仓库过期商品核对_异常提醒报表_${dateStr}.csv` 
      : `仓库商品扫码流水_全部记录_${dateStr}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = {
    total: scanLogs.length,
    anomalies: scanLogs.filter(log => log.isMatched).length,
    pending: scanLogs.filter(log => log.isMatched && log.status !== 'removed').length,
    cleared: scanLogs.filter(log => log.isMatched && log.status === 'removed').length,
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6" id="log-table-panel">
      {/* Header section with Stats & export triggers */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center pb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">3. 扫码核对记录与异常报表</h2>
          <p className="text-xs text-slate-500 mt-1">
            本页记录所有扫码核对记录。包含 <span className="text-rose-600 font-semibold">{stats.anomalies}</span> 条异常过期商品提醒。
          </p>
        </div>

        {/* Action button triggers */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => exportToCSV(true)}
            disabled={stats.anomalies === 0}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition shadow-sm flex items-center gap-1.5 ${
              stats.anomalies === 0
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 shadow-rose-100'
            }`}
            id="btn-export-anomalies"
          >
            <FileDown className="w-4 h-4" />
            导出异常提醒报表 (Excel/CSV)
          </button>

          <button
            onClick={() => exportToCSV(false)}
            disabled={stats.total === 0}
            className={`px-4 py-2 text-xs font-medium rounded-lg border transition ${
              stats.total === 0
                ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
            }`}
            id="btn-export-all"
          >
            <FileDown className="w-4 h-4" />
            导出全部流水记录
          </button>

          {stats.total > 0 && (
            <button
              onClick={() => {
                if (window.confirm('确认清空所有扫码比对记录吗？（注意：这不会清空您的过期商品数据库）')) {
                  onClearLogs();
                }
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
              id="btn-clear-logs"
            >
              清空流水
            </button>
          )}
        </div>
      </div>

      {/* Stats Counter Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium text-slate-400">总扫描流水</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{stats.total} 次</p>
          </div>
          <Clock className="w-5 h-5 text-slate-400" />
        </div>

        <div className="bg-rose-50 border border-rose-100/60 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium text-rose-500">累计发现过期商品</p>
            <p className="text-xl font-bold text-rose-700 mt-0.5">{stats.anomalies} 件</p>
          </div>
          <AlertTriangle className="w-5 h-5 text-rose-500" />
        </div>

        <div className="bg-amber-50 border border-amber-100/60 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium text-amber-600">待处理 (未取出)</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{stats.pending} 件</p>
          </div>
          <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
        </div>

        <div className="bg-emerald-50 border border-emerald-100/60 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium text-emerald-600">处理完毕 (已确认取出)</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">{stats.cleared} 件</p>
          </div>
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
        {/* Toggle Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          <span className="text-xs text-slate-500 mr-1.5 hidden sm:inline">过滤分类:</span>
          
          <button
            onClick={() => { setFilterType('all'); setCurrentPage(1); }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              filterType === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            全部记录 ({stats.total})
          </button>
          
          <button
            onClick={() => { setFilterType('expired'); setCurrentPage(1); }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
              filterType === 'expired'
                ? 'bg-rose-600 text-white'
                : 'bg-white text-rose-600 hover:bg-rose-50 border border-rose-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            异常提醒 ({stats.anomalies})
          </button>

          <button
            onClick={() => { setFilterType('removed'); setCurrentPage(1); }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              filterType === 'removed'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-emerald-600 hover:bg-emerald-50 border border-emerald-200'
            }`}
          >
            已取出存盘 ({stats.cleared})
          </button>

          <button
            onClick={() => { setFilterType('safe'); setCurrentPage(1); }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              filterType === 'safe'
                ? 'bg-slate-200 text-slate-800'
                : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            正常商品
          </button>
        </div>

        {/* Local Search input */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="搜索流水的条码、名称或货架..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
            id="search-logs"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Responsive table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
        {paginatedLogs.length === 0 ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center">
            <Search className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-medium">没有找到符合当前过滤条件的扫描记录</p>
            <p className="text-[11px] text-slate-400 mt-1">请扫码商品或清空搜索条件后重试</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase font-semibold tracking-wider bg-slate-50/50">
                <th className="py-2.5 px-4">扫描时间</th>
                <th className="py-2.5 px-4">条码 / 入库编号</th>
                <th className="py-2.5 px-4">比对判定</th>
                <th className="py-2.5 px-4">对应商品 / 存放货架</th>
                <th className="py-2.5 px-4">处理状态</th>
                <th className="py-2.5 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedLogs.map((log) => {
                return (
                  <tr
                    key={log.id}
                    className={`transition hover:bg-slate-50/40 ${
                      log.isMatched 
                        ? (log.status === 'removed' ? 'bg-emerald-50/20' : 'bg-rose-50/10') 
                        : ''
                    }`}
                  >
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {new Date(log.scanTime).toLocaleTimeString()}
                    </td>

                    {/* Barcode */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {log.scanCode}
                    </td>

                    {/* Comparison Status */}
                    <td className="py-3 px-4">
                      {log.isMatched ? (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          已过期过仓储期
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          正常周转商品
                        </span>
                      )}
                    </td>

                    {/* Meta description */}
                    <td className="py-3 px-4 text-slate-600 max-w-[200px]">
                      {log.isMatched && log.matchedItem ? (
                        <div>
                          <p className="font-semibold text-slate-800 truncate">{log.matchedItem.name || '过期商品'}</p>
                          <p className="text-[10px] text-indigo-600 truncate">货位: {log.matchedItem.location || '暂无位置'}</p>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Process Status */}
                    <td className="py-3 px-4">
                      {log.isMatched ? (
                        log.status === 'removed' ? (
                          <span className="text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded">
                            已取出并销账
                          </span>
                        ) : (
                          <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded animate-pulse">
                            待处理取出！
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400">无需取出</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {log.isMatched && log.status !== 'removed' && (
                          <button
                            onClick={() => onUpdateStatus(log.id, 'removed')}
                            className="bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-700 px-2 py-1 rounded text-[11px] font-medium transition"
                            title="标记为已从货架取出"
                          >
                            确认取出
                          </button>
                        )}
                        <button
                          onClick={() => onRemoveLog(log.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded transition"
                          title="删除该条扫码记录"
                          id={`delete-log-${log.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <span>
            显示第 {startIndex + 1} 到 {Math.min(startIndex + itemsPerPage, filteredLogs.length)} 条，共 {filteredLogs.length} 条过滤记录
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-2.5 py-1 rounded border text-xs transition bg-white ${
                currentPage === 1
                  ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              上一页
            </button>
            <span className="px-3 py-1 font-medium text-slate-700 self-center">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-2.5 py-1 rounded border text-xs transition bg-white ${
                currentPage === totalPages
                  ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
