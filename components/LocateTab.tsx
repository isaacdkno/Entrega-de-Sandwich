import React, { useState, useMemo } from 'react';
import { Order } from '../types';
import { updateOrderLocation } from '../services/storageService';
import { MapPin, Search, Loader2, Package, Edit3, ChevronUp, ChevronDown } from 'lucide-react';

interface LocateTabProps {
  orders: Order[];
  refreshData: () => void;
}

export const LocateTab: React.FC<LocateTabProps> = ({ orders, refreshData }) => {
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State to hold temporary input values. 
  const [locationInputs, setLocationInputs] = useState<Record<string, string>>({});
  const [packageInputs, setPackageInputs] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // 1. Pending Orders (The default To-Do List)
  const pendingOrders = useMemo(() => {
    return orders.filter(o => !o.location && o.status !== 'Entregado');
  }, [orders]);

  // 2. Search Results (For Editing existing locations)
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    const lowerQ = searchTerm.toLowerCase();
    // Search in ALL active orders (Pending + Ready)
    return orders.filter(o => 
        o.status !== 'Entregado' && 
        (o.id.toLowerCase().includes(lowerQ) || o.customerName.toLowerCase().includes(lowerQ))
    );
  }, [orders, searchTerm]);

  const handleSaveLocation = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const rawLoc = locationInputs[id] ?? order.location ?? '';
    const rawPkg = packageInputs[id] ?? (order.packageCount?.toString() || '0');

    if (rawLoc && rawLoc.trim() !== '') {
      setLoadingId(id);
      try {
        await updateOrderLocation(id, rawLoc.toUpperCase(), parseInt(rawPkg));
        
        // Clear inputs
        const newLocInputs = { ...locationInputs };
        delete newLocInputs[id];
        setLocationInputs(newLocInputs);
        
        const newPkgInputs = { ...packageInputs };
        delete newPkgInputs[id];
        setPackageInputs(newPkgInputs);
        
        refreshData();
        // If searching, we might want to clear search, but keeping it allows verifying the edit
      } catch (e) {
        alert("Error guardando ubicación");
      } finally {
        setLoadingId(null);
      }
    }
  };

  // Helper to render a single order card
  const renderOrderCard = (order: Order, isEditMode: boolean) => {
    const isLocated = !!order.location;
    const currentValueLoc = locationInputs[order.id] ?? order.location ?? '';
    const currentValuePkg = packageInputs[order.id] ?? (order.packageCount?.toString() || '');

    return (
        <div key={order.id} className={`p-4 rounded-lg shadow border-l-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between animate-fade-in bg-white ${isEditMode ? 'border-blue-400 ring-1 ring-blue-100' : 'border-orange-400'}`}>
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-1 rounded font-mono font-bold text-xs ${isEditMode ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>
                    #{order.id}
                    </span>
                    <span className="text-xs text-slate-500">{order.pickupDate}</span>
                    {isLocated && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                            UBICADO
                        </span>
                    )}
                </div>
                <h3 className="font-bold text-lg leading-tight text-slate-800">{order.customerName}</h3>
                <p className="text-sm text-slate-600">
                    {order.qtyTriples} Triples / {order.qtySimples} Simples
                </p>
                <p className="text-xs text-slate-400 mt-1 truncate italic">
                    {order.notes || 'Sin observaciones'}
                </p>
            </div>

            <div className="flex gap-2 w-full sm:w-auto items-end">
                <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase text-center mb-1">Ubicación</label>
                    <div className="flex gap-2">
                        <input
                        type="text"
                        placeholder="Ej: H1"
                        className={`border rounded p-2 w-24 text-center uppercase font-bold focus:ring-2 outline-none ${isEditMode ? 'border-blue-300 focus:ring-blue-400 text-blue-800' : 'focus:ring-orange-400'}`}
                        value={currentValueLoc}
                        onChange={(e) => setLocationInputs({...locationInputs, [order.id]: e.target.value})}
                        disabled={loadingId === order.id}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLocation(order.id); }}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase text-center mb-1">Paquetes</label>
                    <div className="relative">
                        <Package className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="number"
                            min="0"
                            placeholder="0"
                            className={`border rounded p-2 w-20 pl-7 text-center font-bold focus:ring-2 outline-none ${isEditMode ? 'border-blue-300 focus:ring-blue-400 text-blue-800' : 'focus:ring-orange-400'}`}
                            value={currentValuePkg}
                            onChange={(e) => setPackageInputs({...packageInputs, [order.id]: e.target.value})}
                            disabled={loadingId === order.id}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLocation(order.id); }}
                            onWheel={(e) => e.currentTarget.blur()}
                        />
                    </div>
                </div>

                <button
                    onClick={() => handleSaveLocation(order.id)}
                    className={`text-white p-2 rounded flex items-center gap-2 disabled:opacity-50 shadow-sm ${isEditMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-700'}`}
                    disabled={loadingId === order.id}
                >
                    {loadingId === order.id ? <Loader2 className="animate-spin" size={18} /> : <MapPin size={18} />}
                    <span className="hidden sm:inline">{isLocated ? 'Actualizar' : 'Guardar'}</span>
                </button>
            </div>
        </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4 pb-20">
      
      {/* Header & Search Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-800">Ubicar Pedidos</h2>
        
        <button 
            onClick={() => setShowSearchPanel(!showSearchPanel)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all shadow-sm ${
                showSearchPanel 
                ? 'bg-blue-600 text-white ring-2 ring-blue-300' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
        >
            {showSearchPanel ? <ChevronUp size={16} /> : <Search size={16} />}
            {showSearchPanel ? 'Ocultar Búsqueda' : 'Buscar / Editar Ubicación'}
        </button>
      </div>

      {/* BLUE PANEL: Search & Edit Area */}
      {showSearchPanel && (
        <div className="mb-8 bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-inner animate-fade-in">
            <div className="flex items-center gap-2 mb-4 text-blue-800">
                <Edit3 size={20} />
                <h3 className="font-bold">Buscar para Editar o Ubicar</h3>
            </div>
            
            <div className="relative mb-4">
                <input 
                    type="text" 
                    placeholder="Ingrese Nombre o N° Comanda..." 
                    className="w-full p-3 pl-10 rounded-lg border border-blue-200 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    autoFocus
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-300" size={18} />
            </div>

            {/* Search Results */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                {searchTerm && searchResults.length === 0 && (
                    <p className="text-center text-slate-400 py-4 text-sm italic">No se encontraron pedidos.</p>
                )}
                {searchResults.map(order => renderOrderCard(order, true))}
            </div>
        </div>
      )}

      {/* ORANGE SECTION: Pending List (To-Do) */}
      <div className="mb-4 flex items-center gap-2">
         <div className="h-px flex-1 bg-slate-200"></div>
         <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pendientes de Ubicación</span>
         <div className="h-px flex-1 bg-slate-200"></div>
      </div>

      <div className="space-y-4">
        {pendingOrders.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
            <Package size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium">¡Todo al día!</p>
            <p className="text-sm">No hay pedidos pendientes de ubicación.</p>
          </div>
        ) : (
          pendingOrders.map(order => renderOrderCard(order, false))
        )}
      </div>
    </div>
  );
};