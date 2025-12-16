import React, { useState, useMemo } from 'react';
import { Order } from '../types';
import { updateOrderLocation } from '../services/storageService';
import { MapPin, Search, Loader2, Package, Edit3, ArrowLeft, CheckCircle, XCircle, Factory } from 'lucide-react';

interface LocateTabProps {
  orders: Order[];
  refreshData: () => void;
}

export const LocateTab: React.FC<LocateTabProps> = ({ orders, refreshData }) => {
  // 'locate' = Default view (Only pending)
  // 'edit' = Correction view (All active orders)
  const [mode, setMode] = useState<'locate' | 'edit'>('locate');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Temporary inputs state
  const [locationInputs, setLocationInputs] = useState<Record<string, string>>({});
  const [packageInputs, setPackageInputs] = useState<Record<string, string>>({});

  // --- FILTERING LOGIC ---
  
  const filteredOrders = useMemo(() => {
    // Normalize search term
    const q = searchTerm.toLowerCase().trim();

    return orders.filter(o => {
        // 1. Filter out already delivered (Finished) orders in both modes
        if (o.status === 'Entregado') return false;

        // 2. Mode Specific Filters
        if (mode === 'locate') {
            // Locate Mode: ONLY show orders WITHOUT location
            if (o.location) return false;
        } 
        // Edit Mode: Show EVERYTHING (Located and Not Located) so we can fix mistakes

        // 3. Text Search Filter (ID, Name, Address)
        if (!q) return true; // Show all valid items if no search
        
        return (
            o.id.toLowerCase().includes(q) ||
            o.customerName.toLowerCase().includes(q) ||
            o.address.toLowerCase().includes(q)
        );
    });
  }, [orders, searchTerm, mode]);


  // --- HANDLERS ---

  const toggleMode = () => {
      if (mode === 'locate') {
          setMode('edit');
      } else {
          setMode('locate');
      }
      setSearchTerm(''); // Clear search when switching contexts
      setLocationInputs({});
      setPackageInputs({});
  };

  const handleSaveLocation = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    // Get input value or fallback to existing order value
    const rawLoc = locationInputs[id] ?? order.location ?? '';
    const rawPkg = packageInputs[id] ?? (order.packageCount?.toString() || '0');

    if (rawLoc && rawLoc.trim() !== '') {
      setLoadingId(id);
      try {
        // Determine if we allow overwriting
        // mode === 'edit' -> TRUE (We want to correct/overwrite)
        // mode === 'locate' -> FALSE (We want to be safe and block duplicates)
        const allowOverwrite = mode === 'edit';

        await updateOrderLocation(
            id, 
            rawLoc.toUpperCase(), 
            parseInt(rawPkg) || 0,
            allowOverwrite 
        );
        
        // Clear inputs for this ID
        const newLocInputs = { ...locationInputs };
        delete newLocInputs[id];
        setLocationInputs(newLocInputs);
        
        const newPkgInputs = { ...packageInputs };
        delete newPkgInputs[id];
        setPackageInputs(newPkgInputs);
        
        refreshData();
      } catch (e: any) {
        // Display the friendly concurrency error message from the service
        alert(e.message || "Error guardando ubicación");
        refreshData(); // Refresh data so the user sees the real state
      } finally {
        setLoadingId(null);
      }
    }
  };

  // --- RENDER CARD ---
  const renderCard = (order: Order) => {
      const isLocated = !!order.location;
      const currentValueLoc = locationInputs[order.id] ?? order.location ?? '';
      
      // Determine Package Input Value (Hide 0)
      const rawPkgVal = packageInputs[order.id] ?? (order.packageCount ? order.packageCount.toString() : '');
      const currentValuePkg = rawPkgVal === '0' ? '' : rawPkgVal;

      // Visual style depends on mode
      const borderColor = mode === 'edit' ? 'border-blue-400 ring-2 ring-blue-50' : 'border-orange-400';
      
      // Factory Colors
      const isCentral = order.originBranch === 'Central';
      const factoryBadgeColor = isCentral 
        ? 'bg-sky-100 text-sky-800 border-sky-200' 
        : 'bg-purple-100 text-purple-800 border-purple-200';

      return (
        <div key={order.id} className={`bg-white p-4 rounded-lg shadow-sm border-l-4 flex flex-col gap-3 animate-fade-in ${borderColor}`}>
            
            {/* Card Header */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="bg-slate-100 text-slate-700 font-mono font-bold px-2 py-0.5 rounded text-sm">
                            #{order.id}
                        </span>
                        
                        {/* Factory Badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-bold flex items-center gap-1 uppercase ${factoryBadgeColor}`}>
                             <Factory size={10} /> {order.originBranch}
                        </span>

                        <span className="text-[10px] text-slate-500 border border-slate-200 px-1.5 rounded">
                            {order.pickupDate}
                        </span>
                        {isLocated && (
                             <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                <CheckCircle size={10} /> UBICADO
                             </span>
                        )}
                    </div>
                    <h3 className="font-bold text-slate-800 leading-tight">{order.customerName}</h3>
                    {order.address && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[250px]">{order.address}</p>
                    )}
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold text-slate-600">
                        {order.qtyTriples} T <span className="text-slate-300">|</span> {order.qtySimples} S
                    </div>
                </div>
            </div>

            {/* Inputs Row */}
            <div className="flex gap-2 items-end mt-2">
                <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Ubicación</label>
                    <input
                        type="text"
                        placeholder="Ej: H1"
                        className={`border-2 rounded-lg p-2 w-full text-center uppercase font-black text-lg outline-none transition-colors ${
                             mode === 'edit' ? 'border-blue-200 focus:border-blue-500 text-blue-800' : 'border-slate-200 focus:border-orange-500 text-slate-800'
                        }`}
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
                        min="0"
                        placeholder="0"
                        className={`border-2 rounded-lg p-2 w-full text-center font-bold text-lg outline-none transition-colors ${
                             mode === 'edit' ? 'border-blue-200 focus:border-blue-500 text-blue-800' : 'border-slate-200 focus:border-orange-500 text-slate-800'
                        }`}
                        value={currentValuePkg}
                        onChange={(e) => setPackageInputs({...packageInputs, [order.id]: e.target.value})}
                        disabled={loadingId === order.id}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLocation(order.id); }}
                        onClick={e => e.currentTarget.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                    />
                </div>

                <button
                    onClick={() => handleSaveLocation(order.id)}
                    disabled={loadingId === order.id}
                    className={`h-[46px] px-3 rounded-lg flex items-center justify-center text-white font-bold shadow-sm active:scale-95 transition-colors ${
                        mode === 'edit' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'
                    }`}
                >
                    {loadingId === order.id ? <Loader2 className="animate-spin" size={20} /> : <MapPin size={20} />}
                </button>
            </div>
        </div>
      );
  };


  return (
    <div className="max-w-3xl mx-auto p-4 pb-20">
      
      {/* HEADER & TOGGLE */}
      <div className="flex items-center justify-between mb-6">
          <h2 className={`text-xl font-bold flex items-center gap-2 ${mode === 'edit' ? 'text-blue-700' : 'text-slate-800'}`}>
              {mode === 'locate' ? (
                  <>
                    <Package className="text-orange-600" /> Ubicar Pendientes
                  </>
              ) : (
                  <>
                    <Edit3 className="text-blue-600" /> Corregir Ubicaciones
                  </>
              )}
          </h2>

          <button
            onClick={toggleMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all shadow-sm ${
                mode === 'locate'
                 ? 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
                 : 'bg-slate-800 text-white hover:bg-slate-900'
            }`}
          >
             {mode === 'locate' ? (
                 <> <Edit3 size={16} /> Editar / Corregir </>
             ) : (
                 <> <ArrowLeft size={16} /> Volver a Ubicar </>
             )}
          </button>
      </div>

      {/* MAIN SEARCH BAR (Context Aware) */}
      <div className={`p-4 rounded-xl mb-6 shadow-sm border transition-colors ${
          mode === 'edit' ? 'bg-blue-600 border-blue-700' : 'bg-orange-600 border-orange-700'
      }`}>
          <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/70" size={20} />
              <input 
                type="text"
                className="w-full pl-12 p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 font-medium outline-none focus:bg-white focus:text-slate-900 focus:placeholder-slate-400 transition-all"
                placeholder={mode === 'locate' ? "Buscar Pendiente por N°, Nombre, Dirección..." : "Buscar CUALQUIER pedido para corregir..."}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
              />
          </div>
          <p className="text-white/60 text-xs mt-2 ml-2">
              {mode === 'locate' 
                ? "Mostrando solo pedidos que FALTA ubicar." 
                : "Mostrando TODOS los pedidos (ubicados y pendientes)."
              }
          </p>
      </div>

      {/* LIST */}
      <div className="space-y-4">
          {filteredOrders.length === 0 ? (
             <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
                 {searchTerm ? (
                     <p>No se encontraron resultados.</p>
                 ) : (
                     mode === 'locate' ? (
                        <>
                            <CheckCircle size={48} className="mx-auto mb-4 text-green-500 opacity-50" />
                            <p className="font-bold text-slate-600">¡Todo Ubicado!</p>
                            <p className="text-sm">No hay pedidos pendientes de ubicación.</p>
                        </>
                     ) : (
                        <p>Use el buscador para encontrar el pedido a corregir.</p>
                     )
                 )}
             </div>
          ) : (
             filteredOrders.map(order => renderCard(order))
          )}
      </div>

    </div>
  );
};