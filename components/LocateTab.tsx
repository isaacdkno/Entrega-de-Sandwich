import React, { useState, useMemo } from 'react';
import { Order } from '../types';
import { updateOrderLocation } from '../services/storageService';
import { MapPin, Search, Loader2, Package, Edit3 } from 'lucide-react';

interface LocateTabProps {
  orders: Order[];
  refreshData: () => void;
}

export const LocateTab: React.FC<LocateTabProps> = ({ orders, refreshData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // State to hold temporary input values. 
  // If a key doesn't exist here, we fall back to the order's actual data.
  const [locationInputs, setLocationInputs] = useState<Record<string, string>>({});
  const [packageInputs, setPackageInputs] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    // Base: Active orders (not delivered yet)
    const activeOrders = orders.filter(o => o.status !== 'Entregado');

    // If searching: Search ALL active orders (allows editing existing locations)
    if (searchTerm) {
      const lowerQ = searchTerm.toLowerCase();
      return activeOrders.filter(o => 
        o.id.toLowerCase().includes(lowerQ) || 
        o.customerName.toLowerCase().includes(lowerQ)
      );
    }

    // If NOT searching: Show only orders that need location (To-Do List)
    return activeOrders.filter(o => !o.location);
  }, [orders, searchTerm]);

  const handleSaveLocation = async (id: string) => {
    // Get value from state OR fallback to existing order value (for editing without re-typing everything)
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const rawLoc = locationInputs[id] ?? order.location ?? '';
    const rawPkg = packageInputs[id] ?? (order.packageCount?.toString() || '0');

    if (rawLoc && rawLoc.trim() !== '') {
      setLoadingId(id);
      try {
        await updateOrderLocation(id, rawLoc.toUpperCase(), parseInt(rawPkg));
        
        // Clear inputs from state to reflect "saved" status and allow re-renders to show DB data
        const newLocInputs = { ...locationInputs };
        delete newLocInputs[id];
        setLocationInputs(newLocInputs);
        
        const newPkgInputs = { ...packageInputs };
        delete newPkgInputs[id];
        setPackageInputs(newPkgInputs);
        
        refreshData();
        // If we are in "search mode", we might want to clear search to go back to list, 
        // but keeping it allows verifying the change.
      } catch (e) {
        alert("Error guardando ubicación");
      } finally {
        setLoadingId(null);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Ubicar Pedidos Elaborados</h2>
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por comanda o nombre (incluso ya ubicados)..."
            className="w-full pl-10 p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2 ml-1">
            {searchTerm 
                ? "Buscando en todos los pedidos activos..." 
                : "Mostrando solo pedidos pendientes de ubicación."}
        </p>
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-10 text-slate-500 bg-white rounded-lg border border-dashed">
            {searchTerm 
                ? "No se encontraron pedidos con ese criterio." 
                : "¡Todo al día! No hay pedidos pendientes de ubicación."}
          </div>
        ) : (
          filteredOrders.map(order => {
            const isLocated = !!order.location;
            // Determine values: State (User typing) -> DB (Existing) -> Empty
            const currentValueLoc = locationInputs[order.id] ?? order.location ?? '';
            const currentValuePkg = packageInputs[order.id] ?? (order.packageCount?.toString() || '');

            return (
            <div key={order.id} className={`bg-white p-4 rounded-lg shadow border-l-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between animate-fade-in ${isLocated ? 'border-blue-400 bg-blue-50' : 'border-orange-400'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded font-mono font-bold text-xs">
                    #{order.id}
                  </span>
                  <span className="text-xs text-slate-500">{order.pickupDate}</span>
                  {isLocated && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                          <Edit3 size={10} /> EDITAR
                      </span>
                  )}
                </div>
                <h3 className="font-bold text-lg leading-tight">{order.customerName}</h3>
                <p className="text-sm text-slate-600">
                  {order.qtyTriples} Triples / {order.qtySimples} Simples
                </p>
                <p className="text-xs text-slate-400 mt-1 truncate">
                  {order.notes}
                </p>
              </div>

              <div className="flex gap-2 w-full sm:w-auto items-end">
                <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase text-center mb-1">Ubicación</label>
                    <div className="flex gap-2">
                        <input
                        type="text"
                        placeholder="Ej: H1a"
                        className={`border rounded p-2 w-24 text-center uppercase font-bold focus:ring-2 outline-none ${isLocated ? 'border-blue-300 focus:ring-blue-400 text-blue-800' : 'focus:ring-orange-400'}`}
                        value={currentValueLoc}
                        onChange={(e) => setLocationInputs({...locationInputs, [order.id]: e.target.value})}
                        disabled={loadingId === order.id}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveLocation(order.id);
                        }}
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
                            className={`border rounded p-2 w-20 pl-7 text-center font-bold focus:ring-2 outline-none ${isLocated ? 'border-blue-300 focus:ring-blue-400 text-blue-800' : 'focus:ring-orange-400'}`}
                            value={currentValuePkg}
                            onChange={(e) => setPackageInputs({...packageInputs, [order.id]: e.target.value})}
                            disabled={loadingId === order.id}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveLocation(order.id);
                            }}
                            onWheel={(e) => e.currentTarget.blur()}
                        />
                    </div>
                </div>

                <button
                onClick={() => handleSaveLocation(order.id)}
                className={`text-white p-2 rounded flex items-center gap-2 disabled:opacity-50 ${isLocated ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-700'}`}
                disabled={loadingId === order.id}
                >
                {loadingId === order.id ? <Loader2 className="animate-spin" size={18} /> : <MapPin size={18} />}
                <span className="hidden sm:inline">{isLocated ? 'Actualizar' : 'Guardar'}</span>
                </button>
              </div>
            </div>
          )})
        )}
      </div>
    </div>
  );
};