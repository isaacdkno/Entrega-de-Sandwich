
import React, { useMemo, useState } from 'react';
import { Order, OrderStatus, ProductionBranch, PaymentStatus } from '../types';
import { PICKUP_DATES, PRODUCTION_BRANCHES, PICKUP_BRANCHES } from '../constants';
import { analyzeOrders } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
// Added missing Filter, Store, Sigma, Ticket icons to the lucide-react import list
import { BrainCircuit, Loader2, RefreshCw, DollarSign, BarChart3, TrendingUp, Package, MessageSquareQuote, FileDown, CheckCircle2, Filter, Store, Sigma, Ticket } from 'lucide-react';

interface StatsTabProps {
  orders: Order[];
}

export const StatsTab: React.FC<StatsTabProps> = ({ orders }) => {
  const [selectedDate, setSelectedDate] = useState(PICKUP_DATES[0]); 
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  const [chartMode, setChartMode] = useState<'UNIDADES' | 'COMANDAS'>('UNIDADES');
  
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [customAiPrompt, setCustomAiPrompt] = useState('');

  const displayedOrders = useMemo(() => {
    let filtered = orders.filter(o => o.pickupDate === selectedDate);
    if (selectedFactory !== 'ALL') {
      filtered = filtered.filter(o => o.originBranch === selectedFactory);
    }
    return filtered;
  }, [orders, selectedDate, selectedFactory]);

  const stats = useMemo(() => {
    const branchData: Record<string, { total: number; prod: number; deliv: number; count: number }> = {};
    PICKUP_BRANCHES.forEach(b => { 
        branchData[b.label] = { total: 0, prod: 0, deliv: 0, count: 0 }; 
    });

    let gTotal = 0;
    let fPaid = 0, fPartial = 0, fUnpaid = 0;

    displayedOrders.forEach(o => {
        const branchLabel = PICKUP_BRANCHES.find(b => b.value === o.pickupBranch)?.label || o.pickupBranch;
        const units = o.qtyTriples + o.qtySimples;
        
        if (!branchData[branchLabel]) branchData[branchLabel] = { total: 0, prod: 0, deliv: 0, count: 0 };
        
        branchData[branchLabel].total += units;
        branchData[branchLabel].count += 1;
        gTotal += units;

        if (o.location) branchData[branchLabel].prod += units;
        if (o.status === OrderStatus.DELIVERED) branchData[branchLabel].deliv += units;

        if (o.paymentStatus === PaymentStatus.PAID) fPaid++;
        else if (o.paymentStatus === PaymentStatus.PARTIAL) fPartial++;
        else fUnpaid++;
    });

    return { 
        branches: Object.entries(branchData).map(([name, d]) => ({
            name, total: d.total, count: d.count,
            prodP: d.total > 0 ? Math.round((d.prod / d.total) * 100) : 0,
            delivP: d.total > 0 ? Math.round((d.deliv / d.total) * 100) : 0
        })).sort((a, b) => b.total - a.total),
        gTotal,
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
    <div className="max-w-[1400px] mx-auto p-2 sm:p-4 pb-24 space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 p-2 rounded-2xl">
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
            <BarChart3 className="text-orange-600" size={28} /> Tablero de Estadísticas
        </h2>
        <div className="flex flex-wrap items-center gap-2 justify-center">
          <div className="bg-white border rounded-xl flex items-center px-3 py-1.5 shadow-sm">
             <Filter size={14} className="text-slate-400 mr-2" />
             <select value={selectedFactory} onChange={e => setSelectedFactory(e.target.value)} className="font-bold text-xs uppercase outline-none bg-transparent">
               <option value="ALL">Todas las Fábricas</option>
               {PRODUCTION_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
             </select>
          </div>
          <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-white border rounded-xl px-4 py-2 font-black text-xs uppercase shadow-sm outline-none">
            {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-100">
             <FileDown size={14} /> Excel
          </button>
        </div>
      </div>

      {/* Tarjetas Financieras Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 group">
            <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all"><DollarSign size={24} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Pagados Total</p>
              <p className="text-3xl font-black text-slate-800">{stats.finances.paid}</p>
            </div>
         </div>
         <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 group">
            <div className="bg-amber-50 p-4 rounded-2xl text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all"><DollarSign size={24} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Con Seña</p>
              <p className="text-3xl font-black text-slate-800">{stats.finances.partial}</p>
            </div>
         </div>
         <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 group">
            <div className="bg-rose-50 p-4 rounded-2xl text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-all"><DollarSign size={24} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Falta Abonar</p>
              <p className="text-3xl font-black text-slate-800">{stats.finances.unpaid}</p>
            </div>
         </div>
      </div>

      {/* Seccion Gráfico y Panel IA (Fila Media) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative">
            <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-[11px] tracking-widest">
                   <TrendingUp size={16} className="text-blue-600" /> Distribución Horaria
                </h3>
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                   <button onClick={() => setChartMode('UNIDADES')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${chartMode === 'UNIDADES' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>Unidades</button>
                   <button onClick={() => setChartMode('COMANDAS')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${chartMode === 'COMANDAS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Comandas</button>
                </div>
            </div>
            
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: '800'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold'}}
                  />
                  {chartMode === 'UNIDADES' ? (
                    <>
                      <Bar name="Simples" dataKey="Simples" fill="#fb923c" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar name="Triples" dataKey="Triples" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={20} />
                    </>
                  ) : (
                    <Bar name="Comandas" dataKey="Comandas" fill="#0f172a" radius={[6, 6, 0, 0]} barSize={40} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         {/* Panel IA Gemini */}
         <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-full border border-slate-800">
            <div className="p-5 bg-slate-800/50 border-b border-white/5 flex items-center gap-3">
              <div className="bg-orange-600 p-2.5 rounded-2xl shadow-lg shadow-orange-900/50"><BrainCircuit className="text-white" size={24} /></div>
              <div>
                <h4 className="text-white font-black uppercase text-[11px] tracking-[0.2em] leading-none mb-1">Asistente Gemini</h4>
                <p className="text-[9px] text-orange-400 font-black uppercase tracking-widest opacity-80">IA Inteligente</p>
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col gap-4">
               <div className="flex-1 overflow-y-auto p-5 bg-slate-900/60 rounded-3xl border border-white/5 text-slate-300 text-xs leading-relaxed font-bold custom-scrollbar">
                  {isLoadingAi ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <Loader2 className="animate-spin text-orange-500" size={32} />
                        <div className="bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-full text-[9px] font-black uppercase flex items-center gap-2">
                            <CheckCircle2 size={12} /> LISTO
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase italic">¿Querés un balance del día?</span>
                    </div>
                  ) : aiAnalysis ? (
                    <div className="animate-fade-in whitespace-pre-wrap">{aiAnalysis}</div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-4 text-center">
                        <div className="bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-full text-[9px] font-black uppercase flex items-center gap-2">
                            <CheckCircle2 size={12} /> LISTO
                        </div>
                        <MessageSquareQuote size={48} className="opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest leading-loose">¿Querés un balance del día?</p>
                    </div>
                  )}
               </div>

               <div className="space-y-3">
                   <input 
                      type="text"
                      className="w-full bg-slate-800/50 border border-white/10 rounded-2xl p-4 text-white text-xs focus:border-orange-500 outline-none transition-all placeholder:text-slate-600 font-bold"
                      placeholder="Escribí una consulta a la IA..."
                      value={customAiPrompt}
                      onChange={e => setCustomAiPrompt(e.target.value)}
                   />
                   <button 
                      onClick={handleAiAnalysis}
                      disabled={isLoadingAi || displayedOrders.length === 0}
                      className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-orange-50 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
                   >
                      <RefreshCw size={16} className={isLoadingAi ? 'animate-spin' : ''} />
                      {isLoadingAi ? 'Procesando...' : 'Generar Análisis'}
                   </button>
               </div>
            </div>
         </div>
      </div>

      {/* Fila: Carga por Sucursal */}
      <div>
         <h3 className="font-black text-slate-700 flex items-center gap-2 uppercase text-[12px] tracking-widest mb-4 ml-2">
            <Store className="text-orange-600" size={18} /> Carga por Sucursal
         </h3>
         <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar">
            <div className="flex-shrink-0 bg-orange-600 p-6 rounded-[2rem] shadow-xl shadow-orange-100 text-white flex flex-col items-start min-w-[180px]">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-2 flex items-center gap-1">
                    <Sigma size={10} /> Total General
                </p>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black tracking-tighter">{stats.gTotal}</span>
                    <span className="text-[9px] font-black uppercase opacity-60">unid</span>
                </div>
            </div>
            {stats.branches.map(b => (
                <div key={b.name} className="flex-shrink-0 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col min-w-[160px] group hover:border-orange-200 transition-all">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{b.name}</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-800">{b.total}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase">unid</span>
                    </div>
                    {/* Badge de comandas sutil */}
                    <div className="mt-2 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg w-fit">
                        <Ticket size={10} className="text-slate-400" />
                        <span className="text-[8px] font-black text-slate-500 uppercase">{b.count} comandas</span>
                    </div>
                </div>
            ))}
         </div>
      </div>

      {/* Fila: Progreso Operación */}
      <div>
         <h3 className="font-black text-slate-700 flex items-center gap-2 uppercase text-[12px] tracking-widest mb-4 ml-2">
            <TrendingUp className="text-blue-600" size={18} /> Progreso Operación
         </h3>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.branches.slice(0, 6).map(b => (
               <div key={b.name} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                  <div className="flex justify-between items-center">
                    <p className="font-black text-slate-800 uppercase text-xs tracking-tighter">{b.name}</p>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{b.total} unid</span>
                  </div>
                  
                  <div className="space-y-4">
                     <div>
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Producción</span>
                           <span className="text-[9px] font-black text-blue-600">{b.prodP}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${b.prodP}%` }} />
                        </div>
                     </div>
                     <div>
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Entrega</span>
                           <span className="text-[9px] font-black text-emerald-600">{b.delivP}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                           <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${b.delivP}%` }} />
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
