
import React, { useMemo, useState } from 'react';
import { Order, OrderStatus, ProductionBranch, PaymentStatus } from '../types';
import { PICKUP_DATES, PRODUCTION_BRANCHES, PICKUP_BRANCHES } from '../constants';
import { analyzeOrders } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BrainCircuit, Loader2, RefreshCw, Filter, Download, Send, DollarSign, Store, BarChart3, TrendingUp, PackageCheck, Truck, CheckCircle2, Package } from 'lucide-react';

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

  // Finanzas
  const countPaid = displayedOrders.filter(o => o.paymentStatus === PaymentStatus.PAID).length;
  const countPartial = displayedOrders.filter(o => o.paymentStatus === PaymentStatus.PARTIAL).length;
  const countUnpaid = displayedOrders.filter(o => !o.paymentStatus || o.paymentStatus === PaymentStatus.UNPAID).length;

  // Estadísticas por Sucursal de Retiro (Carga y Progreso)
  const branchStats = useMemo(() => {
    const stats: Record<string, { t: number; s: number; prod: number; deliv: number }> = {};
    PICKUP_BRANCHES.forEach(b => { stats[b.label] = { t: 0, s: 0, prod: 0, deliv: 0 }; });
    
    displayedOrders.forEach(o => {
        const branchObj = PICKUP_BRANCHES.find(b => b.value === o.pickupBranch);
        const branchLabel = branchObj ? branchObj.label : o.pickupBranch;
        if (!stats[branchLabel]) stats[branchLabel] = { t: 0, s: 0, prod: 0, deliv: 0 };
        
        const units = o.qtyTriples + o.qtySimples;
        stats[branchLabel].t += o.qtyTriples;
        stats[branchLabel].s += o.qtySimples;
        
        // Si tiene ubicación, está producido
        if (o.location) stats[branchLabel].prod += units;
        // Si está entregado
        if (o.status === OrderStatus.DELIVERED) stats[branchLabel].deliv += units;
    });

    return Object.entries(stats)
        .map(([name, data]) => {
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
        })
        .sort((a, b) => b.total - a.total);
  }, [displayedOrders]);

  // Gráfico por Horario
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

  const handleAiAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoadingAi(true);
    const scopeName = selectedFactory === 'ALL' ? 'Total Global' : `Fábrica ${selectedFactory}`;
    const result = await analyzeOrders(displayedOrders, selectedDate, scopeName, customAiPrompt);
    setAiAnalysis(result);
    setIsLoadingAi(false);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 pb-24">
      {/* Filtros */}
      <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <BarChart3 className="text-orange-600" size={32} /> Estadísticas
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

      {/* Tarjetas Financieras */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
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

      {/* Carga por Sucursal (Relocalizado debajo de finanzas) */}
      <div className="mb-10">
        <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tighter"><Store size={24} className="text-orange-600" /> Carga de Pedidos por Sucursal</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {branchStats.map(stat => (
              <div key={stat.name} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-xs font-black text-orange-600 uppercase mb-3 border-b pb-2">{stat.name}</p>
                <div className="flex justify-between items-end mb-2">
                   <span className="text-3xl font-black text-slate-900">{stat.total}</span>
                   <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Unid. Total</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                   <div className="bg-blue-50 p-2 rounded-lg text-center border border-blue-100">
                      <p className="text-[9px] font-black text-blue-600 uppercase mb-1">Triples</p>
                      <p className="text-lg font-black text-blue-800">{stat.triples}</p>
                   </div>
                   <div className="bg-orange-50 p-2 rounded-lg text-center border border-orange-100">
                      <p className="text-[9px] font-black text-orange-600 uppercase mb-1">Simples</p>
                      <p className="text-lg font-black text-orange-800">{stat.simples}</p>
                   </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Progreso por Sucursal de Retiro (Producción y Entrega) */}
      <div className="mb-12">
        <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tighter"><TrendingUp size={24} className="text-blue-600" /> Progreso de Operación por Sucursal</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {branchStats.filter(s => s.total > 0).map(stat => (
              <div key={stat.name} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <div className="flex justify-between items-center mb-6">
                    <h4 className="font-black text-slate-800 uppercase text-lg tracking-tighter">{stat.name}</h4>
                    <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500">{stat.total} UNID. ENCARGADAS</span>
                 </div>
                 
                 {/* Barra de Producción */}
                 <div className="mb-6">
                    <div className="flex justify-between items-end mb-2">
                       <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-blue-600" />
                          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Producción (Ubicados)</span>
                       </div>
                       <span className="text-sm font-black text-blue-600">{stat.prodPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                       <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${stat.prodPercent}%` }}></div>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 mt-1.5 uppercase text-right">{stat.prodUnits} de {stat.total} unidades listas</p>
                 </div>

                 {/* Barra de Entrega (Debajo de la de producción y con igual estilo) */}
                 <div>
                    <div className="flex justify-between items-end mb-2">
                       <div className="flex items-center gap-2">
                          <Truck size={16} className="text-emerald-600" />
                          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Entrega (Despachados)</span>
                       </div>
                       <span className="text-sm font-black text-emerald-600">{stat.delivPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                       <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${stat.delivPercent}%` }}></div>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 mt-1.5 uppercase text-right">{stat.delivUnits} de {stat.total} unidades entregadas</p>
                 </div>
              </div>
            ))}
        </div>
      </div>

      {/* Gráfico Horario y AI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
         <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3 uppercase tracking-tighter"><Package size={24} className="text-blue-600" /> Distribución Horaria de Carga</h3>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold'}} />
                  <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                  <Bar name="Triples" dataKey="Triples" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={24} />
                  <Bar name="Simples" dataKey="Simples" fill="#ea580c" radius={[6, 6, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         {/* Mini AI Summary */}
         <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-slate-800 border-b border-slate-700">
              <div className="flex items-center gap-3">
                 <div className="bg-orange-500 p-2 rounded-xl">
                    <BrainCircuit className="text-white" size={24} />
                 </div>
                 <h4 className="text-white font-black uppercase text-sm tracking-widest">Asistente AI</h4>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              {aiAnalysis ? (
                <div className="text-slate-300 text-sm leading-relaxed mb-6 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {aiAnalysis}
                </div>
              ) : (
                <div className="text-slate-500 text-center py-10 italic text-sm">
                  Toca analizar para obtener un resumen estratégico de la carga.
                </div>
              )}
              
              <button 
                onClick={() => handleAiAnalysis()}
                disabled={isLoadingAi || displayedOrders.length === 0}
                className="w-full bg-white text-slate-900 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-50 transition-all flex items-center justify-center gap-3 disabled:opacity-30"
              >
                {isLoadingAi ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                {isLoadingAi ? 'Analizando...' : 'Analizar Carga'}
              </button>
            </div>
         </div>
      </div>
    </div>
  );
};
