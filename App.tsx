
import React, { useState, useRef, useCallback } from 'react';
import * as agPsd from 'ag-psd';
import { PSDLayer, AtlasRegion, ProcessingStatus, CoordinateSystem } from './types';
import { packAtlas, generateBinaryData } from './services/psdProcessor';
import { getIntegrationHelp } from './services/geminiService';

// Icons
const FolderIcon = () => <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>;
const DownloadIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
const HelpIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const LightningIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const DesktopIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;

const App: React.FC = () => {
  const [layers, setLayers] = useState<PSDLayer[]>([]);
  const [psdData, setPsdData] = useState<any>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ step: 'Idle', progress: 0, isComplete: false });
  const [atlasData, setAtlasData] = useState<{ regions: AtlasRegion[]; width: number; height: number; canvas: HTMLCanvasElement } | null>(null);
  const [coordSystem, setCoordSystem] = useState<CoordinateSystem>(CoordinateSystem.TOP_LEFT);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [showDeployHelp, setShowDeployHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processPsd = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.psd')) {
      setStatus({ step: 'Error', progress: 0, isComplete: false, error: '请上传有效的 .psd 文件' });
      return;
    }

    try {
      setStatus({ step: '正在读取文件...', progress: 10, isComplete: false });
      const buffer = await file.arrayBuffer();
      
      setStatus({ step: '正在解析图层...', progress: 30, isComplete: false });
      const psd = agPsd.readPsd(buffer, { skipLayerImageData: false, skipThumbnail: true });
      setPsdData(psd);

      const extractedLayers: PSDLayer[] = [];
      const flattenLayers = (psdLayers: any[]) => {
        psdLayers.forEach(layer => {
          if (layer.canvas && layer.width > 0 && layer.height > 0) {
            extractedLayers.push({
              name: layer.name,
              top: layer.top,
              left: layer.left,
              bottom: layer.bottom,
              right: layer.right,
              width: layer.width,
              height: layer.height,
              opacity: layer.opacity,
              canvas: layer.canvas
            });
          }
          if (layer.children) flattenLayers(layer.children);
        });
      };

      if (psd.children) flattenLayers(psd.children);
      setLayers(extractedLayers);

      if (extractedLayers.length === 0) {
        throw new Error("未在 PSD 中找到有效的可见图层内容");
      }

      setStatus({ step: '正在生成图集...', progress: 60, isComplete: false });
      const packing = packAtlas(extractedLayers);
      
      const atlasCanvas = document.createElement('canvas');
      atlasCanvas.width = packing.width;
      atlasCanvas.height = packing.height;
      const ctx = atlasCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, packing.width, packing.height);
        packing.regions.forEach(region => {
          const layer = extractedLayers.find(l => l.name === region.name);
          if (layer?.canvas) {
            ctx.drawImage(layer.canvas, region.x, region.y);
          }
        });
      }

      setAtlasData({ ...packing, canvas: atlasCanvas });
      setStatus({ step: '转换完成!', progress: 100, isComplete: true });

      const insight = await getIntegrationHelp(packing.regions.length, packing.width, packing.height);
      setAiInsight(insight || '');

    } catch (err: any) {
      console.error(err);
      setStatus({ step: '错误', progress: 0, isComplete: false, error: err.message });
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processPsd(file);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const downloadAtlas = () => {
    if (!atlasData) return;
    const link = document.createElement('a');
    link.download = 'sprite_atlas.png';
    link.href = atlasData.canvas.toDataURL('image/png');
    link.click();
  };

  const downloadBinary = () => {
    if (!atlasData || !psdData) return;
    const buffer = generateBinaryData(atlasData.regions, psdData.width, psdData.height, coordSystem);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.download = 'layout_config.bin';
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-200">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-white/5 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <LightningIcon />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">PSD 自动图集工具</h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Standalone & Web Version</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowDeployHelp(true)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-sm border border-white/5"
          >
            <DesktopIcon />
            <span>生成安装包</span>
          </button>

          <div className="h-6 w-px bg-white/10 mx-2" />

          <select 
            className="bg-slate-800 border border-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-300"
            value={coordSystem}
            onChange={(e) => setCoordSystem(e.target.value as CoordinateSystem)}
          >
            <option value={CoordinateSystem.TOP_LEFT}>Web 坐标系 (Top-Left)</option>
            <option value={CoordinateSystem.BOTTOM_LEFT}>Unity 坐标系 (Bottom-Left)</option>
          </select>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-lg font-bold text-sm transition-all flex items-center space-x-2 shadow-xl shadow-blue-600/20 hover:-translate-y-0.5"
          >
            <span>导入 PSD</span>
          </button>
          <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && processPsd(e.target.files[0])} accept=".psd" className="hidden" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden max-w-[1600px] mx-auto w-full">
        {/* (此处保持原有的界面布局不变，已省略部分代码以节省篇幅) */}
        {/* ... */}
        
        {/* Left: Layers & Info */}
        <div className="lg:col-span-3 flex flex-col space-y-6">
          <section className="bg-slate-900/40 rounded-2xl border border-white/5 flex flex-col overflow-hidden h-full">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-800/20">
              <h2 className="font-bold text-sm text-slate-400 uppercase tracking-wider">图层列表</h2>
              <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-slate-500">{layers.length} 个对象</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
              {layers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 italic p-8 text-center text-sm">
                  <p>暂无数据</p>
                </div>
              ) : (
                layers.map((layer, idx) => (
                  <div key={idx} className="flex items-center p-2.5 rounded-xl hover:bg-white/5 transition-all group border border-transparent hover:border-white/5">
                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center mr-3 overflow-hidden ring-1 ring-white/5 shadow-inner">
                       {layer.canvas && (
                         <img src={layer.canvas.toDataURL()} className="max-w-full max-h-full object-contain" alt={layer.name} />
                       )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-slate-300">{layer.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{layer.width} × {layer.height}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Center: Preview & Landing */}
        <div className="lg:col-span-6 flex flex-col space-y-8 h-full">
          {!atlasData && status.step === 'Idle' ? (
            <div 
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={`flex-1 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 ${
                isDragging ? 'border-blue-500 bg-blue-500/10 scale-[0.99]' : 'border-white/10 bg-slate-900/20 hover:border-white/20'
              }`}
            >
              <div className="p-8 rounded-full bg-slate-900 border border-white/5 mb-6 shadow-2xl">
                <FolderIcon />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">拖拽 PSD 文件至此处</h2>
              <p className="text-slate-500 text-sm mb-8">我们将自动完成图集打包、坐标提取与格式转换</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-8 py-3 bg-white text-slate-950 font-bold rounded-xl hover:bg-slate-200 transition-colors shadow-lg shadow-white/5"
              >
                从本地选择文件
              </button>
            </div>
          ) : (
            <div className="flex-1 bg-slate-950 rounded-3xl border border-white/10 relative overflow-hidden flex items-center justify-center p-12 group shadow-2xl">
              <div className="relative max-w-full max-h-full overflow-auto custom-scrollbar flex items-center justify-center p-4">
                <canvas 
                  ref={(canvas) => {
                    if (canvas && atlasData) {
                      canvas.width = atlasData.width;
                      canvas.height = atlasData.height;
                      const ctx = canvas.getContext('2d');
                      ctx?.drawImage(atlasData.canvas, 0, 0);
                    }
                  }}
                  className="shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] rounded-lg transition-transform"
                />
              </div>
              
              {status.step !== 'Idle' && !status.isComplete && (
                <div className="absolute inset-0 bg-[#0b0f19]/90 backdrop-blur-xl flex flex-col items-center justify-center z-10">
                  <div className="w-80 h-1.5 bg-white/5 rounded-full overflow-hidden mb-6">
                    <div className="h-full bg-blue-500 transition-all duration-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ width: `${status.progress}%` }} />
                  </div>
                  <p className="text-