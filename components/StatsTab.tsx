import { Order, OrderStatus, ProductionBranch, PaymentStatus } from '../types';
import { PICKUP_DATES, PRODUCTION_BRANCHES, PICKUP_BRANCHES } from '../constants';
import { analyzeOrders } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { BrainCircuit, Loader2, RefreshCw, Filter, Download, Send, DollarSign, Store, BarChart3, TrendingUp, Package, MessageSquareQuote, Sigma, ShieldCheck, Ticket, AlertCircle } from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface StatsTabProps {
  orders: Order[];
}

export const StatsTab: React.FC<StatsTabProps> = ({ orders }) => {
  const [selectedDate, setSelectedDate] = useState(PICKUP_DATES[0]); 
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [customAiPrompt, setCustomAiPrompt] = useState('');

  const dateOrders = useMemo(() => orders.filter(o => o.pickupDate === selectedDate), [orders, selectedDate]);

  const displayedOrders = useMemo(() => {
    if (selectedFactory === 'ALL') return dateOrders;
    return dateOrders.filter(o => o.originBranch === selectedFactory);
  }, [dateOrders, selectedFactory]);

  const { branchStats, globalTotal, finances } = useMemo(() => {
    const stats: Record<string, { t: number; s: number; prod: number; deliv: number }> = {};
    PICKUP_BRANCHES.forEach(b => { stats[b.label] = { t: 0, s: 0, prod: 0, deliv: 0 }; });
    
    let gT = 0, gS = 0, gTotal = 0;
    let fPaid = 0, fPartial = 0, fUnpaid = 0;

    displayedOrders.forEach(o => {
        const branchLabel = PICKUP_BRANCHES.find(b => b.value === o.pickupBranch)?.label || o.pickupBranch;
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

    return { 
        branchStats: Object.entries(stats).map(([name, data]) => {
            const total = data.t + data.s;
            return {
                name, total,
                prodPercent: total > 0 ? Math.round((data.prod / total) * 100) : 0,
                delivPercent: total > 0 ? Math.round((data.deliv / total) * 100) : 0,
            };
        }).sort((a, b) => b.total - a.total),
        globalTotal: { total: gTotal },
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

  const handleAiAnalysis = async () => {
    if (displayedOrders.length === 0) return;
    setIsLoadingAi(true);
    setAiAnalysis(null);
    try {
      const result = await analyzeOrders(displayedOrders, selectedDate, selectedFactory, customAiPrompt);
      setAiAnalysis(result);
      setCustomAiPrompt('');
    } catch (err: any) {
      setAiAnalysis("Error al conectar con la IA.");
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 pb-24">
      {/* Filtros */}
      <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase">
            <BarChart3 className="text-orange-600" size={24} /> Tablero de Control
        </h2>
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <select value={selectedFactory} onChange={e => setSelectedFactory(e.target.value)} className="flex-1 lg:flex-none p-2 border border-slate-300 rounded-xl font-bold text-[10px] uppercase bg-white">
            <option value="ALL">Todas las Fábricas</option>
            {PRODUCTION_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="flex-1 lg:flex-none p-2 border border-slate-300 rounded-xl font-black text-[10px] uppercase bg-white">
            {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Tarjetas Financieras */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
         <div className="bg-slate-900 p-4 rounded-2xl shadow-lg text-white">
            <p className="text-[10px] font-black uppercase opacity-60">Total Unidades</p>
            <p className="text-3xl font-black">{globalTotal.total}</p>
         </div>
         <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><DollarSign size={20} /></div>
            <div><p className="text-[9px] font-black text-slate-400 uppercase">Pagados</p><p className="text-xl font-black text-slate-800">{finances.paid}</p></div>
         </div>
         <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><DollarSign size={20} /></div>
            <div><p className="text-[9px] font-black text-slate-400 uppercase">Señados</p><p className="text-xl font-black text-slate-800">{finances.partial}</p></div>
         </div>
         <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="bg-rose-100 p-2 rounded-lg text-rose-600"><AlertCircle size={20} /></div>
            <div><p className="text-[9px] font-black text-slate-400 uppercase">Pendientes</p><p className="text-xl font-black text-slate-800">{finances.unpaid}</p></div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Gráfico */}
         <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 uppercase text-[10px] tracking-widest">
               <Package size={16} className="text-blue-600" /> Curva de Producción
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                  <Tooltip />
                  <Bar name="Comandas" dataKey="Comandas" fill="#0f172a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         {/* Panel IA */}
         <div className="bg-slate-900 rounded-3xl shadow-xl overflow-hidden flex flex-col min-h-[450px]">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center gap-3">
              <div className="bg-orange-500 p-2 rounded-xl shadow-lg shadow-orange-900/40"><BrainCircuit className="text-white" size={20} /></div>
              <div>
                <h4 className="text-white font-black uppercase text-[10px] tracking-widest leading-none mb-1">IA Gemini 3</h4>
                <p className="text-[8px] text-orange-400 font-bold uppercase tracking-widest">Análisis Predictivo</p>
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col gap-3 overflow-hidden">
               <div className="flex-1 overflow-y-auto p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 text-slate-300 text-xs leading-relaxed font-medium">
                  {isLoadingAi ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <Loader2 className="animate-spin text-orange-500" size={24} />
                        <span className="text-[9px] font-black text-slate-500 uppercase animate-pulse">Procesando datos...</span>
                    </div>
                  ) : aiAnalysis ? (
                    <div className="animate-fade-in whitespace-pre-wrap">{aiAnalysis}</div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2 text-center opacity-40">
                        <MessageSquareQuote size={32} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Listo para el análisis</p>
                    </div>
                  )}
               </div>

               <div className="space-y-3">
                   <textarea 
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs focus:border-orange-500 outline-none transition-all placeholder:text-slate-600 font-bold"
                      rows={2}
                      placeholder="Consultar logística..."
                      value={customAiPrompt}
                      onChange={e => setCustomAiPrompt(e.target.value)}
                   />
                   <button 
                      onClick={handleAiAnalysis}
                      disabled={isLoadingAi || displayedOrders.length === 0}
                      className="w-full py-3 bg-white text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-50 transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-20 active:scale-95"
                   >
                      <RefreshCw size={14} className={isLoadingAi ? 'animate-spin text-orange-600' : ''} />
                      {isLoadingAi ? 'Analizando...' : 'Hacer Balance'}
                   </button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};