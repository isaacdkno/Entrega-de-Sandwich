
import React, { useMemo, useState } from 'react';
import { Order, OrderStatus, ProductionBranch, PaymentStatus } from '../types';
import { PICKUP_DATES, PRODUCTION_BRANCHES, PICKUP_BRANCHES } from '../constants';
import { analyzeOrders } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BrainCircuit, Loader2, RefreshCw, Clock, Filter, Download, Send, DollarSign, Store, ClipboardList, CheckCircle2 } from 'lucide-react';

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
  const triplesPendingProd = triplesTotal - triplesProduced;
  const triplesReadyToDeliver = triplesProduced - triplesDelivered;

  const simplesTotal = displayedOrders.reduce((acc, o) => acc + o.qtySimples, 0);
  const simplesProduced = displayedOrders.filter(o => o.location).reduce((acc, o) => acc + o.qtySimples, 0);
  const simplesDelivered = displayedOrders.filter(o => o.status === OrderStatus.DELIVERED).reduce((acc, o) => acc + o.qtySimples, 0);
  const simplesPendingProd = simplesTotal - simplesProduced;
  const simplesReadyToDeliver = simplesProduced - simplesDelivered;

  const countPaid = displayedOrders.filter(o => o.paymentStatus === PaymentStatus.PAID).length;
  const countPartial = displayedOrders.filter(o => o.paymentStatus === PaymentStatus.PARTIAL).length;
  const countUnpaid = displayedOrders.filter(o => !o.paymentStatus || o.paymentStatus === PaymentStatus.UNPAID).length;

  // Gráfico
  const chartData = useMemo(() => {
    const branchMap: Record<string, { name: string; Triples: number; Simples: number }> = {};
    displayedOrders.forEach(o => {
      const branch = o.originBranch;
      if (!branchMap[branch]) {
        branchMap[branch] = { name: branch, Triples: 0, Simples: 0 };
      }
      branchMap[branch].Triples += o.qtyTriples;
      branchMap[branch].Simples += o.qtySimples;
    });
    return Object.values(branchMap);
  }, [displayedOrders]);

  // Desglose por sucursal
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
    <div className="max-w-6xl mx-auto p-4 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Tablero de Control</h2>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-auto">
             <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={16} />
             <select value={selectedFactory} onChange={e => { setSelectedFactory(e.target.value); setAiAnalysis(null); }} className="w-full sm:w-auto pl-9 pr-8 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 bg-white shadow-sm outline-none appearance-none cursor-pointer">
               <option value="ALL">Todas las Fábricas</option>
               {PRODUCTION_BRANCHES.map(b => (
                 <option key={b.value} value={b.value}>{b.label}</option>
               ))}
             </select>
          </div>
          <div className="relative w-full sm:w-auto">
             <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-xs font-bold">FECHA:</span>
             <select value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setAiAnalysis(null); }} className="w-full sm:w-auto pl-14 pr-8 py-2 border border-slate-300 rounded-lg font-bold text-slate-700 bg-white shadow-sm outline-none appearance-none cursor-pointer">
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={handleExportCSV} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm">
              <Download size={18} /><span className="hidden sm:inline">Excel</span>
          </button>
        </div>
      </div>

      {/* Tarjetas Financieras */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
         <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full text-green-600"><CheckCircle2 size={24} /></div>
            <div><p className="text-xs font-bold text-slate-500 uppercase">Pagados</p><p className="text-2xl font-black text-slate-800">{countPaid}</p></div>
         </div>
         <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="bg-yellow-100 p-3 rounded-full text-yellow-600"><Clock size={24} /></div>
            <div><p className="text-xs font-bold text-slate-500 uppercase">Con Seña</p><p className="text-2xl font-black text-slate-800">{countPartial}</p></div>
         </div>
         <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="bg-red-100 p-3 rounded-full text-red-600"><DollarSign size={24} /></div>
            <div><p className="text-xs font-bold text-slate-500 uppercase">Falta Abonar</p><p className="text-2xl font-black text-slate-800">{countUnpaid}</p></div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Triples Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
             <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
             <h3 className="font-bold text-slate-800 text-lg uppercase tracking-tight">Sándwiches Triples</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-blue-700 text-[10px] font-black uppercase">Total Encargado</p>
                <p className="text-3xl font-black text-blue-800">{triplesTotal}</p>
             </div>
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-slate-500 text-[10px] font-black uppercase">Faltan Elaborar</p>
                <p className="text-3xl font-black text-red-600">{triplesPendingProd}</p>
             </div>
             <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <p className="text-green-700 text-[10px] font-black uppercase">Listos p/ Retirar</p>
                <p className="text-3xl font-black text-green-700">{triplesReadyToDeliver}</p>
             </div>
             <div className="bg-teal-50 p-4 rounded-xl border border-teal-100">
                <p className="text-teal-700 text-[10px] font-black uppercase">Ya Entregados</p>
                <p className="text-3xl font-black text-teal-800">{triplesDelivered}</p>
             </div>
          </div>
        </div>

        {/* Simples Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
             <div className="w-2 h-8 bg-orange-600 rounded-full"></div>
             <h3 className="font-bold text-slate-800 text-lg uppercase tracking-tight">Sándwiches Simples</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                <p className="text-orange-700 text-[10px] font-black uppercase">Total Encargado</p>
                <p className="text-3xl font-black text-orange-800">{simplesTotal}</p>
             </div>
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-slate-500 text-[10px] font-black uppercase">Faltan Elaborar</p>
                <p className="text-3xl font-black text-red-600">{simplesPendingProd}</p>
             </div>
             <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <p className="text-green-700 text-[10px] font-black uppercase">Listos p/ Retirar</p>
                <p className="text-3xl font-black text-green-700">{simplesReadyToDeliver}</p>
             </div>
             <div className="bg-teal-50 p-4 rounded-xl border border-teal-100">
                <p className="text-teal-700 text-[10px] font-black uppercase">Ya Entregados</p>
                <p className="text-3xl font-black text-teal-800">{simplesDelivered}</p>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
         <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><BarChart3 size={20} className="text-blue-600" /> Producción por Fábrica (Unidades)</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                  <Legend />
                  <Bar dataKey="Triples" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={40} />
                  <Bar dataKey="Simples" fill="#ea580c" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Store size={20} className="text-orange-600" /> Carga por Sucursal</h3>
            <div className="space-y-3">
               {pickupStats.map(stat => (
                 <div key={stat.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                       <p className="text-sm font-bold text-slate-700">{stat.name}</p>
                       <p className="text-[10px] text-slate-400 font-bold">{stat.t}T / {stat.s}S</p>
                    </div>
                    <div className="text-right">
                       <p className="text-lg font-black text-slate-800">{stat.total}</p>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* Panel AI */}
      <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden mb-12 border border-slate-800">
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="bg-orange-600 p-2 rounded-lg shadow-lg shadow-orange-900/20"><BrainCircuit className="text-white" size={24} /></div>
             <div>
                <h3 className="text-white font-bold text-lg">Asistente Logístico AI</h3>
                <p className="text-slate-400 text-xs uppercase font-bold tracking-widest">Powered by Gemini 3 Flash</p>
             </div>
          </div>
          <button 
            onClick={() => handleAiAnalysis()}
            disabled={isLoadingAi || displayedOrders.length === 0}
            className="w-full md:w-auto bg-white text-slate-900 px-6 py-2.5 rounded-xl font-black hover:bg-orange-50 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            {isLoadingAi ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
            GENERAR ANÁLISIS ESTRATÉGICO
          </button>
        </div>

        <div className="p-6 bg-slate-900/50">
          {aiAnalysis ? (
            <div className="prose prose-invert max-w-none animate-fade-in">
                <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {aiAnalysis}
                </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <BrainCircuit size={48} className="mx-auto text-slate-700 mb-4 opacity-20" />
              <p className="text-slate-500 font-medium">Presiona el botón para analizar los {displayedOrders.length} pedidos del día.</p>
            </div>
          )}

          <form onSubmit={handleAiAnalysis} className="mt-8 flex gap-2">
            <input 
               type="text" 
               className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-orange-500 outline-none"
               placeholder="Preguntame algo: '¿Qué hora tiene más carga?' o 'Resumen de Aconquija'..."
               value={customAiPrompt}
               onChange={e => setCustomAiPrompt(e.target.value)}
            />
            <button 
              type="submit"
              disabled={isLoadingAi || !customAiPrompt}
              className="bg-orange-600 text-white p-3 rounded-xl hover:bg-orange-700 transition-all disabled:opacity-50"
            >
              <Send size={24} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Icono faltante en imports manuales
const BarChart3 = ({size, className}: {size: number, className: string}) => <BarChart size={size} className={className} />;
