
import React, { useMemo, useState } from 'react';
import { Order, OrderStatus, ProductionBranch, PaymentStatus } from '../types';
import { PICKUP_DATES, PRODUCTION_BRANCHES, PICKUP_BRANCHES } from '../constants';
import { analyzeOrders } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BrainCircuit, Loader2, RefreshCw, Filter, Download, Send, DollarSign, Store, BarChart3, TrendingUp, PackageCheck, Truck } from 'lucide-react';

interface StatsTabProps {
  orders: Order[];
}

export const StatsTab: React.FC<StatsTabProps> = ({ orders }) => {
  const [selectedDate, setSelectedDate] = useState(PICKUP_DATES[0]); // 31/12/2025
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  
  // AI State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [customAiPrompt, setCustomAiPrompt] = useState('');

  // 1. Filtrar por Fecha
  const dateOrders = useMemo(() => orders.filter(o => o.pickupDate === selectedDate), [orders, selectedDate]);

  // 2. Filtrar por Fábrica
  const displayedOrders = useMemo(() => {
    if (selectedFactory === 'ALL') return dateOrders;
    return dateOrders.filter(o => o.originBranch === selectedFactory);
  }, [dateOrders, selectedFactory]);

  // --- Exportación CSV ---
  const handleExportCSV = () => {
    if (displayedOrders.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }

    const headers = [
        "Nro Comanda", "Fecha Retiro", "Hora", "Cliente", "Telefono", "Direccion", 
        "Sucursal Retiro", "Fabrica Origen", "Triples", "Simples", "Seña", 
        "Estado Pago", "Estado Pedido", "Ubicacion", "Notas"
    ];

    const rows = displayedOrders.map(o => [
        o.id, o.pickupDate, o.pickupTime, `"${o.customerName}"`, `"${o.phone}"`, 
        `"${o.address}"`, o.pickupBranch, o.originBranch, o.qtyTriples, o.qtySimples, 
        o.deposit, o.paymentStatus || 'No definido', o.status, o.location || '',
        `"${o.notes.replace(/\n/g, ' ')}"`
    ]);

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

  // --- Cálculos de Métricas ---
  const triplesTotal = displayedOrders.reduce((acc, o) => acc + o.qtyTriples, 0);
  const triplesProduced = displayedOrders.filter(o => o.location).reduce((acc, o) => acc + o.qtyTriples, 0);
  const triplesDelivered = displayedOrders.filter(o => o.status === OrderStatus.DELIVERED).reduce((acc, o) => acc + o.qtyTriples, 0);
  
  const triplesPercent = triplesTotal > 0 ? Math.round((triplesProduced / triplesTotal) * 100) : 0;

  const simplesTotal = displayedOrders.reduce((acc, o) => acc + o.qtySimples, 0);
  const simplesProduced = displayedOrders.filter(o => o.location).reduce((acc, o) => acc + o.qtySimples, 0);
  const simplesDelivered = displayedOrders.filter(o => o.status === OrderStatus.DELIVERED).reduce((acc, o) => acc + o.qtySimples, 0);

  const simplesPercent = simplesTotal > 0 ? Math.round((simplesProduced / simplesTotal) * 100) : 0;

  // Entrega Total
  const totalUnits = triplesTotal + simplesTotal;
  const totalDelivered = triplesDelivered + simplesDelivered;
  const deliveryPercent = totalUnits > 0 ? Math.round((totalDelivered / totalUnits) * 100) : 0;

  const countPaid = displayedOrders.filter(o => o.paymentStatus === PaymentStatus.PAID).length;
  const countPartial = displayedOrders.filter(o => o.paymentStatus === PaymentStatus.PARTIAL).length;
  const countUnpaid = displayedOrders.filter(o => !o.paymentStatus || o.paymentStatus === PaymentStatus.UNPAID).length;

  // Gráfico por Horario (Carga Horaria)
  const hourlyChartData = useMemo(() => {
    const hourMap: Record<string, { hour: string; Triples: number; Simples: number }> = {};
    displayedOrders.forEach(o => {
      const h = o.pickupTime.split(':')[0] + ':00';
      if (!hourMap[h]) {
        hourMap[h] = { hour: h, Triples: 0, Simples: 0 };
      }
      hourMap[h].Triples += o.qtyTriples;
      hourMap[h].Simples += o.qtySimples;
    });
    return Object.values(hourMap).sort((a, b) => a.hour.localeCompare(b.hour));
  }, [displayedOrders]);

  // Desglose por sucursal de retiro
  const pickupStats = useMemo(() => {
    const stats: Record<string, { t: number; s: number }> = {};
    PICKUP_BRANCHES.forEach(b => { stats[b.label] = { t: 0, s: 0 }; });
    displayedOrders.forEach(o => {
        const branchObj = PICKUP_BRANCHES.find(b => b.value === o.pickupBranch);
        const branchLabel = branchObj ? branchObj.label : o.pickupBranch;
        if (!stats[branchLabel]) stats[branchLabel] = { t: 0, s: 0 };
        stats[branchLabel].t += o.qtyTriples;
        stats[branchLabel].s += o.qtySimples;
    });
    return Object.entries(stats)
        .map(([name, counts]) => ({ name, ...counts, total: counts.t + counts.s }))
        .sort((a, b) => b.total - a.total);
  }, [displayedOrders]);

  const handleAiAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoadingAi(true);
    const scopeName = selectedFactory === 'ALL' ? 'Total Global' : `Fábrica ${selectedFactory}`;
    const result = await analyzeOrders(displayedOrders, selectedDate, scopeName, customAiPrompt);
    setAiAnalysis(result);
    setIsLoadingAi(false);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 pb-20">
      {/* Filtros Superiores */}
      <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <BarChart3 className="text-orange-600" size={32} /> Tablero Estadístico
        </h2>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-auto">
             <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={16} />
             <select value={selectedFactory} onChange={e => { setSelectedFactory(e.target.value); setAiAnalysis(null); }} className="w-full sm:w-auto pl-9 pr-8 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white shadow-sm outline-none appearance-none cursor-pointer hover:border-orange-400 transition-colors">
               <option value="ALL">Todas las Fábricas</option>
               {PRODUCTION_BRANCHES.map(b => (
                 <option key={b.value} value={b.value}>{b.label}</option>
               ))}
             </select>
          </div>
          <div className="relative w-full sm:w-auto">
             <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-[10px] font-black uppercase tracking-tighter">Fecha:</span>
             <select value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setAiAnalysis(null); }} className="w-full sm:w-auto pl-14 pr-8 py-2.5 border border-slate-300 rounded-xl font-black text-slate-800 bg-white shadow-sm outline-none appearance-none cursor-pointer hover:border-orange-400 transition-colors">
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={handleExportCSV} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-md active:scale-95">
              <Download size={20} /> Excel
          </button>
        </div>
      </div>

      {/* Tarjeta de Progreso de Entregas Principal */}
      <div className="bg-emerald-600 rounded-[2rem] p-6 mb-10 text-white shadow-xl shadow-emerald-900/10 flex flex-col md:flex-row items-center justify-between gap-6 border-b-8 border-emerald-800">
         <div className="flex items-center gap-5">
            <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md">
                <Truck size={36} className="text-white" />
            </div>
            <div>
               <h3 className="text-xl font-black uppercase tracking-tighter leading-none mb-1">Progreso de Despacho Total</h3>
               <p className="text-emerald-100 text-xs font-bold">{totalDelivered} de {totalUnits} unidades ya entregadas</p>
            </div>
         </div>
         <div className="w-full md:w-1/3 text-center md:text-right">
            <span className="text-5xl font-black tracking-tighter">{deliveryPercent}%</span>
            <div className="w-full bg-emerald-900/30 h-3 rounded-full mt-2 overflow-hidden border border-emerald-400/20">
               <div className="h-full bg-white rounded-full transition-all duration-1000 ease-out" style={{ width: `${deliveryPercent}%` }}></div>
            </div>
         </div>
      </div>

      {/* Tarjetas Financieras */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
            <div className="bg-emerald-100 p-4 rounded-full text-emerald-600"><DollarSign size={28} strokeWidth={3} /></div>
            <div><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pagados Total</p><p className="text-3xl font-black text-slate-800">{countPaid}</p></div>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
            <div className="bg-amber-100 p-4 rounded-full text-amber-600"><DollarSign size={28} strokeWidth={3} /></div>
            <div><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Con Seña</p><p className="text-3xl font-black text-slate-800">{countPartial}</p></div>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
            <div className="bg-rose-100 p-4 rounded-full text-rose-600"><DollarSign size={28} strokeWidth={3} /></div>
            <div><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Falta Abonar</p><p className="text-3xl font-black text-slate-800">{countUnpaid}</p></div>
         </div>
      </div>

      {/* Resumen de Producción */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Triples Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
                <div className="w-2.5 h-10 bg-blue-600 rounded-full"></div>
                <h3 className="font-black text-slate-800 text-xl uppercase tracking-tighter">Sándwiches Triples</h3>
             </div>
             <span className="text-2xl font-black text-blue-600">{triplesPercent}%</span>
          </div>
          
          <div className="w-full bg-slate-100 h-4 rounded-full mb-8 overflow-hidden">
             <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${triplesPercent}%` }}></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <p className="text-blue-700 text-[10px] font-black uppercase tracking-widest mb-1">Encargado</p>
                <p className="text-4xl font-black text-blue-900">{triplesTotal}</p>
             </div>
             <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <p className="text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-1">Listos</p>
                <p className="text-4xl font-black text-emerald-800">{triplesProduced}</p>
             </div>
          </div>
        </div>

        {/* Simples Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
                <div className="w-2.5 h-10 bg-orange-600 rounded-full"></div>
                <h3 className="font-black text-slate-800 text-xl uppercase tracking-tighter">Sándwiches Simples</h3>
             </div>
             <span className="text-2xl font-black text-orange-600">{simplesPercent}%</span>
          </div>
          
          <div className="w-full bg-slate-100 h-4 rounded-full mb-8 overflow-hidden">
             <div className="h-full bg-orange-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${simplesPercent}%` }}></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                <p className="text-orange-700 text-[10px] font-black uppercase tracking-widest mb-1">Encargado</p>
                <p className="text-4xl font-black text-orange-900">{simplesTotal}</p>
             </div>
             <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <p className="text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-1">Listos</p>
                <p className="text-4xl font-black text-emerald-800">{simplesProduced}</p>
             </div>
          </div>
        </div>
      </div>

      {/* Gráficos de Producción y Carga Horaria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
         <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3"><TrendingUp size={24} className="text-blue-600" /> Distribución Horaria (Carga)</h3>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}} 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold'}} 
                  />
                  <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                  <Bar name="Triples" dataKey="Triples" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={30} />
                  <Bar name="Simples" dataKey="Simples" fill="#ea580c" radius={[6, 6, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3"><Store size={24} className="text-orange-600" /> Carga por Sucursal de Retiro</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-2 gap-3 flex-1">
               {pickupStats.map(stat => (
                 <div key={stat.name} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
                    <div className="mb-1 sm:mb-0">
                       <p className="text-[11px] sm:text-xs font-black text-slate-800 group-hover:text-orange-600 transition-colors uppercase leading-none">{stat.name}</p>
                       <p className="text-[8px] sm:text-[9px] text-slate-400 font-black uppercase tracking-tighter">{stat.t}T / {stat.s}S</p>
                    </div>
                    <div className="text-right flex items-baseline gap-1">
                       <p className="text-lg sm:text-xl font-black text-slate-900 leading-none">{stat.total}</p>
                       <p className="text-[7px] font-black text-slate-400 uppercase leading-none">U.</p>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* Panel AI de Gemini */}
      <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden mb-12 border border-slate-800">
        <div className="p-8 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
             <div className="bg-gradient-to-br from-orange-500 to-rose-600 p-3 rounded-2xl shadow-lg shadow-orange-900/40 animate-pulse">
                <BrainCircuit className="text-white" size={32} />
             </div>
             <div>
                <h3 className="text-white font-black text-xl tracking-tight">Análisis Inteligente Gemini</h3>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Resumen Estratégico & Optimización</p>
             </div>
          </div>
          <button 
            onClick={() => handleAiAnalysis()}
            disabled={isLoadingAi || displayedOrders.length === 0}
            className="w-full md:w-auto bg-white text-slate-900 px-8 py-3.5 rounded-2xl font-black hover:bg-orange-50 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50"
          >
            {isLoadingAi ? <Loader2 className="animate-spin" size={24} /> : <RefreshCw size={24} />}
            ANALIZAR CARGA DEL DÍA
          </button>
        </div>

        <div className="p-8">
          {aiAnalysis ? (
            <div className="animate-fade-in">
                <div className="bg-slate-800/50 p-8 rounded-[2rem] border border-slate-700/50 text-slate-200 leading-relaxed whitespace-pre-wrap font-medium shadow-inner">
                  {aiAnalysis}
                </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <BrainCircuit size={64} className="mx-auto text-slate-800 mb-4 opacity-10" />
              <p className="text-slate-600 font-black uppercase tracking-widest text-sm">Listo para procesar {displayedOrders.length} pedidos</p>
            </div>
          )}

          <form onSubmit={handleAiAnalysis} className="mt-8 flex gap-3">
            <input 
               type="text" 
               className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold"
               placeholder="Pregunta algo específico..."
               value={customAiPrompt}
               onChange={e => setCustomAiPrompt(e.target.value)}
            />
            <button 
              type="submit"
              disabled={isLoadingAi || !customAiPrompt}
              className="bg-orange-600 text-white p-4 rounded-2xl hover:bg-orange-700 transition-all shadow-lg active:scale-90 disabled:opacity-50"
            >
              <Send size={28} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
