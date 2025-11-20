import React, { useMemo, useState } from 'react';
import { Order, OrderStatus, ProductionBranch, PaymentStatus } from '../types';
import { PICKUP_DATES, PRODUCTION_BRANCHES, PICKUP_BRANCHES } from '../constants';
import { analyzeOrders } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BrainCircuit, Loader2, RefreshCw, Clock, Filter, Download, Send, DollarSign, Store } from 'lucide-react';

interface StatsTabProps {
  orders: Order[];
}

export const StatsTab: React.FC<StatsTabProps> = ({ orders }) => {
  const [selectedDate, setSelectedDate] = useState(PICKUP_DATES[0]);
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  
  // AI State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [customAiPrompt, setCustomAiPrompt] = useState('');

  // 1. Filter by Date
  const dateOrders = useMemo(() => orders.filter(o => o.pickupDate === selectedDate), [orders, selectedDate]);

  // 2. Filter by Factory (for KPIs)
  const displayedOrders = useMemo(() => {
    if (selectedFactory === 'ALL') return dateOrders;
    return dateOrders.filter(o => o.originBranch === selectedFactory);
  }, [dateOrders, selectedFactory]);

  // --- CSV Export Logic ---
  const handleExportCSV = () => {
    if (displayedOrders.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }

    // Define Headers
    const headers = [
        "Nro Comanda", 
        "Fecha Retiro", 
        "Hora", 
        "Cliente", 
        "Telefono", 
        "Direccion", 
        "Sucursal Retiro", 
        "Fabrica Origen",
        "Triples", 
        "Simples", 
        "Seña", 
        "Estado Pago",
        "Estado Pedido", 
        "Ubicacion",
        "Notas"
    ];

    // Map Rows
    const rows = displayedOrders.map(o => [
        o.id,
        o.pickupDate,
        o.pickupTime,
        `"${o.customerName}"`, // Quote strings that might have commas
        `"${o.phone}"`,
        `"${o.address}"`,
        o.pickupBranch,
        o.originBranch,
        o.qtyTriples,
        o.qtySimples,
        o.deposit,
        o.paymentStatus || 'No definido',
        o.status,
        o.location || '',
        `"${o.notes.replace(/\n/g, ' ')}"` // Remove newlines from notes
    ]);

    // Join content
    const csvContent = [
        headers.join(','), 
        ...rows.map(r => r.join(','))
    ].join('\n');

    // Create Download Link with BOM for Excel UTF-8 compatibility
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Pedidos_${selectedDate.replace(/\//g, '-')}_${selectedFactory}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Metrics Calculation (Based on displayedOrders) ---
  
  // 1. Triples
  const triplesTotal = displayedOrders.reduce((acc, o) => acc + o.qtyTriples, 0);
  const triplesProduced = displayedOrders.filter(o => o.location).reduce((acc, o) => acc + o.qtyTriples, 0);
  const triplesDelivered = displayedOrders.filter(o => o.status === OrderStatus.DELIVERED).reduce((acc, o) => acc + o.qtyTriples, 0);
  const triplesPendingProd = triplesTotal - triplesProduced;
  const triplesReadyToDeliver = triplesProduced - triplesDelivered; // Located but not delivered

  // 2. Simples
  const simplesTotal = displayedOrders.reduce((acc, o) => acc + o.qtySimples, 0);
  const simplesProduced = displayedOrders.filter(o => o.location).reduce((acc, o) => acc + o.qtySimples, 0);
  const simplesDelivered = displayedOrders.filter(o => o.status === OrderStatus.DELIVERED).reduce((acc, o) => acc + o.qtySimples, 0);
  const simplesPendingProd = simplesTotal - simplesProduced;
  const simplesReadyToDeliver = simplesProduced - simplesDelivered;

  // 3. Payment Status Stats
  const countPaid = displayedOrders.filter(o => o.paymentStatus === PaymentStatus.PAID).length;
  const countPartial = displayedOrders.filter(o => o.paymentStatus === PaymentStatus.PARTIAL).length;
  const countUnpaid = displayedOrders.filter(o => !o.paymentStatus || o.paymentStatus === PaymentStatus.UNPAID).length;


  // 3. Chart Data (Group by Production Branch based on displayedOrders)
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

  // 4. Pickup Branch Distribution Stats
  const pickupStats = useMemo(() => {
    const stats: Record<string, { t: number; s: number }> = {};
    
    // Initialize with 0 for all known branches
    PICKUP_BRANCHES.forEach(b => {
        stats[b.label] = { t: 0, s: 0 };
    });

    displayedOrders.forEach(o => {
        // Try to match by value or label
        const branchObj = PICKUP_BRANCHES.find(b => b.value === o.pickupBranch);
        const branchLabel = branchObj ? branchObj.label : o.pickupBranch; // Fallback to stored string

        if (!stats[branchLabel]) stats[branchLabel] = { t: 0, s: 0 };
        stats[branchLabel].t += o.qtyTriples;
        stats[branchLabel].s += o.qtySimples;
    });

    return Object.entries(stats)
        .map(([name, counts]) => ({ name, ...counts, total: counts.t + counts.s }))
        .sort((a, b) => b.total - a.total); // Sort descending by volume
  }, [displayedOrders]);

  // 5. Hourly Breakdown
  const hourlyLoad = useMemo(() => {
      const data: Record<string, Record<string, { t: number, s: number }>> = {
          [ProductionBranch.CENTRAL]: {},
          [ProductionBranch.ACONQUIJA]: {}
      };

      displayedOrders.forEach(o => {
          const time = o.pickupTime ? o.pickupTime : 'Sin Hora';
          const branch = o.originBranch;
          
          if (!data[branch]) data[branch] = {};
          if (!data[branch][time]) data[branch][time] = { t: 0, s: 0 };

          data[branch][time].t += o.qtyTriples;
          data[branch][time].s += o.qtySimples;
      });

      const processBranchData = (branchData: Record<string, { t: number, s: number }>) => {
          return Object.entries(branchData)
              .sort((a, b) => a[0].localeCompare(b[0])) 
              .map(([time, counts]) => ({
                  time,
                  triples: counts.t,
                  simples: counts.s,
                  total: counts.t + counts.s
              }));
      };

      return {
          central: processBranchData(data[ProductionBranch.CENTRAL]),
          aconquija: processBranchData(data[ProductionBranch.ACONQUIJA])
      };
  }, [displayedOrders]);

  const maxLoad = useMemo(() => {
      let max = 0;
      [...hourlyLoad.central, ...hourlyLoad.aconquija].forEach(item => {
          if (item.total > max) max = item.total;
      });
      return max || 1; 
  }, [hourlyLoad]);


  const handleAiAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoadingAi(true);
    const scopeName = selectedFactory === 'ALL' ? 'Total Global' : `Fábrica ${selectedFactory}`;
    
    // Pass custom prompt if available
    const result = await analyzeOrders(displayedOrders, selectedDate, scopeName, customAiPrompt);
    
    setAiAnalysis(result);
    setIsLoadingAi(false);
  };

  // --- Render Helpers ---
  const StatCard = ({ title, total, sub1, sub1Label, sub2, sub2Label, colorClass, bgClass }: any) => (
    <div className={`${bgClass} p-4 rounded-xl border shadow-sm`}>
      <p className={`${colorClass} text-xs uppercase font-bold mb-1`}>{title}</p>
      <div className="flex justify-between items-end">
        <div>
          <p className={`text-3xl font-black ${colorClass}`}>{total}</p>
          <p className="text-xs text-slate-500 font-medium">Total Encargado</p>
        </div>
        <div className="text-right text-sm">
           <div className="font-semibold text-slate-700">
             {sub1} <span className="text-xs font-normal text-slate-500">{sub1Label}</span>
           </div>
           <div className="font-semibold text-slate-700">
             {sub2} <span className="text-xs font-normal text-slate-500">{sub2Label}</span>
           </div>
        </div>
      </div>
    </div>
  );

  const HourlyList = ({ title, data }: { title: string, data: { time: string, triples: number, simples: number, total: number }[] }) => (
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full animate-fade-in">
          <h3 className="font-bold text-lg mb-4 text-slate-800 border-b pb-2">{title}</h3>
          {data.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm italic">
                  No hay pedidos cargados.
              </div>
          ) : (
              <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 max-h-80">
                  {data.map((item) => (
                      <div key={item.time} className="relative">
                           <div className="flex justify-between items-end mb-1 text-sm">
                               <div className="flex items-center gap-2">
                                   <Clock size={14} className="text-slate-400" />
                                   <span className="font-mono font-bold text-slate-800">{item.time}</span>
                               </div>
                               <div className="text-xs text-slate-600">
                                   <span className="font-bold text-blue-600">{item.triples} T</span>
                                   <span className="mx-1 text-slate-300">|</span>
                                   <span className="font-bold text-orange-600">{item.simples} S</span>
                               </div>
                           </div>
                           <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                               <div 
                                   className={`h-2 rounded-full ${item.total / maxLoad > 0.8 ? 'bg-red-500' : item.total / maxLoad > 0.5 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                   style={{ width: `${(item.total / maxLoad) * 100}%` }}
                               ></div>
                           </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
  );

  const showCentral = selectedFactory === 'ALL' || selectedFactory === ProductionBranch.CENTRAL;
  const showAconquija = selectedFactory === 'ALL' || selectedFactory === ProductionBranch.ACONQUIJA;

  return (
    <div className="max-w-6xl mx-auto p-4 pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Tablero de Control</h2>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          
          {/* Factory Filter */}
          <div className="relative w-full sm:w-auto">
             <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={16} />
             <select 
                value={selectedFactory}
                onChange={e => { setSelectedFactory(e.target.value); setAiAnalysis(null); }}
                className="w-full sm:w-auto pl-9 pr-8 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-orange-500 outline-none appearance-none cursor-pointer"
             >
               <option value="ALL">Todas las Fábricas</option>
               {PRODUCTION_BRANCHES.map(b => (
                 <option key={b.value} value={b.value}>{b.label}</option>
               ))}
             </select>
          </div>

          {/* Date Filter */}
          <div className="relative w-full sm:w-auto">
             <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-xs font-bold">FECHA:</span>
             <select 
                value={selectedDate} 
                onChange={e => { setSelectedDate(e.target.value); setAiAnalysis(null); }}
                className="w-full sm:w-auto pl-14 pr-8 py-2 border border-slate-300 rounded-lg font-bold text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-orange-500 outline-none appearance-none cursor-pointer"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7em top 50%', backgroundSize: '.65em auto' }}
            >
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm"
            title="Descargar Excel"
          >
              <Download size={18} />
              <span className="hidden sm:inline">Excel</span>
          </button>
        </div>
      </div>

      {/* Payment Status Overview */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-col sm:flex-row gap-4 justify-between animate-fade-in">
         <div className="flex items-center gap-3">
            <div className="bg-green-100 p-3 rounded-full">
                <DollarSign className="text-green-600" size={24} />
            </div>
            <div>
                <p className="text-sm font-bold text-slate-500 uppercase">Pagados</p>
                <p className="text-2xl font-black text-slate-800">{countPaid}</p>
            </div>
         </div>
         <div className="w-px bg-slate-100 hidden sm:block"></div>
         <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-3 rounded-full">
                <DollarSign className="text-yellow-600" size={24} />
            </div>
            <div>
                <p className="text-sm font-bold text-slate-500 uppercase">Con Seña</p>
                <p className="text-2xl font-black text-slate-800">{countPartial}</p>
            </div>
         </div>
         <div className="w-px bg-slate-100 hidden sm:block"></div>
         <div className="flex items-center gap-3">
            <div className="bg-red-100 p-3 rounded-full">
                <DollarSign className="text-red-600" size={24} />
            </div>
            <div>
                <p className="text-sm font-bold text-slate-500 uppercase">Falta Abonar</p>
                <p className="text-2xl font-black text-slate-800">{countUnpaid}</p>
            </div>
         </div>
      </div>

      {/* KPI Cards - Triples & Simples */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StatCard 
          title={`Sándwiches Triples (${selectedFactory === 'ALL' ? 'Total' : selectedFactory})`}
          total={triplesTotal}
          sub1={triplesProduced} sub1Label="Elaborados"
          sub2={triplesPendingProd} sub2Label="Faltan Elab."
          colorClass="text-blue-700"
          bgClass="bg-blue-50 border-blue-200"
        />
        <StatCard 
          title={`Sándwiches Simples (${selectedFactory === 'ALL' ? 'Total' : selectedFactory})`}
          total={simplesTotal}
          sub1={simplesProduced} sub1Label="Elaborados"
          sub2={simplesPendingProd} sub2Label="Faltan Elab."
          colorClass="text-orange-700"
          bgClass="bg-orange-50 border-orange-200"
        />
      </div>

      {/* Detailed Status Bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-600">Estado Elaboración</span>
            <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">{triplesProduced + simplesProduced} / {triplesTotal + simplesTotal} u.</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
            <div 
              className="bg-green-500 h-4 rounded-full transition-all duration-500" 
              style={{ width: `${(triplesTotal + simplesTotal) > 0 ? ((triplesProduced + simplesProduced) / (triplesTotal + simplesTotal)) * 100 : 0}%` }}
            ></div>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-right">
            {(triplesTotal + simplesTotal) > 0 ? Math.round(((triplesProduced + simplesProduced) / (triplesTotal + simplesTotal)) * 100) : 0}% Completado
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-600">Pendientes de Entrega</span>
             <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">En Depósito</span>
          </div>
          <div className="flex items-end gap-4">
             <div>
                <span className="block text-2xl font-bold text-purple-600">{triplesReadyToDeliver}</span>
                <span className="text-xs text-slate-400 uppercase">Triples</span>
             </div>
             <div>
                <span className="block text-2xl font-bold text-purple-600">{simplesReadyToDeliver}</span>
                <span className="text-xs text-slate-400 uppercase">Simples</span>
             </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-600">Total Entregados</span>
            <span className="text-xs font-mono bg-green-100 text-green-800 px-2 py-1 rounded">Finalizados</span>
          </div>
           <div className="flex items-end gap-4">
             <div>
                <span className="block text-2xl font-bold text-slate-800">{triplesDelivered}</span>
                <span className="text-xs text-slate-400 uppercase">Triples</span>
             </div>
             <div>
                <span className="block text-2xl font-bold text-slate-800">{simplesDelivered}</span>
                <span className="text-xs text-slate-400 uppercase">Simples</span>
             </div>
          </div>
        </div>
      </div>

      {/* Pickup Branch Breakdown */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 animate-fade-in">
           <div className="flex items-center gap-2 mb-6 border-b pb-2">
               <Store className="text-indigo-600" />
               <h3 className="font-bold text-lg text-slate-800">Distribución por Sucursal de Retiro</h3>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {pickupStats.map(stat => (
                 <div key={stat.name} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1 truncate" title={stat.name}>{stat.name}</p>
                    <div className="flex items-end gap-2 mt-auto">
                       <span className="text-2xl font-black text-slate-800">{stat.total}</span>
                       <span className="text-xs text-slate-400 mb-1">u. total</span>
                    </div>
                    <div className="mt-3 text-xs flex gap-2 pt-2 border-t border-slate-200">
                       <span className="font-bold text-blue-600">{stat.t} Trip.</span>
                       <span className="font-bold text-orange-600">{stat.s} Simp.</span>
                    </div>
                 </div>
              ))}
           </div>
      </div>
      
      {/* Hourly Load Breakdown */}
      <h3 className="font-bold text-lg mb-4 text-slate-800 pl-1">Carga Horaria por Fábrica</h3>
      <div className={`grid grid-cols-1 gap-6 mb-8 ${selectedFactory === 'ALL' ? 'md:grid-cols-2' : ''}`}>
          {showCentral && <HourlyList title="Fábrica Central" data={hourlyLoad.central} />}
          {showAconquija && <HourlyList title="Fábrica Aconquija" data={hourlyLoad.aconquija} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart: Production Load */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[28rem] flex flex-col">
          <h3 className="font-bold text-lg mb-6 text-slate-800">Comparativa de Producción</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                <Bar dataKey="Triples" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} barSize={40} />
                <Bar dataKey="Simples" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

         {/* AI Analysis */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[28rem] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <BrainCircuit className="text-indigo-600" size={24} />
                Asistente Inteligente
              </h3>
            </div>
            
            {/* Chat Input Area */}
            <div className="mb-4">
               <form onSubmit={handleAiAnalysis} className="relative">
                 <input 
                    type="text" 
                    placeholder="Ej: ¿Qué horario tiene más demora? o Resumen general..." 
                    className="w-full pl-4 pr-10 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none placeholder-indigo-300 text-indigo-900"
                    value={customAiPrompt}
                    onChange={(e) => setCustomAiPrompt(e.target.value)}
                 />
                 <button 
                    type="submit"
                    disabled={isLoadingAi}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                 >
                    {isLoadingAi ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                 </button>
               </form>
               <p className="text-[10px] text-slate-400 mt-1 ml-1">
                  Deja vacío para un resumen ejecutivo automático.
               </p>
            </div>

            {/* Response Area */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar bg-slate-50 rounded-xl p-4 border border-slate-100">
               {aiAnalysis ? (
                 <div className="prose prose-sm prose-indigo max-w-none">
                    <p className="text-slate-800 leading-relaxed whitespace-pre-line">
                      {aiAnalysis}
                    </p>
                 </div>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center opacity-60">
                   <BrainCircuit size={40} className="mb-2" />
                   <p className="text-xs">
                      Analizo los datos de producción en tiempo real.<br/>
                      Pregúntame sobre cuellos de botella, horarios críticos o estadísticas.
                   </p>
                 </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};