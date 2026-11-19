
import React, { useMemo, useState } from 'react';
import { Order, OrderStatus, ProductionBranch, PaymentStatus } from '../types';
import { PRODUCTION_BRANCHES, PICKUP_BRANCHES } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, BarChart3, TrendingUp, FileDown, Filter, Store, Sigma, Ticket, Factory, Clock, AlertTriangle, Layers, CheckCircle2 } from 'lucide-react';

interface StatsTabProps {
  orders: Order[];
  selectedDate: string;
}

export const StatsTab: React.FC<StatsTabProps> = ({ orders, selectedDate }) => {
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  const [chartMode, setChartMode] = useState<'UNIDADES' | 'COMANDAS'>('UNIDADES');

  const ordersForDate = useMemo(() => {
    return orders.filter(o => o.pickupDate === selectedDate);
  }, [orders, selectedDate]);

  const displayedOrders = useMemo(() => {
    if (selectedFactory === 'ALL') return ordersForDate;
    return ordersForDate.filter(o => o.originBranch === selectedFactory);
  }, [ordersForDate, selectedFactory]);

  const stats = useMemo(() => {
    const branchData: Record<string, { total: number; prod: number; deliv: number; count: number }> = {};
    PICKUP_BRANCHES.forEach(b => { 
        branchData[b.label] = { total: 0, prod: 0, deliv: 0, count: 0 }; 
    });

    let gTotal = 0;
    let totalTriples = 0;
    let totalSimples = 0;
    let fPaid = 0, fPartial = 0, fUnpaid = 0;

    const pipeline = {
      pending: { count: 0, units: 0 },
      ready: { count: 0, units: 0 },
      inSearch: { count: 0, units: 0 },
      delivered: { count: 0, units: 0 },
    };

    displayedOrders.forEach(o => {
        const branchLabel = PICKUP_BRANCHES.find(b => b.value === o.pickupBranch)?.label || o.pickupBranch;
        const units = o.qtyTriples + o.qtySimples;
        
        if (!branchData[branchLabel]) branchData[branchLabel] = { total: 0, prod: 0, deliv: 0, count: 0 };
        
        branchData[branchLabel].total += units;
        branchData[branchLabel].count += 1;
        gTotal += units;
        totalTriples += o.qtyTriples;
        totalSimples += o.qtySimples;

        if (o.location) branchData[branchLabel].prod += units;
        if (o.status === OrderStatus.DELIVERED) branchData[branchLabel].deliv += units;

        if (o.paymentStatus === PaymentStatus.PAID) fPaid++;
        else if (o.paymentStatus === PaymentStatus.PARTIAL) fPartial++;
        else fUnpaid++;

        if (o.status === OrderStatus.DELIVERED) {
          pipeline.delivered.count += 1;
          pipeline.delivered.units += units;
        } else if (o.status === OrderStatus.IN_SEARCH) {
          pipeline.inSearch.count += 1;
          pipeline.inSearch.units += units;
        } else if (o.status === OrderStatus.READY_FOR_PICKUP || o.location) {
          pipeline.ready.count += 1;
          pipeline.ready.units += units;
        } else {
          pipeline.pending.count += 1;
          pipeline.pending.units += units;
        }
    });

    return { 
        branches: Object.entries(branchData).map(([name, d]) => ({
            name, total: d.total, count: d.count,
            prodUnits: d.prod,
            delivUnits: d.deliv,
            prodP: d.total > 0 ? Math.round((d.prod / d.total) * 100) : 0,
            delivP: d.total > 0 ? Math.round((d.deliv / d.total) * 100) : 0
        })).sort((a, b) => b.total - a.total),
        gTotal,
        totalTriples,
        totalSimples,
        totalComandas: displayedOrders.length,
        finances: { paid: fPaid, partial: fPartial, unpaid: fUnpaid },
        pipeline
    };
  }, [displayedOrders]);

  const factoryComparison = useMemo(() => {
    return PRODUCTION_BRANCHES.map(fb => {
      const fOrders = ordersForDate.filter(o => o.originBranch === fb.value);
      const totalUnits = fOrders.reduce((acc, o) => acc + o.qtyTriples + o.qtySimples, 0);
      const triples = fOrders.reduce((acc, o) => acc + o.qtyTriples, 0);
      const simples = fOrders.reduce((acc, o) => acc + o.qtySimples, 0);
      const prodUnits = fOrders.filter(o => o.location).reduce((acc, o) => acc + o.qtyTriples + o.qtySimples, 0);
      const delivUnits = fOrders.filter(o => o.status === OrderStatus.DELIVERED).reduce((acc, o) => acc + o.qtyTriples + o.qtySimples, 0);

      return {
        value: fb.value,
        label: fb.label,
        count: fOrders.length,
        totalUnits,
        triples,
        simples,
        prodP: totalUnits > 0 ? Math.round((prodUnits / totalUnits) * 100) : 0,
        delivP: totalUnits > 0 ? Math.round((delivUnits / totalUnits) * 100) : 0,
      };
    });
  }, [ordersForDate]);

  const overdueAnalysis = useMemo(() => {
    const [d, m, y] = selectedDate.split('/').map(Number);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const selectedMidnight = new Date(y, m - 1, d).getTime();

    const dateRelation: 'past' | 'today' | 'future' =
      selectedMidnight < todayMidnight ? 'past' : selectedMidnight > todayMidnight ? 'future' : 'today';

    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const overdueOrders = displayedOrders
      .filter(o => {
        if (o.status === OrderStatus.DELIVERED) return false;
        if (dateRelation === 'future') return false;
        if (dateRelation === 'past') return true;
        return Boolean(o.pickupTime && /^\d{2}:\d{2}$/.test(o.pickupTime) && o.pickupTime < currentHHMM);
      })
      .sort((a, b) => (a.pickupTime || '').localeCompare(b.pickupTime || ''));

    return {
      dateRelation,
      overdueOrders,
      unlocatedOverdue: overdueOrders.filter(o => !o.location).length,
    };
  }, [displayedOrders, selectedDate]);

  const pieData = useMemo(() => {
    if (stats.gTotal === 0) return [];
    return [
      { name: 'Triples', value: stats.totalTriples, color: '#2563eb' },
      { name: 'Simples', value: stats.totalSimples, color: '#fb923c' },
    ];
  }, [stats.gTotal, stats.totalTriples, stats.totalSimples]);

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

  const handleExportCSV = () => {
    if (displayedOrders.length === 0) return;
    
    const headers = [
      "Comanda", "Fecha", "Hora", "Cliente", "Telefono", "Direccion", 
      "Retiro", "Triples", "Simples", "Total Unid", "Sena", "Estado Pago", 
      "Origen", "Ubicacion", "Bultos", "Estado Operativo"
    ];

    const escapeCsv = (val: string | number | null | undefined) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = displayedOrders.map(o => [
      escapeCsv(o.id),
      escapeCsv(o.pickupDate),
      escapeCsv(o.pickupTime),
      escapeCsv(o.customerName),
      escapeCsv(o.phone),
      escapeCsv(o.address),
      escapeCsv(o.pickupBranch),
      o.qtyTriples,
      o.qtySimples,
      o.qtyTriples + o.qtySimples,
      o.deposit,
      escapeCsv(o.paymentStatus),
      escapeCsv(o.originBranch),
      escapeCsv(o.location),
      o.packageCount || 0,
      escapeCsv(o.status)
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Respaldo_Pedidos_${selectedDate.replace(/\//g, '-')}_${selectedFactory}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1400px] mx-auto p-2 sm:p-4 pb-24 space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 p-2 rounded-2xl">
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
            <BarChart3 className="text-orange-600" size={28} /> Tablero ({selectedDate})
        </h2>
        <div className="flex flex-wrap items-center gap-2 justify-center">
          <div className="bg-white border rounded-xl flex items-center px-3 py-1.5 shadow-sm">
             <Filter size={14} className="text-slate-400 mr-2" />
             <select value={selectedFactory} onChange={e => setSelectedFactory(e.target.value)} className="font-bold text-xs uppercase outline-none bg-transparent">
               <option value="ALL">Todas las Fábricas</option>
               {PRODUCTION_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
             </select>
          </div>
          <button 
            onClick={handleExportCSV}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95"
          >
             <FileDown size={14} /> Excel / Backup
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

      {/* Alerta de Horarios Atrasados */}
      {overdueAnalysis.overdueOrders.length > 0 ? (
        <div className="bg-rose-50 border border-rose-200 rounded-[2rem] p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="bg-rose-600 text-white p-2.5 rounded-2xl shadow-sm">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-xs font-black text-rose-900 uppercase tracking-widest">
                  Pedidos con Horario Atrasado ({overdueAnalysis.overdueOrders.length})
                </h3>
                <p className="text-[10px] font-bold text-rose-700">
                  {overdueAnalysis.unlocatedOverdue > 0
                    ? `${overdueAnalysis.unlocatedOverdue} sin ubicar todavía — revisar producción urgente.`
                    : 'Todos ya están ubicados, pendientes de entrega.'}
                </p>
              </div>
            </div>
            <span className="bg-white text-rose-700 border border-rose-200 px-3 py-1 rounded-full text-[10px] font-black uppercase">
              <Clock size={12} className="inline mr-1" />
              {overdueAnalysis.dateRelation === 'past' ? 'Fecha pasada' : 'Hora vencida'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {overdueAnalysis.overdueOrders.slice(0, 8).map(o => (
              <div key={o.id} className="bg-white border border-rose-200 rounded-xl px-3 py-1.5 text-[10px] font-bold text-slate-700 flex items-center gap-2">
                <span className="font-black text-rose-600">#{o.id}</span>
                <span>{o.pickupTime || '--:--'}</span>
                <span className="text-slate-400">•</span>
                <span className="truncate max-w-[140px]">{o.customerName}</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${o.location ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>
                  {o.location || 'Sin ubicar'}
                </span>
              </div>
            ))}
            {overdueAnalysis.overdueOrders.length > 8 && (
              <span className="text-[10px] font-black text-rose-700 self-center px-2">
                +{overdueAnalysis.overdueOrders.length - 8} más
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl px-4 py-2.5 flex items-center justify-between text-emerald-800">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
            <CheckCircle2 size={15} className="text-emerald-600" />
            {overdueAnalysis.dateRelation === 'future'
              ? 'Control de atrasos activo (fecha futura — sin atrasos)'
              : 'Sin pedidos atrasados para el horario actual'}
          </div>
          <span className="text-[10px] font-bold text-emerald-600">{stats.totalComandas} comandas</span>
        </div>
      )}

      {/* Seccion Gráfico Horario + Composición Triples/Simples */}
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
                     <Bar name="Simples" dataKey="Simples" fill="#fb923c" radius={[4, 4, 0, 0]} barSize={20}>
                       <LabelList dataKey="Simples" position="top" style={{ fill: '#fb923c', fontSize: '9px', fontWeight: 'bold' }} />
                     </Bar>
                     <Bar name="Triples" dataKey="Triples" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={20}>
                       <LabelList dataKey="Triples" position="top" style={{ fill: '#2563eb', fontSize: '9px', fontWeight: 'bold' }} />
                     </Bar>
                   </>
                 ) : (
                   <Bar name="Comandas" dataKey="Comandas" fill="#0f172a" radius={[6, 6, 0, 0]} barSize={40}>
                     <LabelList dataKey="Comandas" position="top" style={{ fill: '#0f172a', fontSize: '10px', fontWeight: 'bold' }} />
                   </Bar>
                 )}
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Triples vs Simples */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-[11px] tracking-widest mb-2">
              <Layers size={16} className="text-orange-600" /> Triples vs. Simples
            </h3>
            <p className="text-[10px] font-bold text-slate-400">Total de unidades a producir</p>
          </div>

          <div className="h-[210px] w-full flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={82}
                    paddingAngle={4}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold'}} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs font-bold text-slate-300 uppercase">Sin datos</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-100">
              <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Triples</p>
              <p className="text-2xl font-black text-slate-800">{stats.totalTriples}</p>
              <p className="text-[10px] font-bold text-blue-600">
                {stats.gTotal > 0 ? Math.round((stats.totalTriples / stats.gTotal) * 100) : 0}%
              </p>
            </div>
            <div className="bg-orange-50/70 p-3.5 rounded-2xl border border-orange-100">
              <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Simples</p>
              <p className="text-2xl font-black text-slate-800">{stats.totalSimples}</p>
              <p className="text-[10px] font-bold text-orange-600">
                {stats.gTotal > 0 ? Math.round((stats.totalSimples / stats.gTotal) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Estado Operativo + Comparativa por Fábrica */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estado Operativo */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-[11px] tracking-widest">
              <Ticket size={16} className="text-blue-600" /> Estado Operativo
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase">{stats.totalComandas} comandas</span>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Sin Ubicar (Pendiente)', data: stats.pipeline.pending, bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' },
              { label: 'Listos para Retirar', data: stats.pipeline.ready, bar: 'bg-blue-600', badge: 'bg-blue-50 text-blue-700' },
              { label: 'En Búsqueda', data: stats.pipeline.inSearch, bar: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700' },
              { label: 'Entregados', data: stats.pipeline.delivered, bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
            ].map(stage => {
              const pct = stats.totalComandas > 0 ? Math.round((stage.data.count / stats.totalComandas) * 100) : 0;
              return (
                <div key={stage.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">{stage.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400">{stage.data.units} unid</span>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${stage.badge}`}>
                        {stage.data.count} ({pct}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${stage.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparativa por Fábrica */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-[11px] tracking-widest">
              <Factory size={16} className="text-orange-600" /> Comparativa por Fábrica
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Día completo</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {factoryComparison.map(fc => {
              const isSelected = selectedFactory === fc.value;
              return (
                <div
                  key={fc.value}
                  onClick={() => setSelectedFactory(isSelected ? 'ALL' : fc.value)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-3 ${
                    isSelected ? 'border-orange-500 bg-orange-50/40 shadow-sm' : 'border-slate-100 bg-slate-50/60 hover:border-orange-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{fc.label}</p>
                      <p className="text-2xl font-black text-slate-800">{fc.totalUnits} <span className="text-[10px] text-slate-400 uppercase">unid</span></p>
                    </div>
                    <span className="bg-white px-2 py-0.5 rounded-lg text-[9px] font-black text-slate-500 border border-slate-100">
                      {fc.count} com.
                    </span>
                  </div>
                  <div className="flex gap-3 text-[10px] font-bold text-slate-500">
                    <span>Triples: <strong className="text-blue-600">{fc.triples}</strong></span>
                    <span>Simples: <strong className="text-orange-600">{fc.simples}</strong></span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-black uppercase">
                      <span className="text-slate-400">Ubicado</span>
                      <span className="text-blue-600">{fc.prodP}%</span>
                    </div>
                    <div className="h-1.5 bg-white rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${fc.prodP}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] font-black uppercase">
                      <span className="text-slate-400">Entregado</span>
                      <span className="text-emerald-600">{fc.delivP}%</span>
                    </div>
                    <div className="h-1.5 bg-white rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${fc.delivP}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
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
                           <div className="flex items-center gap-2">
                             <span className="text-[9px] font-black text-slate-400">{b.prodUnits} unid</span>
                             <span className="text-[9px] font-black text-blue-600">{b.prodP}%</span>
                           </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${b.prodP}%` }} />
                        </div>
                     </div>
                     <div>
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Entrega</span>
                           <div className="flex items-center gap-2">
                             <span className="text-[9px] font-black text-slate-400">{b.delivUnits} unid</span>
                             <span className="text-[9px] font-black text-emerald-600">{b.delivP}%</span>
                           </div>
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
