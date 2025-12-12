import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, PaymentStatus } from '../types';
import { markOrderDelivered } from '../services/storageService';
import { generateTicketPDF } from '../services/pdfService';
import { PICKUP_BRANCHES } from '../constants';
import { Search, Printer, CheckCircle, AlertCircle, Filter, Loader2, Clock, AlertTriangle, PackageCheck, MapPin, Phone, Package, Factory } from 'lucide-react';

interface DeliverTabProps {
  orders: Order[];
  refreshData: () => void;
}

export const DeliverTab: React.FC<DeliverTabProps> = ({ orders, refreshData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  
  // Estados para la interacción de entrega
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    // 1. Start with all orders (do NOT filter out delivered ones)
    let result = orders;

    // 2. Filter by Branch
    if (filterBranch) {
      result = result.filter(o => o.pickupBranch === filterBranch);
    }

    // 3. Filter by Search Term
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(o => 
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.phone.includes(q) ||
        o.address.toLowerCase().includes(q) // Added address search
      );
    }

    // 4. Sort: Active (Pending/Ready) first, Delivered last
    return result.sort((a, b) => {
        // If status is different, prioritize non-delivered
        if (a.status === OrderStatus.DELIVERED && b.status !== OrderStatus.DELIVERED) return 1;
        if (a.status !== OrderStatus.DELIVERED && b.status === OrderStatus.DELIVERED) return -1;
        
        // If status is same group, sort by ID or Name
        return a.customerName.localeCompare(b.customerName);
    });
  }, [orders, searchTerm, filterBranch]);

  const handlePrint = (order: Order) => {
    generateTicketPDF(order);
  };

  const handleDeliverClick = (orderId: string) => {
    if (confirmId === orderId) {
      // Segundo clic: Confirmar
      executeDeliver(orderId);
    } else {
      // Primer clic: Armar confirmación
      setConfirmId(orderId);
      // Resetear confirmación si no confirma en 3 segundos
      setTimeout(() => setConfirmId(null), 3000);
    }
  };

  const executeDeliver = async (id: string) => {
    setProcessingId(id);
    try {
      await markOrderDelivered(id);
      setSearchTerm(''); 
      refreshData();
    } catch (e) {
      alert("Error de conexión al entregar");
    } finally {
      setProcessingId(null);
      setConfirmId(null);
    }
  };

  const formatTime = (isoString: string | null) => {
      if (!isoString) return '??:??';
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusHeader = (order: Order) => {
      if (order.status === OrderStatus.DELIVERED) {
          return {
              color: 'bg-teal-700', 
              text: `ENTREGADO A LAS ${formatTime(order.deliveredAt)}`
          };
      }
      if (order.location) {
          return {
              color: 'bg-green-600',
              text: `UBICACIÓN: ${order.location}`
          };
      }
      return {
          color: 'bg-red-500',
          text: 'PENDIENTE DE ELABORACIÓN / SIN UBICACIÓN'
      };
  };

  const getPaymentBadge = (status: PaymentStatus) => {
      switch (status) {
          case PaymentStatus.PAID: return <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded border border-green-200">PAGADO</span>;
          case PaymentStatus.PARTIAL: return <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded border border-yellow-200">CON SEÑA</span>;
          case PaymentStatus.UNPAID: return <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded border border-red-200">FALTA ABONAR</span>;
          default: return null;
      }
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
       <div className="bg-orange-600 p-6 rounded-xl shadow-lg mb-6 text-white">
         <h2 className="text-2xl font-bold mb-4">Entrega de Pedidos</h2>
         
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {/* Search Input */}
           <div className="md:col-span-2 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text"
                className="w-full pl-12 p-3 rounded-lg text-slate-900 font-lg outline-none ring-2 ring-transparent focus:ring-orange-300 transition-all"
                placeholder="Buscar por Dirección, Nombre, Tel o N°..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>

           {/* Branch Filter */}
           <div className="relative">
             <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
             <select
                className="w-full pl-12 p-3 rounded-lg text-slate-900 outline-none ring-2 ring-transparent focus:ring-orange-300 transition-all appearance-none"
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
             >
               <option value="">Todas las Sucursales</option>
               {PICKUP_BRANCHES.map(b => (
                 <option key={b.value} value={b.value}>{b.label}</option>
               ))}
             </select>
           </div>
         </div>
       </div>

       <div className="space-y-4">
          {/* Empty State (No Search & No Filter) */}
          {searchTerm === '' && filterBranch === '' && (
             <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
               <Search size={48} className="mx-auto mb-4 opacity-20" />
               <p>Utilice los filtros o el buscador para encontrar un pedido.</p>
             </div>
          )}

          {/* No Results State */}
          {(searchTerm !== '' || filterBranch !== '') && filteredOrders.length === 0 && (
             <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
               <p>No se encontraron pedidos con ese criterio.</p>
             </div>
          )}

          {/* List */}
          {filteredOrders.map(order => {
            const statusStyle = getStatusHeader(order);
            const isDelivered = order.status === OrderStatus.DELIVERED;
            
            // Factory Colors
            const isCentral = order.originBranch === 'Central';
            const factoryBadgeColor = isCentral 
                ? 'bg-sky-50 text-sky-700 border-sky-100' 
                : 'bg-purple-50 text-purple-700 border-purple-100';

            return (
            <div key={order.id} className={`bg-white rounded-xl shadow-md overflow-hidden border ${isDelivered ? 'border-teal-200 bg-teal-50' : 'border-slate-200'} animate-fade-in`}>
               <div className={`p-2 text-center text-white font-bold text-sm tracking-wider ${statusStyle.color}`}>
                  {statusStyle.text}
               </div>
               
               <div className="p-6">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                         <h3 className="text-2xl font-bold text-slate-900">{order.customerName}</h3>
                         {order.pickupTime && (
                             <span className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">
                                 <Clock size={12} /> {order.pickupTime}
                             </span>
                         )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                          <p className="text-slate-500 font-mono">Comanda #{order.id}</p>
                          {/* Factory Badge */}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${factoryBadgeColor}`}>
                                <Factory size={12} /> {order.originBranch}
                          </span>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-2xl font-black text-orange-600">
                         {order.qtyTriples + order.qtySimples} u.
                       </p>
                       <p className="text-xs text-slate-400">Total Sándwiches</p>
                    </div>
                 </div>

                 <div className="bg-slate-50 p-4 rounded mb-6">
                    {/* Basic Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-600 mb-3">
                        <div>
                           <span className="font-bold block text-xs uppercase text-slate-400">Detalle</span>
                           <div className="flex gap-4">
                             {order.qtyTriples > 0 && <span className="font-semibold text-slate-700">{order.qtyTriples} Triples</span>}
                             {order.qtySimples > 0 && <span className="font-semibold text-slate-700">{order.qtySimples} Simples</span>}
                           </div>
                        </div>
                        <div>
                           <span className="font-bold block text-xs uppercase text-slate-400">Retira en</span>
                           <span className="font-bold text-indigo-600">{order.pickupBranch}</span>
                        </div>
                    </div>

                    {/* Logistics Info (Address, Phone, Packages) */}
                    <div className="border-t border-slate-200 pt-3 mt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-start gap-2">
                            <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                            <span className="font-medium text-slate-700 break-words text-sm">{order.address || 'Sin Dirección'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Phone size={16} className="text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-700 text-sm">{order.phone || 'Sin Teléfono'}</span>
                        </div>
                        <div className="sm:col-span-2 flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                 {getPaymentBadge(order.paymentStatus || PaymentStatus.UNPAID)}
                                 {order.deposit > 0 && (
                                     <span className="text-green-700 font-semibold text-xs">
                                         (Seña: ${order.deposit})
                                     </span>
                                 )}
                             </div>
                             
                             <div className="flex items-center gap-2 bg-white border border-slate-200 px-2 py-1 rounded">
                                <Package size={16} className="text-orange-500" />
                                <span className="font-bold text-slate-800 text-sm">{order.packageCount || 0} Bultos</span>
                             </div>
                        </div>
                    </div>

                    {order.notes && (
                       <div className="italic text-slate-500 border-t border-slate-200 pt-2 mt-3 text-sm">
                         "{order.notes}"
                       </div>
                    )}
                 </div>

                 <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={() => handlePrint(order)}
                      className="flex-1 bg-slate-100 text-slate-800 py-3 rounded-lg font-bold hover:bg-slate-200 flex justify-center items-center gap-2 transition-colors"
                    >
                       <Printer size={20} />
                       {isDelivered ? 'Re-Imprimir' : 'Imprimir Ticket'}
                    </button>
                    
                    {isDelivered ? (
                         <button 
                           disabled
                           className="flex-1 bg-teal-600 text-white py-3 rounded-lg font-black flex justify-center items-center gap-2 cursor-default shadow-md border-2 border-teal-700"
                         >
                           <PackageCheck size={24} />
                           ENTREGADO
                         </button>
                    ) : order.location ? (
                        <button 
                          onClick={() => handleDeliverClick(order.id)}
                          disabled={processingId === order.id}
                          className={`flex-1 py-3 rounded-lg font-bold flex justify-center items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-75 ${
                            confirmId === order.id 
                              ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                              : 'bg-green-600 hover:bg-green-700 text-white shadow-green-200'
                          }`}
                        >
                          {processingId === order.id ? (
                            <Loader2 className="animate-spin" />
                          ) : confirmId === order.id ? (
                            <AlertTriangle size={20} />
                          ) : (
                            <CheckCircle size={20} />
                          )}
                          {confirmId === order.id ? '¿CONFIRMAR?' : 'Entregar Pedido'}
                        </button>
                    ) : (
                        <button 
                          disabled
                          className="flex-1 bg-slate-200 text-slate-400 py-3 rounded-lg font-bold flex justify-center items-center gap-2 cursor-not-allowed"
                        >
                          <AlertCircle size={20} />
                          No Ubicado
                        </button>
                    )}
                 </div>
               </div>
            </div>
            );
          })}
       </div>
    </div>
  );
};