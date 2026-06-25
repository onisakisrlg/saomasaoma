import React, { useState, useEffect } from 'react';
import { Scan, ClipboardList, Database, ShieldAlert, Sparkles, AlertTriangle, BookOpen, Warehouse } from 'lucide-react';
import { ExpiredItem, ScanLog } from './types';
import ImportPanel from './components/ImportPanel';
import ScanConsole from './components/ScanConsole';
import LogTable from './components/LogTable';

// Local storage keys
const STORAGE_EXPIRED_ITEMS = 'warehouse_expired_items_v1';
const STORAGE_SCAN_LOGS = 'warehouse_scan_logs_v1';

// Initial dummy database for easier testing and demonstration (conforming to xx-xxxxxxxx format)
const DEFAULT_EXPIRED_ITEMS: Record<string, ExpiredItem> = {
  'TS-10293847': {
    code: 'TS-10293847',
    name: '特仑苏纯牛奶 250ml',
    location: 'A区冷藏库-03架',
    importTime: new Date().toISOString(),
    notes: '仓储期已满过熟'
  },
  'FR-97871115': {
    code: 'FR-97871115',
    name: '进口菲力牛排 200g',
    location: 'B区冷冻柜-01架',
    importTime: new Date().toISOString(),
    notes: '已超时保质期2天'
  },
  'TS-88010431': {
    code: 'TS-88010431',
    name: '全麦切片吐司 350g',
    location: 'C区常温架-12槽',
    importTime: new Date().toISOString(),
    notes: '过期变质商品'
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'scan' | 'db'>('scan');

  // Load state from LocalStorage
  const [expiredItems, setExpiredItems] = useState<Record<string, ExpiredItem>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_EXPIRED_ITEMS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load expired items from localStorage', e);
    }
    return DEFAULT_EXPIRED_ITEMS;
  });

  const [scanLogs, setScanLogs] = useState<ScanLog[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_SCAN_LOGS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load scan logs from localStorage', e);
    }
    return [];
  });

  // Current active scan for the focus alert panel
  const [activeScanLog, setActiveScanLog] = useState<ScanLog | null>(null);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_EXPIRED_ITEMS, JSON.stringify(expiredItems));
  }, [expiredItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_SCAN_LOGS, JSON.stringify(scanLogs));
  }, [scanLogs]);

  // Actions
  const handleImportItems = (newItems: ExpiredItem[], mode: 'overwrite' | 'append') => {
    setExpiredItems(prev => {
      const updated = mode === 'overwrite' ? {} : { ...prev };
      newItems.forEach(item => {
        updated[item.code] = item;
      });
      return updated;
    });
  };

  const handleRemoveExpiredItem = (code: string) => {
    setExpiredItems(prev => {
      const updated = { ...prev };
      delete updated[code];
      return updated;
    });
  };

  const handleClearExpiredItems = () => {
    setExpiredItems({});
  };

  const handleNewScan = (scanCode: string, isMatched: boolean, matchedItem?: ExpiredItem): ScanLog => {
    const newLog: ScanLog = {
      id: Math.random().toString(36).substring(2, 11),
      scanCode,
      scanTime: new Date().toISOString(),
      isMatched,
      matchedItem,
      status: isMatched ? 'pending' : 'dismissed'
    };

    setScanLogs(prev => [newLog, ...prev]);
    setActiveScanLog(newLog);
    return newLog;
  };

  const handleUpdateLogStatus = (id: string, status: 'removed' | 'dismissed') => {
    setScanLogs(prev => prev.map(log => {
      if (log.id === id) {
        return {
          ...log,
          status,
          removedTime: status === 'removed' ? new Date().toISOString() : undefined
        };
      }
      return log;
    }));
  };

  const handleRemoveLog = (id: string) => {
    setScanLogs(prev => prev.filter(log => log.id !== id));
    if (activeScanLog?.id === id) {
      setActiveScanLog(null);
    }
  };

  const handleClearLogs = () => {
    setScanLogs([]);
    setActiveScanLog(null);
  };

  // Helper Stats for general header dashboard
  const expiredDbSize = Object.keys(expiredItems).length;
  const unresolvedExpiredCount = scanLogs.filter(log => log.isMatched && log.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 font-sans" id="app-root">
      {/* Top Professional Header */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            
            {/* Branding Logo & Description */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                <Warehouse className="w-5.5 h-5.5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  仓库过期商品扫码核对系统
                  <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">企业级</span>
                </h1>
                <p className="text-xs text-slate-500">扫码枪实效比对核销 • 异常高音蜂鸣 • 语音播报提报 • 生成异常报表</p>
              </div>
            </div>

            {/* General Dashboard Mini Widgets */}
            <div className="flex items-center gap-2 sm:gap-4 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <div className="bg-slate-50 border border-slate-100 px-3.5 py-1.5 rounded-xl text-center flex-shrink-0 min-w-[90px]">
                <p className="text-[10px] font-medium text-slate-400">过期名单库容量</p>
                <p className="text-sm font-bold text-slate-800">{expiredDbSize} 件商品</p>
              </div>

              <div className="bg-slate-50 border border-slate-100 px-3.5 py-1.5 rounded-xl text-center flex-shrink-0 min-w-[90px]">
                <p className="text-[10px] font-medium text-slate-400">今日总扫码核对</p>
                <p className="text-sm font-bold text-slate-800">{scanLogs.length} 次</p>
              </div>

              {unresolvedExpiredCount > 0 ? (
                <div className="bg-rose-50 border border-rose-100 px-3.5 py-1.5 rounded-xl text-center flex-shrink-0 min-w-[90px] animate-pulse">
                  <p className="text-[10px] font-semibold text-rose-500 flex items-center justify-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" />
                    未取出异常
                  </p>
                  <p className="text-sm font-extrabold text-rose-600">{unresolvedExpiredCount} 件</p>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 px-3.5 py-1.5 rounded-xl text-center flex-shrink-0 min-w-[90px]">
                  <p className="text-[10px] font-medium text-emerald-600">异常清空状态</p>
                  <p className="text-sm font-bold text-emerald-700">全部安全</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Navigation Tabs - Separating scan work from database setup */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-bold transition ${
              activeTab === 'scan'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            id="tab-scan-station"
          >
            <Scan className="w-4 h-4" />
            📋 扫码核对工作台
          </button>
          <button
            onClick={() => setActiveTab('db')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-bold transition ${
              activeTab === 'db'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            id="tab-db-manager"
          >
            <Database className="w-4 h-4" />
            ⚙ 过期名单库管理 ({expiredDbSize})
          </button>
        </div>

        {/* Tab Contents */}
        <div className="space-y-6">
          {activeTab === 'scan' ? (
            <div className="space-y-6 animate-fade-in">
              {/* Scan Console */}
              <ScanConsole
                expiredItems={expiredItems}
                onNewScan={handleNewScan}
                onUpdateLogStatus={handleUpdateLogStatus}
                activeScanLog={activeScanLog}
                setActiveScanLog={setActiveScanLog}
              />

              {/* Log History & Report Exporter */}
              <LogTable
                scanLogs={scanLogs}
                onUpdateStatus={handleUpdateLogStatus}
                onClearLogs={handleClearLogs}
                onRemoveLog={handleRemoveLog}
              />
            </div>
          ) : (
            <div className="animate-fade-in">
              {/* Import Panel */}
              <ImportPanel
                expiredItems={expiredItems}
                onImport={handleImportItems}
                onRemoveItem={handleRemoveExpiredItem}
                onClearAll={handleClearExpiredItems}
              />
            </div>
          )}
        </div>

        {/* User Manual Guidelines */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5" id="user-manual">
          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            仓库物理扫码枪使用指导手册 (Scanner Gun Operations)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-800 block mb-1">① 导入过期编码库</span>
              点击上方的“过期名单库管理”标签，复制 Excel 里的过期商品编号，粘贴或拖拽 CSV 导入。支持指定名称和仓位，方便听到警报后精确定位货架。
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-800 block mb-1">② 扫码枪自动配对</span>
              将物理扫码枪通过 USB 或蓝牙接入电脑/手机。在“扫码核对工作台”页面，直接扣动扳机扫描商品。程序会瞬间自动聚焦比对、蜂鸣警报并发出中文播报。
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-800 block mb-1">③ 确认取出与导出</span>
              匹配到过期商品时，请将其从货架中取出，并在控制台上点击“确认取出”存盘。最后点击“导出异常提醒报表”，即可生成专用于归档或后续批注处理的电子表格！
            </div>
          </div>
        </div>

      </main>

      {/* Footer Info */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 mt-12">
        <p>© 仓库过期商品扫码核对与应急取出监督管理系统 • 离线数据高防丢失设计</p>
      </footer>
    </div>
  );
}
