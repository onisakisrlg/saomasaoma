import React, { useState, useRef } from 'react';
import { Upload, ClipboardPaste, Plus, AlertCircle, CheckCircle, Trash2, Search, FileDown } from 'lucide-react';
import { ExpiredItem, isValidWarehouseCode } from '../types';

interface ImportPanelProps {
  expiredItems: Record<string, ExpiredItem>;
  onImport: (items: ExpiredItem[], mode: 'overwrite' | 'append') => void;
  onRemoveItem: (code: string) => void;
  onClearAll: () => void;
}

export default function ImportPanel({
  expiredItems,
  onImport,
  onRemoveItem,
  onClearAll,
}: ImportPanelProps) {
  const [importMode, setImportMode] = useState<'overwrite' | 'append'>('overwrite');
  const [pasteText, setPasteText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const expiredList = Object.values(expiredItems);
  const filteredList = expiredList.filter(
    item =>
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.location && item.location.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedList = filteredList.slice(startIndex, startIndex + itemsPerPage);

  // Parse raw text input (comma, tab, or newline separated)
  const parseTextData = (text: string) => {
    const lines = text.split(/\r?\n/);
    const validItems: ExpiredItem[] = [];
    const sampleInvalidCodes: string[] = [];
    let invalidCodesCount = 0;
    const now = new Date().toISOString();

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Check if it's a CSV header line to skip (e.g., code,name,location)
      if (
        (line.toLowerCase().includes('code') || line.toLowerCase().includes('编码')) &&
        validItems.length === 0
      ) {
        continue;
      }

      // Support separators: tab (from Excel paste), comma, or semicolon
      let parts: string[] = [];
      if (line.includes('\t')) {
        parts = line.split('\t');
      } else if (line.includes(',')) {
        parts = line.split(',');
      } else if (line.includes(';')) {
        parts = line.split(';');
      } else {
        parts = [line];
      }

      const code = parts[0]?.trim();
      if (!code) continue;

      // STRICT FORMAT VALIDATION: xx-xxxxxxxx
      if (!isValidWarehouseCode(code)) {
        invalidCodesCount++;
        if (sampleInvalidCodes.length < 3) {
          sampleInvalidCodes.push(code);
        }
        continue;
      }

      const name = parts[1]?.trim() || undefined;
      const location = parts[2]?.trim() || undefined;
      const notes = parts[3]?.trim() || undefined;

      validItems.push({
        code,
        name,
        location,
        importTime: now,
        notes,
      });
    }

    return { validItems, invalidCodesCount, sampleInvalidCodes };
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteText.trim()) {
      showFeedback('error', '请输入或粘贴需要导入的数据');
      return;
    }

    const { validItems, invalidCodesCount, sampleInvalidCodes } = parseTextData(pasteText);
    
    if (validItems.length === 0) {
      if (invalidCodesCount > 0) {
        showFeedback(
          'error',
          `导入失败：所有 ${invalidCodesCount} 条数据的编码格式都不正确。必须为“前2位-后8位”的规范格式 (如: ${sampleInvalidCodes.join(', ')})`
        );
      } else {
        showFeedback('error', '无法解析有效的数据，请确保有至少一列商品编码');
      }
      return;
    }

    onImport(validItems, importMode);
    
    if (invalidCodesCount > 0) {
      showFeedback(
        'success',
        `成功导入 ${validItems.length} 个符合规范的编码。另有 ${invalidCodesCount} 个因格式不符（须为 xx-xxxxxxxx 格式）被自动过滤跳过 (例如: ${sampleInvalidCodes.join(', ')})`
      );
    } else {
      showFeedback('success', `成功导入 ${validItems.length} 个规范商品编码（模式: ${importMode === 'overwrite' ? '覆盖' : '追加'}）`);
    }
    setPasteText('');
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = manualCode.trim();
    if (!cleanCode) {
      showFeedback('error', '商品编码不能为空');
      return;
    }

    // STRICT FORMAT VALIDATION: xx-xxxxxxxx
    if (!isValidWarehouseCode(cleanCode)) {
      showFeedback('error', `编码格式不符！必须为“前2位-后8位”的固定格式 (如: TS-10293847)。当前输入: ${cleanCode}`);
      return;
    }

    const newItem: ExpiredItem = {
      code: cleanCode,
      name: manualName.trim() || undefined,
      location: manualLocation.trim() || undefined,
      importTime: new Date().toISOString(),
    };

    onImport([newItem], 'append');
    showFeedback('success', `已手动添加编码: ${cleanCode}`);
    setManualCode('');
    setManualName('');
    setManualLocation('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        showFeedback('error', '无法读取文件内容');
        return;
      }
      const { validItems, invalidCodesCount, sampleInvalidCodes } = parseTextData(text);
      if (validItems.length === 0) {
        if (invalidCodesCount > 0) {
          showFeedback(
            'error',
            `导入失败：文件中的 ${invalidCodesCount} 条条码均不符合“前2位-后8位”规范 (例如: ${sampleInvalidCodes.join(', ')})`
          );
        } else {
          showFeedback('error', '未能从文件中解析到任何有效编码');
        }
        return;
      }
      onImport(validItems, importMode);
      
      if (invalidCodesCount > 0) {
        showFeedback(
          'success',
          `从文件 ${file.name} 中成功导入 ${validItems.length} 条数据。另有 ${invalidCodesCount} 条不符合 xx-xxxxxxxx 规范的格式被过滤跳过 (例如: ${sampleInvalidCodes.join(', ')})`
        );
      } else {
        showFeedback('success', `从文件 ${file.name} 中成功读取并导入了 ${validItems.length} 条数据`);
      }
    };
    reader.onerror = () => {
      showFeedback('error', '读取文件出错');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Pre-fill samples for users to test easily (fixed format conforming to xx-xxxxxxxx)
  const handleLoadSamples = () => {
    const samples: ExpiredItem[] = [
      { code: 'TS-10293847', name: '特仑苏纯牛奶 250ml', location: 'A区冷藏库-03架', importTime: new Date().toISOString() },
      { code: 'FR-97871115', name: '进口菲力牛排 200g', location: 'B区冷冻柜-01架', importTime: new Date().toISOString() },
      { code: 'TS-88010431', name: '全麦切片吐司 350g', location: 'C区常温架-12槽', importTime: new Date().toISOString() },
      { code: 'SG-10293051', name: '鲜榨草莓果汁 1L', location: 'A区冷藏库-05架', importTime: new Date().toISOString() },
      { code: 'XY-20485931', name: '深海鳕鱼排 500g', location: 'B区冷冻柜-04架', importTime: new Date().toISOString() }
    ];
    onImport(samples, 'overwrite');
    showFeedback('success', '已加载5条规范化的示例过期商品数据（符合xx-xxxxxxxx规范），可配合扫码枪或手动查询测试！');
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const downloadCSVTemplate = () => {
    const headers = '商品入库编码/唯一码,商品名称/规格,存放货架/位置,备注说明\n';
    const sampleRows = 'TS-10293847,特仑苏纯牛奶 250ml,A区冷藏库-03架,已过保质期\nFR-97871115,进口菲力牛排 200g,B区冷冻柜-01架,外包装破损\n';
    const csvContent = '\uFEFF' + headers + sampleRows; // BOM for excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '过期商品导入模板.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6" id="import-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">1. 管理过期商品名单 (库)</h2>
          <p className="text-xs text-slate-500 mt-1">
            在此导入或更新仓库已过期的商品编码（支持扫码枪编码或唯一识别码），当前库中共有 <span className="font-semibold text-indigo-600">{expiredList.length}</span> 条数据。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleLoadSamples}
            className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
            id="btn-load-samples"
          >
            加载演示数据
          </button>
          {expiredList.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('确认清空当前的所有过期商品库吗？这不会影响已扫描的记录。')) {
                  onClearAll();
                  showFeedback('success', '已清空过期商品库');
                }
              }}
              className="px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition flex items-center gap-1"
              id="btn-clear-all-expired"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空数据库
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2 text-sm animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
              : 'bg-rose-50 text-rose-800 border border-rose-100'
          }`}
          id="import-feedback"
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{feedback.type === 'success' ? '✔' : '✘'} {feedback.message}</span>
        </div>
      )}

      {/* Main Forms Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Import tools */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-2">数据更新模式</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'overwrite'}
                  onChange={() => setImportMode('overwrite')}
                  className="accent-indigo-600"
                />
                <span className="font-medium text-slate-800">覆盖现有数据</span>
                <span className="text-slate-400">(清除旧的, 只保留本次导入)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="accent-indigo-600"
                />
                <span className="font-medium text-slate-800">追加合并数据</span>
                <span className="text-slate-400">(保留旧的, 叠加本次导入)</span>
              </label>
            </div>
          </div>

          {/* File drag-drop & excel column paste tabs */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <ClipboardPaste className="w-3.5 h-3.5 text-indigo-600" />
                文本粘贴 / CSV文件导入
              </span>
              <button
                type="button"
                onClick={downloadCSVTemplate}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                id="btn-download-template"
              >
                <FileDown className="w-3 h-3" />
                下载CSV模板
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Drag-drop box */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/30'
                }`}
                id="file-drop-area"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-700">拖拽 Excel CSV / TXT 文件到此处</p>
                <p className="text-[11px] text-slate-400 mt-1">或者点击此处进行手动选择文件上传</p>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-medium">或直接在下方粘贴文本</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* Text Area Import */}
              <form onSubmit={handlePasteSubmit} className="space-y-3">
                <div>
                  <textarea
                    rows={4}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="格式举例 (可直接从 Excel 复制整列粘贴):&#10;每行一个编码 (须为 xx-xxxxxxxx 格式，如 TS-10293847)。也支持多列(由逗号或Tab分隔):&#10;TS-10293847, 特仑苏牛奶, A架-03柜&#10;FR-97871115, 菲力牛排, B架-01柜"
                    className="w-full p-2.5 text-xs font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none resize-none"
                    id="import-textarea"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs py-2 px-4 rounded-lg transition shadow-sm flex items-center justify-center gap-1.5"
                  id="btn-import-submit"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  确认解析并导入
                </button>
              </form>
            </div>
          </div>

          {/* Quick single manual input */}
          <form onSubmit={handleManualAdd} className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              单条手动快速录入
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">商品入库编码 (前2后8格式) *</label>
                <input
                  type="text"
                  required
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="如: TS-10293847"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                  id="input-manual-code"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">名称规格 (可选)</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="如: 纯牛奶250ml"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                  id="input-manual-name"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-medium text-slate-500 mb-1">货架位置/存放仓位 (可选)</label>
                <input
                  type="text"
                  value={manualLocation}
                  onChange={(e) => setManualLocation(e.target.value)}
                  placeholder="如: A区冷藏库-03架"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                  id="input-manual-location"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs py-1.5 px-3 rounded-lg transition shadow-sm flex items-center justify-center gap-1"
              id="btn-manual-add"
            >
              <Plus className="w-3.5 h-3.5" />
              添加入库
            </button>
          </form>
        </div>

        {/* Right column: Current database table */}
        <div className="lg:col-span-7 flex flex-col justify-between border border-slate-200 rounded-xl bg-white overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">过期商品电子台账 ({filteredList.length} / {expiredList.length})</span>
            <div className="relative w-full sm:w-48">
              <input
                type="text"
                placeholder="搜索编码、名称、仓位..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-7 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                id="search-expired"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="flex-grow overflow-x-auto min-h-[350px]">
            {paginatedList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400">
                <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs">
                  {searchQuery ? '没有找到匹配的过滤结果' : '过期商品数据库为空，请在左侧导入过期数据'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={handleLoadSamples}
                    className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium underline"
                  >
                    一键加载预置测试条码
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider font-semibold bg-slate-50/50">
                    <th className="py-2.5 px-4">商品编码 (扫码枪读取)</th>
                    <th className="py-2.5 px-4">商品名称 / 规格</th>
                    <th className="py-2.5 px-4">存放位置</th>
                    <th className="py-2.5 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedList.map((item) => (
                    <tr key={item.code} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">{item.code}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-[150px] truncate">{item.name || <span className="text-slate-300">未录入</span>}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-[120px] truncate">{item.location || <span className="text-slate-300">未指定</span>}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            onRemoveItem(item.code);
                            showFeedback('success', `已删除编码 ${item.code}`);
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                          title="移出过期商品名单"
                          id={`delete-expired-${item.code}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50">
              <span className="text-slate-500">
                显示第 {startIndex + 1} 到 {Math.min(startIndex + itemsPerPage, filteredList.length)} 条，共 {filteredList.length} 条记录
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-2.5 py-1 rounded border text-xs transition ${
                    currentPage === 1
                      ? 'border-slate-100 text-slate-300 cursor-not-allowed bg-white'
                      : 'border-slate-200 text-slate-600 hover:bg-white bg-slate-50'
                  }`}
                  id="btn-expired-prev"
                >
                  上一页
                </button>
                <span className="px-3 py-1 font-medium text-slate-700 self-center">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`px-2.5 py-1 rounded border text-xs transition ${
                    currentPage === totalPages
                      ? 'border-slate-100 text-slate-300 cursor-not-allowed bg-white'
                      : 'border-slate-200 text-slate-600 hover:bg-white bg-slate-50'
                  }`}
                  id="btn-expired-next"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
