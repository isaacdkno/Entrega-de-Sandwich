
import { Order, OrderStatus, ProductionBranch, PaymentStatus } from '../types';
import { PICKUP_DATES, PRODUCTION_BRANCHES, PICKUP_BRANCHES } from '../constants';
import { analyzeOrders } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { BrainCircuit, Loader2, RefreshCw, Filter, Download, Send, DollarSign, Store, BarChart3, TrendingUp, Package, MessageSquareQuote, Sigma, ShieldCheck, Ticket, AlertCircle, Key, ExternalLink, ShieldAlert } from 'lucide-react';
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
  
  // false: clave no configurada, true: clave lista, 'error': error de auth detectado
  const [authState, setAuthState] = useState<'checking' | 'ready' | 'needs_auth'>('checking');

  useEffect(() => {
    const checkKey = async () => {
      const win = window as any;
      if (win.aistudio) {
        try {
          const hasKey = await win.aistudio.hasSelectedApiKey();
          setAuthState(hasKey ? 'ready' : 'needs_auth');
        } catch (e) {
          setAuthState('needs_auth');
        }
      } else {
        setAuthState('ready'); // Suponemos .env en local
      }
    };
    checkKey();
  }, []);

  const handleLinkGoogleCloud = async () => {
    const win = window as any;
    if (win.aistudio) {
      try {
        await win.aistudio.openSelectKey();
        setAuthState('ready');
        setAiAnalysis(null);
      } catch (e) {
        console.error("Key selection failed", e);
      }
    }
  };

  const displayedOrders = useMemo(() => {
    const dateOrders = orders.filter(o => o.pickupDate === selectedDate);
    if (selectedFactory === 'ALL') return dateOrders;
    return dateOrders.filter(o => o.originBranch === selectedFactory);
  }, [orders, selectedDate, selectedFactory]);

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

    const bStats = Object.entries(stats).map(([name, data]) => {
        const total = data.t + data.s;
        return {
            name, total,
            prodPercent: total > 0 ? Math.round((data.prod / total) * 100) : 0,
            delivPercent: total > 0 ? Math.round((data.deliv / total) * 100) : 0,
        };
    }).sort((a, b) => b.total - a.total);

    return { branchStats: bStats, globalTotal: { total: gTotal }, finances: { paid: fPaid, partial: fPartial, unpaid: fUnpaid } };
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
    if (displayedOrders.length === 0) {
      setAiAnalysis("No hay pedidos cargados para esta fecha/sucursal.");
      return;
    }

    setIsLoadingAi(true);
    setAiAnalysis(null);
    
    try {
      const result = await analyzeOrders(displayedOrders, selectedDate, selectedFactory, customAiPrompt);
      setAiAnalysis(result);
      setCustomAiPrompt('');
    } catch (err: any) {
      if (err.message === "AUTH_REQUIRED") {
        setAuthState('needs_auth');
      } else {
        setAiAnalysis(err.message || "Error al conectar con la IA.");
      }
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 pb-24">
      {/* Filtros Superiores */}
      <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase">
            <BarChart3 className="text-orange-600" size={24} /> Estadísticas Logísticas
        </h2>
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <select value={selectedFactory} onChange={e => setSelectedFactory(e.target.value)} className="flex-1 lg:flex-none p-2 border border-slate-300 rounded-xl font-bold text-xs bg-white shadow-sm outline-none">
             <option value="ALL">Todas las Fábricas</option>
             {PRODUCTION_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="flex-1 lg:flex-none p-2 border border-slate-300 rounded-xl font-black text-xs bg-white shadow-sm outline-none">
             {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Grid de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
         <div className="bg-orange-600 p-4 rounded-2xl shadow-lg text-white">
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
            <div className="bg-rose-100 p-2 rounded-lg text-rose-600"><ShieldAlert size={20} /></div>
            <div><p className="text-[9px] font-black text-slate-400 uppercase">Pendientes</p><p className="text-xl font-black text-slate-800">{finances.unpaid}</p></div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Gráfico */}
         <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 uppercase text-xs tracking-tighter">
               <Package size={18} className="text-blue-600" /> Distribución Horaria
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

         {/* Panel IA Inteligente */}
         <div className="bg-slate-900 rounded-3xl shadow-xl overflow-hidden flex flex-col min-h-[450px]">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center gap-3">
              <div className="bg-orange-500 p-2 rounded-xl"><BrainCircuit className="text-white" size={20} /></div>
              <div>
                <h4 className="text-white font-black uppercase text-[10px] tracking-widest">Asistente Logístico</h4>
                <p className="text-[8px] text-orange-400 font-bold uppercase">Potenciado por Gemini 3</p>
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col gap-3 overflow-hidden">
               <div className="flex-1 overflow-y-auto p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 text-slate-300 text-xs leading-relaxed font-medium">
                  {authState === 'checking' ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500">
                        <Loader2 className="animate-spin" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Verificando conexión...</span>
                    </div>
                  ) : authState === 'needs_auth' ? (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-4 p-2">
                        <div className="bg-rose-500/10 p-4 rounded-full"><Key className="text-rose-400" size={32} /></div>
                        <h5 className="text-white font-black uppercase text-xs tracking-widest">Conexión Requerida</h5>
                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                          Por seguridad del navegador, debés vincular tu cuenta de Google Cloud para que la IA pueda analizar los datos.
                        </p>
                        <button onClick={handleLinkGoogleCloud} className="w-full bg-orange-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/40">
                           Vincular Cuenta <ExternalLink size={14} />
                        </button>
                    </div>
                  ) : isLoadingAi ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <Loader2 className="animate-spin text-orange-500" />
                        <span className="text-[9px] font-black text-slate-500 uppercase animate-pulse">Analizando logística del día...</span>
                    </div>
                  ) : aiAnalysis ? (
                    <div className="animate-fade-in whitespace-pre-wrap">{aiAnalysis}</div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2 text-center opacity-40">
                        <MessageSquareQuote size={32} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Listo para el balance</p>
                    </div>
                  )}
               </div>

               {authState === 'ready' && (
                 <>
                   <textarea 
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs focus:border-orange-500 outline-none transition-all placeholder:text-slate-600 font-bold"
                      rows={2}
                      placeholder="Consultar algo específico..."
                      value={customAiPrompt}
                      onChange={e => setCustomAiPrompt(e.target.value)}
                   />
                   <button 
                      onClick={handleAiAnalysis}
                      disabled={isLoadingAi || displayedOrders.length === 0}
                      className="w-full py-3 bg-white text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-50 transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-20"
                   >
                      <RefreshCw size={14} className={isLoadingAi ? 'animate-spin' : ''} />
                      {isLoadingAi ? 'Analizando...' : 'Generar Balance'}
                   </button>
                 </>
               )}
            </div>
         </div>
      </div>

      {/* Tabla de Sucursales */}
      <div className="mt-8">
         <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 uppercase text-xs tracking-tighter">
            <Store size={18} className="text-orange-600" /> Carga por Sucursal
         </h3>
         <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {branchStats.map(stat => (
              <div key={stat.name} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                 <p className="text-[9px] font-black text-slate-400 uppercase truncate mb-1">{stat.name}</p>
                 <p className="text-xl font-black text-slate-900">{stat.total}</p>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};
