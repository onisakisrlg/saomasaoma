import React, { useState, useEffect, useRef } from 'react';
import { Scan, Volume2, VolumeX, ShieldAlert, CheckCircle, Flame, Sparkles, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';
import { ExpiredItem, ScanLog, isValidWarehouseCode } from '../types';
import { playNormalScanSound, playExpiredAlertSound, speakText } from '../utils/audio';

interface ScanConsoleProps {
  expiredItems: Record<string, ExpiredItem>;
  onNewScan: (scanCode: string, isMatched: boolean, matchedItem?: ExpiredItem) => ScanLog;
  onUpdateLogStatus: (id: string, status: 'removed' | 'dismissed') => void;
  activeScanLog: ScanLog | null;
  setActiveScanLog: (log: ScanLog | null) => void;
}

export default function ScanConsole({
  expiredItems,
  onNewScan,
  onUpdateLogStatus,
  activeScanLog,
  setActiveScanLog,
}: ScanConsoleProps) {
  const [scanInput, setScanInput] = useState('');
  const [isFocused, setIsFocused] = useState(true);

  // Sound and Speech Settings
  const [enableSound, setEnableSound] = useState(true);
  const [enableVoice, setEnableVoice] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [speechRate, setSpeechRate] = useState(1.0);

  // Stats
  const [sessionCount, setSessionCount] = useState({ total: 0, matched: 0, removed: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Keep input focused so scanner gun scans are always captured
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }

    const handleGlobalClick = (e: MouseEvent) => {
      // If user clicks anywhere inside the scanner console, focus the scan input
      if (consoleRef.current && consoleRef.current.contains(e.target as Node)) {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanInput.trim();
    if (!code) return;

    processBarcode(code);
    setScanInput('');
  };

  const processBarcode = (code: string) => {
    const expiredItem = expiredItems[code];
    const isMatched = !!expiredItem;
    const isValidFormat = isValidWarehouseCode(code);

    // Trigger Audio/Voice
    if (enableSound) {
      if (isMatched) {
        playExpiredAlertSound(volume);
      } else {
        playNormalScanSound(volume);
      }
    }

    if (enableVoice) {
      if (isMatched) {
        const itemInfo = expiredItem.name ? `${expiredItem.name}` : `编号 ${code}`;
        const locationInfo = expiredItem.location ? `，位于 ${expiredItem.location}` : '';
        speakText(`警告：已过期商品，${itemInfo}${locationInfo}，请取出！`, speechRate, volume);
      } else if (!isValidFormat) {
        speakText(`警告：条码格式不符`, speechRate, volume);
      } else {
        speakText(`正常`, speechRate, volume * 0.5);
      }
    }

    // Register scan
    const newLog = onNewScan(code, isMatched, expiredItem);

    // Update session statistics
    setSessionCount(prev => ({
      total: prev.total + 1,
      matched: prev.matched + (isMatched ? 1 : 0),
      removed: prev.removed,
    }));

    // Auto focus back
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  };

  // Simulate scanning a product (for users testing without a physical scan gun)
  const simulateScan = (code: string) => {
    processBarcode(code);
  };

  const handleActionConfirm = () => {
    if (activeScanLog) {
      onUpdateLogStatus(activeScanLog.id, 'removed');
      setSessionCount(prev => ({ ...prev, removed: prev.removed + 1 }));
      // Clear active or set visual indicator
      setActiveScanLog({
        ...activeScanLog,
        status: 'removed',
        removedTime: new Date().toISOString()
      });

      if (enableVoice) {
        speakText('取出确认已记录', speechRate, volume);
      }
    }
  };

  const handleDismiss = () => {
    if (activeScanLog) {
      onUpdateLogStatus(activeScanLog.id, 'dismissed');
      setActiveScanLog(null);
    }
  };

  // List some quick sample codes in expired items for simulator
  const sampleExpiredList = Object.values(expiredItems).slice(0, 4);

  return (
    <div
      ref={consoleRef}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col space-y-6"
      id="scan-console"
    >
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">2. 扫码核对控制台</h2>
          <p className="text-xs text-slate-500 mt-1">
            扫码枪在任意聚焦或点击控制台时即可直接扫码。系统将自动进行数据比对，并伴有语音和提示。
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
          <span className="flex items-center gap-1">
            扫码枪状态:
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${isFocused ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className={isFocused ? 'text-emerald-700' : 'text-amber-700'}>{isFocused ? '就绪 (已聚焦)' : '未聚焦 (点击任意处恢复)'}</span>
          </span>
        </div>
      </div>

      {/* Grid: Stats, Audio, Scanner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Scanning & Alert Panel (Main Area) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          
          {/* Main Visual Scanning Target Input (Acts as physical scan gun sink) */}
          <form onSubmit={handleScanSubmit} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="扫码枪将自动在这里输入商品条码..."
              className="w-full h-16 pl-12 pr-28 text-lg font-mono font-bold tracking-widest border-2 border-dashed border-indigo-200 rounded-xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-600 outline-none text-indigo-900 placeholder:text-slate-400 placeholder:font-sans placeholder:text-sm placeholder:font-normal bg-indigo-50/10 transition text-center"
              id="barcode-input-receiver"
              autoComplete="off"
            />
            <Scan className="w-6 h-6 text-indigo-500 absolute left-4 top-1/2 -translate-y-1/2 animate-pulse" />
            
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition shadow"
              id="btn-scan-trigger"
            >
              手动核对
            </button>
          </form>

          {/* Large Match Status Alert Board */}
          <div className="flex-grow flex flex-col">
            {!activeScanLog ? (
              <div className="flex-grow flex flex-col items-center justify-center border border-slate-200 rounded-xl py-16 px-4 text-center bg-slate-50/50 min-h-[220px]">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 animate-bounce">
                  <Scan className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-700">等待扫码枪输入商品编码...</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  请拿起扫码枪，对准商品的入库条形码或唯一识别码进行扫描。
                </p>
              </div>
            ) : activeScanLog.isMatched ? (
              // EXPIRED ALERT WARNING BOARD
              <div className={`flex-grow border-2 ${activeScanLog.status === 'removed' ? 'border-emerald-500 bg-emerald-50/30' : 'border-rose-500 bg-rose-50/20 animate-pulse-border'} rounded-xl p-6 flex flex-col justify-between min-h-[220px] transition-all`}>
                <div>
                  <div className="flex items-start justify-between">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${activeScanLog.status === 'removed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      <ShieldAlert className="w-4 h-4" />
                      {activeScanLog.status === 'removed' ? '已标记取出 (正常完成)' : '警告：检测到过期商品！'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      扫码时间: {new Date(activeScanLog.scanTime).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">扫描入库码/条码</p>
                    <p className="text-3xl font-mono font-extrabold text-rose-600 mt-1">{activeScanLog.scanCode}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-rose-100/50 shadow-sm">
                    <div>
                      <p className="text-[10px] font-medium text-slate-400">对应商品名称 / 规格</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">
                        {activeScanLog.matchedItem?.name || <span className="text-slate-400 italic font-normal">未命名过期品</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-slate-400">货架位置 / 存放仓位</p>
                      <p className="text-sm font-semibold text-indigo-700 mt-0.5">
                        {activeScanLog.matchedItem?.location || <span className="text-slate-400 italic font-normal">暂无定位信息</span>}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3 pt-4 border-t border-rose-100/50">
                  {activeScanLog.status !== 'removed' ? (
                    <>
                      <button
                        onClick={handleDismiss}
                        className="px-3.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                      >
                        暂不处理
                      </button>
                      <button
                        onClick={handleActionConfirm}
                        className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shadow-md shadow-rose-200 flex items-center gap-1.5"
                        id="btn-confirm-remove"
                      >
                        <CheckCircle className="w-4 h-4" />
                        我已将该商品取出（确认）
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                      <CheckCircle className="w-4 h-4" />
                      已于 {new Date(activeScanLog.removedTime || '').toLocaleTimeString()} 确认取出并存盘
                    </div>
                  )}
                </div>
              </div>
            ) : !isValidWarehouseCode(activeScanLog.scanCode) ? (
              // INVALID CODE FORMAT BOARD
              <div className="flex-grow border border-amber-200 bg-amber-50/10 rounded-xl p-6 flex flex-col justify-between min-h-[220px]">
                <div>
                  <div className="flex items-start justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
                      注意：商品编码格式不符规范 (前2后8)
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      扫码时间: {new Date(activeScanLog.scanTime).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-[11px] font-medium text-slate-400">当前扫描输入</p>
                    <p className="text-3xl font-mono font-extrabold text-amber-600 mt-1">{activeScanLog.scanCode}</p>
                  </div>

                  <div className="mt-4 p-3 bg-white/70 rounded-lg border border-amber-100 text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-amber-800">⚠️ 系统固定入库编码规则：</p>
                    <p>所有导入和核对的商品编码必须为 <span className="font-bold underline">xx-xxxxxxxx</span> (前2位字符-后8位字符) 格式。</p>
                    <p>例如：<span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-700">TS-10293847</span>。</p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end pt-3 border-t border-amber-100">
                  <button
                    onClick={() => setActiveScanLog(null)}
                    className="px-4 py-1.5 text-xs font-medium text-amber-700 hover:text-amber-850 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
                  >
                    清除显示
                  </button>
                </div>
              </div>
            ) : (
              // SAFE / NORMAL PRODUCT BOARD
              <div className="flex-grow border border-emerald-200 bg-emerald-50/10 rounded-xl p-6 flex flex-col justify-between min-h-[220px]">
                <div>
                  <div className="flex items-start justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      <CheckCircle className="w-4 h-4" />
                      正常：未发现仓储过期记录
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      扫码时间: {new Date(activeScanLog.scanTime).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-[11px] font-medium text-slate-400">扫描入库码 / 唯一识别码</p>
                    <p className="text-3xl font-mono font-extrabold text-emerald-600 mt-1">{activeScanLog.scanCode}</p>
                  </div>

                  <div className="mt-4 p-3 bg-white/70 rounded-lg border border-slate-100 text-xs text-slate-500">
                    该商品无仓储过期标记。属于仓库正常周转商品，无需特殊取出动作。
                  </div>
                </div>

                <div className="mt-6 flex justify-end pt-3 border-t border-emerald-100">
                  <button
                    onClick={() => setActiveScanLog(null)}
                    className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-lg transition"
                  >
                    清除显示
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Audio Settings & Quick Gun Simulator */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Audio Adjustments */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>提醒音与语音播报设置</span>
              <span className="text-[10px] font-normal text-slate-400">实效播报模式</span>
            </h3>

            {/* Toggle Switches */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEnableSound(!enableSound)}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                  enableSound
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-white border-slate-200 text-slate-500'
                }`}
              >
                {enableSound ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                蜂鸣器: {enableSound ? '开启' : '关闭'}
              </button>

              <button
                type="button"
                onClick={() => setEnableVoice(!enableVoice)}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                  enableVoice
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-white border-slate-200 text-slate-500'
                }`}
              >
                语音女声: {enableVoice ? '开启' : '关闭'}
              </button>
            </div>

            {/* Range sliders */}
            <div className="space-y-3 pt-2">
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>主音量等级</span>
                  <span>{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>语音播放语速</span>
                  <span>{speechRate.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.5"
                  step="0.1"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Sound test button */}
            <button
              type="button"
              onClick={() => {
                playExpiredAlertSound(volume);
                speakText('系统报警测试：发现仓储过期，请处理！', speechRate, volume);
              }}
              className="w-full py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 text-[11px] font-medium rounded-lg transition hover:bg-slate-50 flex items-center justify-center gap-1"
            >
              <Volume2 className="w-3.5 h-3.5" />
              点击测试：警报声 & 语音
            </button>
          </div>

          {/* Quick Barcode Simulator for testing */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex-grow flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                虚拟扫码枪仿真测试
              </h3>
              <p className="text-[11px] text-slate-400 mb-3">
                即使没有物理扫码枪，也可以点击下方按钮模拟一次“商品扫描动作”进行开发体验：
              </p>

              {/* Expired simulation items */}
              {sampleExpiredList.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-rose-500 block">▲ 模拟扫描 [过期商品] (库中存在):</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {sampleExpiredList.map((item) => (
                      <button
                        key={item.code}
                        onClick={() => simulateScan(item.code)}
                        className="text-left p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-xs text-rose-800 rounded-lg font-mono transition flex justify-between items-center group"
                      >
                        <span className="font-semibold truncate">{item.name || item.code}</span>
                        <span className="text-[10px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-sans">
                          扫此过期条码 <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-1 transition" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white text-slate-400 text-center rounded-lg text-xs italic border border-dashed mb-3">
                  加载演示数据后将在此显示快捷过期条码测试
                </div>
              )}

              {/* Safe simulation items */}
              <div className="space-y-2 mt-4">
                <span className="text-[10px] font-bold text-emerald-600 block">▼ 模拟扫描 [正常商品 / 格式测试]:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => simulateScan('OK-12345678')}
                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-[11px] text-emerald-800 rounded-lg text-center font-mono border border-emerald-100 transition truncate"
                    title="符合xx-xxxxxxxx规范的正常无过期商品"
                  >
                    OK-12345678 (正常)
                  </button>
                  <button
                    onClick={() => simulateScan('6901111222233')}
                    className="p-1.5 bg-amber-50 hover:bg-amber-100 text-[11px] text-amber-800 rounded-lg text-center font-mono border border-amber-100 transition truncate"
                    title="格式不合规的条码/二维码"
                  >
                    6901111222233 (不合规)
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Session Stats */}
            <div className="mt-4 pt-3 border-t border-slate-200/60 grid grid-cols-3 text-center gap-1 bg-white p-2.5 rounded-lg border border-slate-100">
              <div>
                <p className="text-[9px] text-slate-400">本轮已扫</p>
                <p className="text-sm font-extrabold text-slate-700">{sessionCount.total}</p>
              </div>
              <div>
                <p className="text-[9px] text-rose-500 font-semibold">发现过期</p>
                <p className="text-sm font-extrabold text-rose-600">{sessionCount.matched}</p>
              </div>
              <div>
                <p className="text-[9px] text-emerald-600 font-semibold">确认取出</p>
                <p className="text-sm font-extrabold text-emerald-700">{sessionCount.removed}</p>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
