import React, { useState, useMemo } from 'react';
import { Order } from '../types';
import { updateOrderLocation } from '../services/storageService';
import { MapPin, Search, Loader2, Package } from 'lucide-react';

interface LocateTabProps {
  orders: Order[];
  refreshData: () => void;
}

export const LocateTab: React.FC<LocateTabProps> = ({ orders, refreshData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [locationInputs, setLocationInputs] = useState<Record<string, string>>({});
  const [packageInputs, setPackageInputs] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const pendingLocationOrders = useMemo(() => {
    return orders.filter(o => !o.location && o.status !== 'Entregado');
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return pendingLocationOrders;
    const lowerQ = searchTerm.toLowerCase();
    return pendingLocationOrders.filter(o => 
      o.id.toLowerCase().includes(lowerQ) || 
      o.customerName.toLowerCase().includes(lowerQ)
    );
  }, [pendingLocationOrders, searchTerm]);

  const handleSaveLocation = async (id: string) => {
    const loc = locationInputs[id];
    const pkgCount = parseInt(packageInputs[id] || '0');

    if (loc && loc.trim() !== '') {
      setLoadingId(id);
      try {
        await updateOrderLocation(id, loc.toUpperCase(), pkgCount);
        
        // Clear input from state
        const newLocInputs = { ...locationInputs };
        delete newLocInputs[id];
        setLocationInputs(newLocInputs);
        
        const newPkgInputs = { ...packageInputs };
        delete newPkgInputs[id];
        setPackageInputs(newPkgInputs);
        
        refreshData();
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
            placeholder="Buscar por comanda o nombre..."
            className="w-full pl-10 p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-10 text-slate-500 bg-white rounded-lg border border-dashed">
            No hay pedidos pendientes de ubicación que coincidan.
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.id} className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-400 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between animate-fade-in">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded font-mono font-bold text-xs">
                    #{order.id}
                  </span>
                  <span className="text-xs text-slate-500">{order.pickupDate}</span>
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
                        className="border rounded p-2 w-24 text-center uppercase font-bold focus:ring-2 focus:ring-orange-400 outline-none"
                        value={locationInputs[order.id] || ''}
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
                            className="border rounded p-2 w-20 pl-7 text-center font-bold focus:ring-2 focus:ring-orange-400 outline-none"
                            value={packageInputs[order.id] || ''}
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
                className="bg-slate-800 text-white p-2 rounded hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50"
                disabled={!locationInputs[order.id] || loadingId === order.id}
                >
                {loadingId === order.id ? <Loader2 className="animate-spin" size={18} /> : <MapPin size={18} />}
                <span className="hidden sm:inline">Guardar</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};