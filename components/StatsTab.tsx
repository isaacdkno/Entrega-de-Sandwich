
import { Order, OrderStatus, ProductionBranch, PaymentStatus } from '../types';
import { PICKUP_DATES, PRODUCTION_BRANCHES, PICKUP_BRANCHES } from '../constants';
import { analyzeOrders } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { BrainCircuit, Loader2, RefreshCw, Filter, Download, Send, DollarSign, Store, BarChart3, TrendingUp, Package, MessageSquareQuote, Sigma, ShieldCheck, Ticket, AlertCircle, Key, ExternalLink } from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';

interface StatsTabProps {
  orders: Order[];
}

export const StatsTab: React.FC<StatsTabProps> = ({ orders }) => {
  const [selectedDate, setSelectedDate] = useState(PICKUP_DATES[0]); 
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  const [chartMetric, setChartMetric] = useState<'units' | 'orders'>('units');
  
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [customAiPrompt, setCustomAiPrompt] = useState('');
  
  // Estados de la API Key: null (verificando), false (falta vincular), true (lista)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    
    const checkKey = async () => {
      const win = window as any;
      if (win.aistudio) {
        try {
          const hasKey = await win.aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } catch (e) {
          console.error("Error checking API key status:", e);
          setHasApiKey(false);
        }
      } else {
        // Entorno fuera de AI Studio (ej: desarrollo local con .env)
        setHasApiKey(true);
      }
    };
    checkKey();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleOpenKeySelector = async () => {
    const win = window as any;
    if (win.aistudio) {
      try {
        await win.aistudio.openSelectKey();
        // Asumimos éxito por flujo de la plataforma y procedemos
        setHasApiKey(true);
        setAiAnalysis(null);
      } catch (e) {
        console.error("Error opening key selector:", e);
      }
    }
  };

  const dateOrders = useMemo(() => orders.filter(o => o.pickupDate === selectedDate), [orders, selectedDate]);

  const displayedOrders = useMemo(() => {
    if (selectedFactory === 'ALL') return dateOrders;
    return dateOrders.filter(o => o.originBranch === selectedFactory);
  }, [dateOrders, selectedFactory]);

  const handleExportCSV = () => {
    if (displayedOrders.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }
    const headers = ["Nro Comanda", "Fecha Retiro", "Hora", "Cliente", "Telefono", "Direccion", "Sucursal Retiro", "Fabrica Origen", "Triples", "Simples", "Seña", "Estado Pago", "Estado Pedido", "Ubicacion", "Notas"];
    const rows = displayedOrders.map(o => [o.id, o.pickupDate, o.pickupTime, `"${o.customerName}"`, `"${o.phone}"`, `"${o.address}"`, o.pickupBranch, o.originBranch, o.qtyTriples, o.qtySimples, o.deposit, o.paymentStatus || 'No definido', o.status, o.location || '', `"${o.notes.replace(/\n/g, ' ')}"`]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Pedidos_${selectedDate.replace(/\//g, '-')}_${selectedFactory}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { branchStats, globalTotal, finances } = useMemo(() => {
    const stats: Record<string, { t: number; s: number; prod: number; deliv: number }> = {};
    PICKUP_BRANCHES.forEach(b => { stats[b.label] = { t: 0, s: 0, prod: 0, deliv: 0 }; });
    
    let gT = 0, gS = 0, gTotal = 0;
    let fPaid = 0, fPartial = 0, fUnpaid = 0;

    displayedOrders.forEach(o => {
        const branchObj = PICKUP_BRANCHES.find(b => b.value === o.pickupBranch);
        const branchLabel = branchObj ? branchObj.label : o.pickupBranch;
        if (!stats[branchLabel]) stats[branchLabel] = { t: 0, s: 0, prod: 0, deliv: 0 };
        
        stats[branchLabel].t += o.qtyTriples;
        stats[branchLabel].s += o.qtySimples;
        gT += o.qtyTriples;
        gS += o.qtySimples;
        gTotal += (o.qtyTriples + o.qtySimples);

        if (o.location) stats[branchLabel].prod += (o.qtyTriples + o.qtySimples);
        if (o.status === OrderStatus.DELIVERED) stats[branchLabel].deliv += (o.qtyTriples + o.qtySimples);

        if (o.paymentStatus === PaymentStatus.PAID) fPaid++;
        else if (o.paymentStatus === PaymentStatus.PARTIAL) fPartial++;
        else fUnpaid++;
    });

    const bStats = Object.entries(stats).map(([name, data]) => {
        const total = data.t + data.s;
        return {
            name,
            triples: data.t,
            simples: data.s,
            total,
            prodUnits: data.prod,
            delivUnits: data.deliv,
            prodPercent: total > 0 ? Math.round((data.prod / total) * 100) : 0,
            delivPercent: total > 0 ? Math.round((data.deliv / total) * 100) : 0,
        };
    }).sort((a, b) => b.total - a.total);

    return { 
        branchStats: bStats, 
        globalTotal: { name: 'TOTAL GENERAL', triples: gT, simples: gS, total: gTotal },
        finances: { paid: fPaid, partial: fPartial, unpaid: fUnpaid }
    };
  }, [displayedOrders]);

  const hourlyChartData = useMemo(() => {
    const hourMap: Record<string, { hour: string; Triples: number; Simples: number; Comandas: number }> = {};
    displayedOrders.forEach(o => {
      const h = (o.pickupTime || '00:00').split(':')[0] + ':00';
      if (!hourMap[h]) hourMap[h] = { hour: h, Triples: 0, Simples: 0, Comandas: 0 };
      hourMap[h].Triples += o.qtyTriples;
      hourMap[h].Simples += o.qtySimples;
      hourMap[h].Comandas += 1;
    });
    return Object.values(hourMap).sort((a, b) => a.hour.localeCompare(b.hour));
  }, [displayedOrders]);

  const handleAiAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (displayedOrders.length === 0) {
      setAiAnalysis("No hay datos cargados para analizar.");
      return;
    }

    if (hasApiKey === false) {
      await handleOpenKeySelector();
      return;
    }
    
    setIsLoadingAi(true);
    setAiAnalysis(null);
    
    const scopeName = selectedFactory === 'ALL' ? 'Total Global' : `Fábrica ${selectedFactory}`;
    
    try {
      const result = await analyzeOrders(displayedOrders, selectedDate, scopeName, customAiPrompt);
      setAiAnalysis(result);
      setCustomAiPrompt(''); // Limpiar después de éxito
    } catch (err: any) {
      console.error("StatsTab AI error:", err);
      if (err.message?.includes('entity was not found')) {
          setHasApiKey(false);
      }
      setAiAnalysis(err.message || `⚠️ Error de conexión con la IA.`);
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 pb-24">
      {/* Filtros */}
      <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3 uppercase">
            <BarChart3 className="text-orange-600" size={28} /> Tablero de Estadísticas
        </h2>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
          <div className="relative w-full sm:w-auto">
             <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={14} />
             <select value={selectedFactory} onChange={e => { setSelectedFactory(e.target.value); setAiAnalysis(null); }} className="w-full sm:w-auto pl-8 pr-8 py-2 border border-slate-300 rounded-xl font-bold text-xs text-slate-700 bg-white shadow-sm outline-none appearance-none cursor-pointer hover:border-orange-400 transition-colors">
               <option value="ALL">Todas las Fábricas</option>
               {PRODUCTION_BRANCHES.map(b => (
                 <option key={b.value} value={b.value}>{b.label}</option>
               ))}
             </select>
          </div>
          <div className="relative w-full sm:w-auto">
             <select value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setAiAnalysis(null); }} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-xl font-black text-xs text-slate-800 bg-white shadow-sm outline-none cursor-pointer">
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={handleExportCSV} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-emerald-700 shadow-sm transition-all active:scale-95">
              <Download size={16} /> EXCEL
          </button>
        </div>
      </div>

      {/* Tarjetas Financieras */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-full text-emerald-600"><DollarSign size={20} strokeWidth={3} /></div>
            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pagados Total</p><p className="text-xl font-black text-slate-800">{finances.paid}</p></div>
         </div>
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-full text-amber-600"><DollarSign size={20} strokeWidth={3} /></div>
            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Con Seña</p><p className="text-xl font-black text-slate-800">{finances.partial}</p></div>
         </div>
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="bg-rose-100 p-3 rounded-full text-rose-600"><DollarSign size={20} strokeWidth={3} /></div>
            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Falta Abonar</p><p className="text-xl font-black text-slate-800">{finances.unpaid}</p></div>
         </div>
      </div>

      {/* Gráfico Horario e Interacción IA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
         <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
               <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter text-sm">
                  <Package size={18} className="text-blue-600" /> Distribución Horaria
               </h3>
               
               <div className="bg-slate-100 p-1 rounded-xl flex gap-1 shadow-inner w-full sm:w-auto">
                  <button onClick={() => setChartMetric('units')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${chartMetric === 'units' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Sigma size={12} /> Unidades
                  </button>
                  <button onClick={() => setChartMetric('orders')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${chartMetric === 'orders' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Ticket size={12} /> Comandas
                  </button>
               </div>
            </div>

            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyChartData} margin={{ top: 50, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                  <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', fontSize: '10px'}} />
                  <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px'}} />
                  {chartMetric === 'units' ? (
                    <>
                      <Bar name="Triples" dataKey="Triples" fill="#2563eb" radius={[6, 6, 0, 0]}>
                        {!isMobile && <LabelList dataKey="Triples" position="top" style={{ fontSize: '11px', fontWeight: '900', fill: '#1e40af' }} />}
                      </Bar>
                      <Bar name="Simples" dataKey="Simples" fill="#ea580c" radius={[6, 6, 0, 0]}>
                        {!isMobile && <LabelList dataKey="Simples" position="top" style={{ fontSize: '11px', fontWeight: '900', fill: '#9a3412' }} />}
                      </Bar>
                    </>
                  ) : (
                    <Bar name="Comandas" dataKey="Comandas" fill="#0f172a" radius={[6, 6, 0, 0]}>
                      {!isMobile && <LabelList dataKey="Comandas" position="top" style={{ fontSize: '12px', fontWeight: '900', fill: '#0f172a' }} />}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         {/* Panel IA */}
         <div className="bg-slate-900 rounded-3xl shadow-xl overflow-hidden flex flex-col min-h-[400px]">
            <div className="p-5 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-2">
                 <div className="bg-orange-500 p-2 rounded-xl shadow-lg">
                    <BrainCircuit className="text-white" size={20} />
                 </div>
                 <div>
                    <h4 className="text-white font-black uppercase text-[11px] tracking-widest leading-none mb-0.5">Asistente Gemini</h4>
                    <p className="text-[9px] text-orange-400 font-bold uppercase tracking-widest">IA Inteligente</p>
                 </div>
              </div>
            </div>
            
            <div className="p-4 flex-1 flex flex-col gap-3 overflow-hidden">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-slate-800/30 rounded-xl border border-slate-700/50 text-slate-300 text-xs leading-relaxed font-medium">
                {hasApiKey === null ? (
                   <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
                      <Loader2 className="animate-spin" size={24} />
                      <p className="font-bold text-[10px] uppercase tracking-widest">Verificando conexión...</p>
                   </div>
                ) : hasApiKey === false ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <div className="bg-orange-500/10 p-4 rounded-full mb-4">
                        <Key className="text-orange-500" size={32} />
                      </div>
                      <h5 className="text-white font-black uppercase text-xs mb-2 tracking-widest">IA Desconectada</h5>
                      <p className="text-[10px] text-slate-400 font-bold mb-6 leading-relaxed">
                        Para habilitar el análisis inteligente, debés vincular una cuenta de Google Cloud con facturación activa.
                      </p>
                      <button onClick={handleOpenKeySelector} className="bg-orange-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all flex items-center gap-2 shadow-lg shadow-orange-900/40 active:scale-95">
                         Vincular Cuenta <ExternalLink size={14} />
                      </button>
                      <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[9px] text-slate-500 mt-4 underline hover:text-slate-300">Docs Facturación</a>
                  </div>
                ) : isLoadingAi ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
                    <Loader2 className="animate-spin" size={24} />
                    <p className="font-bold text-[10px] animate-pulse uppercase tracking-widest">Pensando...</p>
                  </div>
                ) : aiAnalysis ? (
                  <div className={`animate-fade-in whitespace-pre-wrap ${aiAnalysis.includes('⚠️') ? 'text-orange-400 font-bold' : 'text-slate-300'}`}>
                    {aiAnalysis}
                  </div>
                ) : (
                  <div className="text-slate-500 text-center py-4 italic flex flex-col items-center gap-2 h-full justify-center">
                    <div className="flex items-center gap-1 text-emerald-500 mb-2">
                       <ShieldCheck size={16} />
                       <span className="text-[9px] font-black uppercase tracking-widest">Listo</span>
                    </div>
                    <MessageSquareQuote size={24} className="opacity-10" />
                    <p className="text-[10px] uppercase font-black opacity-50 tracking-widest">¿Querés un balance del día?</p>
                  </div>
                )}
              </div>

              {hasApiKey === true && (
                <>
                  <div className="space-y-1">
                      <textarea 
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs focus:border-orange-500 outline-none transition-all placeholder:text-slate-600 resize-none font-bold shadow-inner"
                        rows={2}
                        placeholder="Escribí una consulta a la IA..."
                        value={customAiPrompt}
                        onChange={e => setCustomAiPrompt(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiAnalysis(); } }}
                      />
                  </div>
                  <button onClick={() => handleAiAnalysis()} disabled={isLoadingAi || displayedOrders.length === 0} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 disabled:opacity-30 ${customAiPrompt.trim() !== '' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white text-slate-900 hover:bg-orange-50'}`}>
                    {isLoadingAi ? <Loader2 className="animate-spin" size={14} /> : (customAiPrompt.trim() !== '' ? <Send size={14} /> : <RefreshCw size={14} />)}
                    {isLoadingAi ? 'PENSANDO...' : (customAiPrompt.trim() !== '' ? 'ENVIAR CONSULTA' : 'GENERAR ANÁLISIS')}
                  </button>
                </>
              )}
            </div>
         </div>
      </div>

      {/* Carga por Sucursal */}
      <div className="mb-6">
        <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-tighter text-sm">
          <Store size={18} className="text-orange-600" /> Carga por Sucursal
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-orange-600 p-3 rounded-xl shadow-lg border-2 border-orange-500">
              <div className="flex items-center gap-1 border-b border-white/30 pb-1 mb-2">
                <Sigma size={12} className="text-white" />
                <p className="text-[9px] font-black text-white uppercase truncate">TOTAL GENERAL</p>
              </div>
              <div className="flex justify-between items-end">
                 <span className="text-2xl font-black text-white">{globalTotal.total}</span>
                 <span className="text-[8px] font-bold text-orange-100 uppercase">Unid</span>
              </div>
            </div>
            {branchStats.map(stat => (
              <div key={stat.name} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-2 border-b pb-1 truncate">{stat.name}</p>
                <div className="flex justify-between items-end">
                   <span className="text-xl font-black text-slate-900">{stat.total}</span>
                   <span className="text-[8px] font-bold text-slate-400 uppercase">Unid</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Progreso Operativo */}
      <div>
        <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-tighter text-sm"><TrendingUp size={18} className="text-blue-600" /> Progreso Operación</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branchStats.filter(s => s.total > 0).slice(0, 6).map(stat => (
              <div key={stat.name} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                 <div className="flex justify-between items-center mb-3">
                    <h4 className="font-black text-slate-800 uppercase text-xs truncate max-w-[120px]">{stat.name}</h4>
                    <span className="bg-slate-50 px-2 py-0.5 rounded text-[8px] font-black text-slate-500 uppercase">{stat.total} UNID</span>
                 </div>
                 <div className="space-y-3">
                    <div>
                       <div className="flex justify-between text-[8px] font-black uppercase text-slate-400 mb-1">
                          <span>Producción</span>
                          <span>{stat.prodPercent}%</span>
                       </div>
                       <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${stat.prodPercent}%` }}></div>
                       </div>
                    </div>
                    <div>
                       <div className="flex justify-between text-[8px] font-black uppercase text-slate-400 mb-1">
                          <span>Entrega</span>
                          <span>{stat.delivPercent}%</span>
                       </div>
                       <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stat.delivPercent}%` }}></div>
                       </div>
                    </div>
                 </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
