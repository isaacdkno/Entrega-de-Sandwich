
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

  // --- Metrics Calculation ---
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
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-col sm:flex-row gap-4 justify-between">
         <div className="flex items-center gap-3">
            <div className="bg-green-100 p-3 rounded-full"><DollarSign className="text-green-600" size={24} /></div>
            <div><p className="text-sm font-bold text-slate-500 uppercase">Pagados</p><p className="text-2xl font-black text-slate-800">{countPaid}</p></div>
         </div>
         <div className="w-px bg-slate-100 hidden sm:block"></div>
         <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-3 rounded-full"><DollarSign className="text-yellow-600" size={24} /></div>
            <div><p className="text-sm font-bold text-slate-500 uppercase">Con Seña</p><p className="text-2xl font-black text-slate-800">{countPartial}</p></div>
         </div>
         <div className="w-px bg-slate-100 hidden sm:block"></div>
         <div className="flex items-center gap-3">
            <div className="bg-red-100 p-3 rounded-full"><DollarSign className="text-red-600" size={24} /></div>
            <div><p className="text-sm font-bold text-slate-500 uppercase">Falta Abonar</p><p className="text-2xl font-black text-slate-800">{countUnpaid}</p></div>
         </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm">
          <p className="text-blue-700 text-xs uppercase font-bold mb-1">Triples ({selectedFactory === 'ALL' ? 'Total' : selectedFactory})</p>
          <div className="flex justify-between items-end">
            <div><p className="text-3xl font-black text-blue-700">{triplesTotal}</p><p className="text-xs text-slate-500">Total Encargado</p></div>
            <div className="text-right text-sm">
               <div className="font-semibold text-slate-700">{triplesProduced} <span className="text-xs font-normal text-slate-500">Elaborados</span></div>
               <div className="font-semibold text-slate-700">{triplesPendingProd} <span className="text-xs font-normal text-slate-500">Faltan Elab.</span></div>
            </div>
          </div>
        </div>
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 shadow-sm">
          <p className="text-orange-700 text-xs uppercase font-bold mb-1">Simples ({selectedFactory === 'ALL' ? 'Total' : selectedFactory})</p>
          <div className="flex justify-between items-end">
            <div><p className="text-3xl font-black text-orange-700">{simplesTotal}</p><p className="text-xs text-slate-500">Total Encargado</p></div>
            <div className="text-right text-sm">
               <div className="font-semibold text-slate-700">{simplesProduced} <span className="text-xs font-normal text-slate-500">Elaborados</span></div>
               <div className="font-semibold text-slate-700">{simplesPendingProd} <span className="text-xs font-normal text-slate-500">Faltan Elab.</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
