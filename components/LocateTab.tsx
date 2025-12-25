
import React, { useState, useMemo } from 'react';
import { Order, ProductionBranch } from '../types';
import { updateOrderLocation } from '../services/storageService';
import { PRODUCTION_BRANCHES, PICKUP_DATES } from '../constants';
import { MapPin, Search, Loader2, Package, Edit3, ArrowLeft, RefreshCw, Factory, Filter, Calendar } from 'lucide-react';

interface LocateTabProps {
  orders: Order[];
  refreshData: () => void;
}

export const LocateTab: React.FC<LocateTabProps> = ({ orders, refreshData }) => {
  const [mode, setMode] = useState<'locate' | 'edit'>('locate');
  const [selectedDate, setSelectedDate] = useState(PICKUP_DATES[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFactory, setFilterFactory] = useState<string>('ALL');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [locationInputs, setLocationInputs] = useState<Record<string, string>>({});
  const [packageInputs, setPackageInputs] = useState<Record<string, string>>({});

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const toggleMode = () => {
    setMode(prev => prev === 'locate' ? 'edit' : 'locate');
    setSearchTerm(''); 
  };

  const filteredOrders = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    
    // REQUERIMIENTO: Si no hay término de búsqueda, no mostrar nada
    if (!q) return [];

    return orders.filter(o => {
        if (o.pickupDate !== selectedDate) return false;
        if (o.status === 'Entregado') return false;
        if (filterFactory !== 'ALL' && o.originBranch !== filterFactory) return false;

        const hasLoc = !!(o.location && o.location.trim() !== '');
        if (mode === 'locate' && hasLoc) return false;
        if (mode === 'edit' && !hasLoc) return false;

        return (
            o.id.toLowerCase().includes(q) ||
            o.customerName.toLowerCase().includes(q) ||
            o.address.toLowerCase().includes(q)
        );
    });
  }, [orders, searchTerm, mode, filterFactory, selectedDate]);

  const handleSaveLocation = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const rawLoc = locationInputs[id] ?? order.location ?? '';
    const rawPkg = packageInputs[id] ?? (order.packageCount?.toString() || '0');

    if (rawLoc && rawLoc.trim() !== '') {
      setLoadingId(id);
      try {
        const allowOverwrite = mode === 'edit';
        await updateOrderLocation(id, rawLoc.toUpperCase(), parseInt(rawPkg) || 0, allowOverwrite);
        
        const newLocInputs = { ...locationInputs };
        delete newLocInputs[id];
        setLocationInputs(newLocInputs);
        
        const newPkgInputs = { ...packageInputs };
        delete newPkgInputs[id];
        setPackageInputs(newPkgInputs);
        
        refreshData();
      } catch (e: any) {
        alert(e.message || "Error al guardar ubicación");
        refreshData();
      } finally {
        setLoadingId(null);
      }
    }
  };

  const renderCard = (order: Order) => {
      const currentValueLoc = locationInputs[order.id] ?? order.location ?? '';
      const rawPkgVal = packageInputs[order.id] ?? (order.packageCount ? order.packageCount.toString() : '');
      const currentValuePkg = rawPkgVal === '0' ? '' : rawPkgVal;

      const isCentral = order.originBranch === ProductionBranch.CENTRAL;
      const factoryBadgeStyle = isCentral 
        ? 'bg-sky-100 text-sky-800 border-sky-200' 
        : 'bg-purple-100 text-purple-800 border-purple-200';

      return (
        <div key={order.id} className={`bg-white p-4 rounded-xl shadow-sm border-l-4 flex flex-col gap-3 animate-fade-in ${mode === 'edit' ? 'border-blue-500' : 'border-orange-500'}`}>
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="bg-slate-100 text-slate-700 font-mono font-bold px-2 py-0.5 rounded text-sm">#{order.id}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-bold flex items-center gap-1 uppercase ${factoryBadgeStyle}`}>
                             <Factory size={10} /> {order.originBranch}
                        </span>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 rounded">{order.pickupTime}</span>
                    </div>
                    <h3 className="font-bold text-slate-800 leading-tight truncate max-w-[200px] uppercase">{order.customerName}</h3>
                </div>
                <div className="text-right text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded">
                    {order.qtyTriples} T | {order.qtySimples} S
                </div>
            </div>

            <div className="flex gap-2 items-end mt-1">
                <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Ubicación</label>
                    <input
                        type="text"
                        placeholder="H1"
                        className="border-2 border-slate-200 rounded-lg p-2 w-full text-center uppercase font-black text-xl outline-none focus:border-orange-500 transition-colors"
                        value={currentValueLoc}
                        onChange={(e) => setLocationInputs({...locationInputs, [order.id]: e.target.value})}
                        disabled={loadingId === order.id}
                        onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById(`pkg-${order.id}`)?.focus(); }}
                    />
                </div>
                <div className="w-20">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Bultos</label>
                    <input
                        id={`pkg-${order.id}`}
                        type="number"
                        className="border-2 border-slate-200 rounded-lg p-2 w-full text-center font-bold text-xl outline-none focus:border-orange-500 transition-colors"
                        value={currentValuePkg}
                        onChange={(e) => setPackageInputs({...packageInputs, [order.id]: e.target.value})}
                        disabled={loadingId === order.id}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLocation(order.id); }}
                        onWheel={(e) => e.currentTarget.blur()}
                    />
                </div>
                <button
                    onClick={() => handleSaveLocation(order.id)}
                    disabled={loadingId === order.id}
                    className={`h-[50px] px-4 rounded-lg text-white font-bold shadow-md transition-all active:scale-95 flex items-center justify-center ${mode === 'edit' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'}`}
                >
                    {loadingId === order.id ? <Loader2 className="animate-spin" size={24} /> : <MapPin size={24} />}
                </button>
            </div>
        </div>
      );
  };

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
              {mode === 'locate' ? <><Package className="text-orange-600" /> Ubicar Pendientes</> : <><Edit3 className="text-blue-600" /> Corregir Ubicación</>}
          </h2>
          <div className="flex gap-2">
            <button 
                onClick={handleManualRefresh} 
                title="Sincronizar Datos"
                className={`p-2.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:rotate-180 ${isRefreshing ? 'animate-spin text-orange-600 border-orange-200' : ''}`}
            >
                <RefreshCw size={20} />
            </button>
            <button 
                onClick={toggleMode} 
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold shadow-sm border transition-all ${mode === 'locate' ? 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50' : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'}`}
            >
               {mode === 'locate' ? <><Edit3 size={16} /> Ver Ubicados</> : <><ArrowLeft size={16} /> Volver</>}
            </button>
          </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none z-10" size={16} />
                  <select 
                    className="w-full pl-12 p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none font-bold text-sm text-slate-700 appearance-none shadow-sm"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                  >
                    {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
              </div>
              <div className="relative">
                  <Filter className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none z-10" size={16} />
                  <select 
                    className="w-full pl-12 p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none font-bold text-sm text-slate-700 appearance-none shadow-sm"
                    value={filterFactory}
                    onChange={e => setFilterFactory(e.target.value)}
                  >
                      <option value="ALL">Fábrica: Todas</option>
                      {PRODUCTION_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
              </div>
          </div>
          <div className="relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text"
                className="w-full pl-11 p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm shadow-inner"
                placeholder="Ingresa número de comanda o cliente..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
      </div>

      <div className="space-y-4">
          {!searchTerm.trim() ? (
             <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 flex flex-col items-center gap-3">
                 <Search size={48} className="opacity-10" />
                 <div className="max-w-xs px-4">
                     <p className="font-bold text-slate-600 uppercase text-xs tracking-widest">Esperando búsqueda</p>
                     <p className="text-[11px] mt-1">Escribe un <b>Número de Comanda</b> o <b>Nombre</b> para ver los resultados.</p>
                 </div>
             </div>
          ) : filteredOrders.length === 0 ? (
             <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 flex flex-col items-center gap-3">
                 <Package size={48} className="opacity-20" />
                 <div className="max-w-xs">
                     <p className="font-bold text-slate-500">No se encontraron resultados.</p>
                     <p className="text-xs mt-1 text-slate-400">Prueba con otro número o verifica los filtros superiores.</p>
                 </div>
             </div>
          ) : (
             filteredOrders.map(order => renderCard(order))
          )}
      </div>
    </div>
  );
};
