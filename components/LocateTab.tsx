import React, { useState, useMemo } from 'react';
import { Order } from '../types';
import { updateOrderLocation } from '../services/storageService';
import { MapPin, Search, Loader2, Package, Edit3, ChevronUp, ChevronDown, XCircle, CheckCircle } from 'lucide-react';

interface LocateTabProps {
  orders: Order[];
  refreshData: () => void;
}

export const LocateTab: React.FC<LocateTabProps> = ({ orders, refreshData }) => {
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modo Edición Exclusivo
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  
  // Estados para inputs temporales
  const [locationInputs, setLocationInputs] = useState<Record<string, string>>({});
  const [packageInputs, setPackageInputs] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // 1. Pendientes (Lista de Tareas por defecto)
  const pendingOrders = useMemo(() => {
    return orders.filter(o => !o.location && o.status !== 'Entregado');
  }, [orders]);

  // 2. Resultados de Búsqueda (Lista compacta)
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    const lowerQ = searchTerm.replace(/\s+/g, '').toLowerCase(); // Ignorar espacios
    return orders.filter(o => 
        o.status !== 'Entregado' && 
        (o.id.toLowerCase().includes(lowerQ) || o.customerName.toLowerCase().includes(lowerQ))
    );
  }, [orders, searchTerm]);

  // Pedido que se está editando actualmente
  const orderBeingEdited = useMemo(() => {
      if (!editingOrderId) return null;
      return orders.find(o => o.id === editingOrderId);
  }, [orders, editingOrderId]);

  const handleEditClick = (order: Order) => {
      setEditingOrderId(order.id);
      // Precargar valores actuales en los inputs temporales
      setLocationInputs(prev => ({...prev, [order.id]: order.location || ''}));
      setPackageInputs(prev => ({...prev, [order.id]: (order.packageCount || 0).toString()}));
      
      setShowSearchPanel(false); // Cerrar buscador
      setSearchTerm(''); // Limpiar término
  };

  const handleCancelEdit = () => {
      setEditingOrderId(null);
      setLoadingId(null);
  };

  const handleSaveLocation = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const rawLoc = locationInputs[id] ?? order.location ?? '';
    const rawPkg = packageInputs[id] ?? (order.packageCount?.toString() || '0');

    if (rawLoc && rawLoc.trim() !== '') {
      setLoadingId(id);
      try {
        await updateOrderLocation(id, rawLoc.toUpperCase(), parseInt(rawPkg) || 0);
        
        // Limpiar inputs
        const newLocInputs = { ...locationInputs };
        delete newLocInputs[id];
        setLocationInputs(newLocInputs);
        
        const newPkgInputs = { ...packageInputs };
        delete newPkgInputs[id];
        setPackageInputs(newPkgInputs);
        
        refreshData();
        
        // Si estábamos en modo edición, salir
        if (editingOrderId === id) {
            handleCancelEdit();
        }
      } catch (e) {
        alert("Error guardando ubicación");
      } finally {
        setLoadingId(null);
      }
    }
  };

  // Renderizador de Tarjeta (Reutilizable)
  const renderOrderCard = (order: Order, isEditMode: boolean) => {
    const isLocated = !!order.location;
    const currentValueLoc = locationInputs[order.id] ?? order.location ?? '';
    const currentValuePkg = packageInputs[order.id] ?? (order.packageCount?.toString() || '');

    return (
        <div key={order.id} className={`p-4 rounded-lg shadow-md border-l-4 flex flex-col gap-4 animate-fade-in bg-white ${isEditMode ? 'border-blue-500 ring-4 ring-blue-50' : 'border-orange-500'}`}>
            
            {/* Cabecera de Tarjeta */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded font-mono font-bold text-sm ${isEditMode ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>
                        #{order.id}
                        </span>
                        <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded border">{order.pickupDate}</span>
                        {isLocated && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold flex items-center gap-1">
                                <CheckCircle size={10} /> UBICADO
                            </span>
                        )}
                    </div>
                    <h3 className="font-bold text-xl leading-tight text-slate-800">{order.customerName}</h3>
                    <p className="text-sm text-slate-600 mt-1">
                        {order.qtyTriples} Triples / {order.qtySimples} Simples
                    </p>
                </div>
                {isEditMode && (
                     <button 
                        onClick={handleCancelEdit}
                        className="text-slate-400 hover:text-slate-600"
                     >
                         <XCircle size={24} />
                     </button>
                )}
            </div>

            {/* Observaciones */}
            {order.notes && (
                <div className="bg-yellow-50 p-2 rounded border border-yellow-100 text-xs italic text-slate-600">
                    "{order.notes}"
                </div>
            )}

            {/* Inputs de Acción */}
            <div className="flex gap-3 items-end border-t pt-4 mt-1">
                <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase text-center mb-1">Ubicación</label>
                    <input
                        type="text"
                        placeholder="Ej: H1"
                        className={`border-2 rounded-lg p-2 w-full text-center uppercase font-black text-lg outline-none transition-all ${isEditMode ? 'border-blue-200 focus:border-blue-500 text-blue-800' : 'border-slate-200 focus:border-orange-500 text-slate-800'}`}
                        value={currentValueLoc}
                        onChange={(e) => setLocationInputs({...locationInputs, [order.id]: e.target.value})}
                        disabled={loadingId === order.id}
                        onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById(`pkg-${order.id}`)?.focus(); }}
                        autoFocus={isEditMode}
                    />
                </div>

                <div className="w-24">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase text-center mb-1">Bultos</label>
                    <div className="relative">
                        <Package className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-300" size={16} />
                        <input
                            id={`pkg-${order.id}`}
                            type="number"
                            min="0"
                            placeholder="0"
                            className={`border-2 rounded-lg p-2 w-full pl-8 text-center font-bold text-lg outline-none transition-all ${isEditMode ? 'border-blue-200 focus:border-blue-500 text-blue-800' : 'border-slate-200 focus:border-orange-500 text-slate-800'}`}
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
                    className={`h-[46px] px-4 rounded-lg flex items-center justify-center gap-2 text-white font-bold shadow-md transition-all active:scale-95 ${isEditMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'}`}
                    disabled={loadingId === order.id}
                >
                    {loadingId === order.id ? <Loader2 className="animate-spin" size={20} /> : <MapPin size={20} />}
                    <span className="hidden sm:inline">{isLocated ? 'Actualizar' : 'Guardar'}</span>
                </button>
            </div>
        </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4 pb-20">
      
      {/* Header & Search Toggle (Solo visible si NO estamos editando, para no distraer) */}
      {!editingOrderId && (
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
      )}

      {/* BLUE PANEL: Search (Solo búsqueda, resultados compactos) */}
      {showSearchPanel && !editingOrderId && (
        <div className="mb-8 bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-inner animate-fade-in">
            <div className="flex items-center gap-2 mb-4 text-blue-800">
                <Edit3 size={20} />
                <h3 className="font-bold">Buscar para Editar</h3>
            </div>
            
            <div className="relative mb-2">
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

            {/* Compact Search Results List */}
            {searchTerm && (
                <div className="bg-white border border-blue-200 rounded-lg max-h-60 overflow-y-auto shadow-lg">
                    {searchResults.length === 0 ? (
                        <p className="p-4 text-center text-slate-400 italic text-sm">No se encontraron pedidos.</p>
                    ) : (
                        searchResults.map(r => (
                            <div 
                                key={r.id}
                                onClick={() => handleEditClick(r)}
                                className="p-3 border-b border-slate-100 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
                            >
                                <div>
                                    <span className="font-bold text-blue-700 mr-2">#{r.id}</span>
                                    <span className="font-medium text-slate-800">{r.customerName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {r.location ? (
                                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">
                                            {r.location}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                                            PENDIENTE
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
      )}

      {/* MODE: EDITING (Instancia Única) */}
      {editingOrderId && orderBeingEdited && (
          <div className="mb-8 animate-slide-up">
              <div className="bg-blue-600 text-white p-3 rounded-t-xl flex justify-between items-center">
                  <h3 className="font-bold flex items-center gap-2">
                      <Edit3 size={18} /> Modo Edición
                  </h3>
                  <button onClick={handleCancelEdit} className="text-xs bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded-full transition-colors">
                      Cancelar
                  </button>
              </div>
              <div className="bg-blue-50 p-6 rounded-b-xl border-x border-b border-blue-200 shadow-lg">
                  {renderOrderCard(orderBeingEdited, true)}
              </div>
          </div>
      )}

      {/* MODE: PENDING LIST (Solo visible si NO estamos editando) */}
      {!editingOrderId && (
          <div className="animate-fade-in">
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
      )}
    </div>
  );
};