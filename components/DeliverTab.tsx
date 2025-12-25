
import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, PaymentStatus, ProductionBranch } from '../types';
import { markOrderDelivered } from '../services/storageService';
import { generateTicketPDF } from '../services/pdfService';
import { PICKUP_BRANCHES, PRODUCTION_BRANCHES, PICKUP_DATES } from '../constants';
import { Search, Printer, Filter, Loader2, PackageCheck, MapPin, Package, Factory, RefreshCw, Calendar, Truck, Phone } from 'lucide-react';

interface DeliverTabProps {
  orders: Order[];
  refreshData: () => void;
}

export const DeliverTab: React.FC<DeliverTabProps> = ({ orders, refreshData }) => {
  const [selectedDate, setSelectedDate] = useState(PICKUP_DATES[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterFactory, setFilterFactory] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const filteredOrders = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    
    // REQUERIMIENTO: Si no hay término de búsqueda, no mostrar nada
    if (!q) return [];

    let result = orders.filter(o => o.pickupDate === selectedDate);

    if (filterBranch) {
      result = result.filter(o => o.pickupBranch === filterBranch);
    }
    
    if (filterFactory !== 'ALL') {
      result = result.filter(o => o.originBranch === filterFactory);
    }

    result = result.filter(o => 
      o.id.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      (o.phone && o.phone.includes(q)) ||
      o.address.toLowerCase().includes(q)
    );

    return result.sort((a, b) => {
        if (a.status === OrderStatus.DELIVERED && b.status !== OrderStatus.DELIVERED) return 1;
        if (a.status !== OrderStatus.DELIVERED && b.status === OrderStatus.DELIVERED) return -1;
        return (a.pickupTime || '').localeCompare(b.pickupTime || '');
    });
  }, [orders, searchTerm, filterBranch, filterFactory, selectedDate]);

  const handlePrint = (order: Order) => {
    generateTicketPDF(order);
  };

  const executeDeliver = async (id: string) => {
    setProcessingId(id);
    try {
      await markOrderDelivered(id);
      refreshData();
    } catch (e) {
      alert("Error al marcar la entrega. Verifique su internet.");
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusHeader = (order: Order) => {
      if (order.status === OrderStatus.DELIVERED) return { color: 'bg-teal-700', text: 'ENTREGADO' };
      if (order.location) return { color: 'bg-green-600', text: `UBICACIÓN: ${order.location}` };
      return { color: 'bg-red-500', text: 'SIN UBICACIÓN' };
  };

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-4 pb-24">
       {/* Header de Filtros */}
       <div className="bg-orange-600 p-4 sm:p-6 rounded-2xl shadow-lg mb-4 text-white border-b-4 border-orange-700">
         <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tighter uppercase">
                <PackageCheck size={24} className="sm:w-7 sm:h-7" /> Entregas
            </h2>
            <button 
                onClick={handleManualRefresh} 
                className={`p-2 bg-white/20 rounded-full hover:bg-white/30 transition-all active:scale-90 ${isRefreshing ? 'animate-spin' : ''}`}
            >
                <RefreshCw size={20} className="sm:w-6 sm:h-6" />
            </button>
         </div>
         
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
           <div className="sm:col-span-2 relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                className="w-full pl-11 p-3 rounded-xl text-slate-900 outline-none shadow-inner font-bold text-sm"
                placeholder="Buscar comanda o cliente..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           
           <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none z-10" size={16} />
              <select 
                className="w-full pl-12 p-3 rounded-xl text-slate-900 outline-none font-bold text-sm appearance-none bg-white cursor-pointer shadow-sm"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              >
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
           </div>

           <div className="relative">
              <Filter className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none z-10" size={16} />
              <select
                className="w-full pl-12 p-3 rounded-xl text-slate-900 outline-none font-bold text-sm appearance-none bg-white cursor-pointer shadow-sm"
                value={filterFactory}
                onChange={e => setFilterFactory(e.target.value)}
              >
                <option value="ALL">Fábrica: Todas</option>
                {PRODUCTION_BRANCHES.map(b => <option key={b.value} value={b.label}>{b.label}</option>)}
              </select>
           </div>
         </div>
       </div>

       <div className="space-y-4">
          {!searchTerm.trim() ? (
             <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 flex flex-col items-center gap-2">
               <Search size={32} className="opacity-10" />
               <p className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">Ingrese número de comanda para listar</p>
             </div>
          ) : filteredOrders.length === 0 ? (
             <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 flex flex-col items-center gap-2">
               <PackageCheck size={32} className="opacity-10" />
               <p className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">Sin resultados para esta búsqueda</p>
             </div>
          ) : (
            filteredOrders.map(order => {
              const statusStyle = getStatusHeader(order);
              const isDelivered = order.status === OrderStatus.DELIVERED;
              const isCentral = order.originBranch === ProductionBranch.CENTRAL;
              
              return (
              <div key={order.id} className={`bg-white rounded-2xl shadow-md overflow-hidden border transition-all ${isDelivered ? 'border-teal-100 opacity-60' : 'border-slate-200'}`}>
                 <div className={`p-1.5 sm:p-2 text-center text-white font-black text-[9px] sm:text-[10px] tracking-[0.2em] uppercase ${statusStyle.color}`}>
                    {statusStyle.text}
                 </div>
                 
                 <div className="p-4 sm:p-5">
                   <div className="flex justify-between items-start mb-3 sm:mb-4">
                      <div className="max-w-[70%]">
                        <h3 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight uppercase tracking-tighter truncate">{order.customerName}</h3>
                        <div className="flex items-center gap-2 mt-1 sm:mt-2">
                            <span className="text-2xl sm:text-4xl font-mono font-black text-slate-900 tracking-tighter">#{order.id}</span>
                            <span className={`text-[8px] sm:text-[9px] px-1.5 sm:px-2 py-0.5 rounded-full font-black border uppercase flex items-center gap-1 ${isCentral ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                                  <Factory size={8} className="sm:w-2.5 sm:h-2.5" /> {order.originBranch.replace('Fabrica ', '')}
                            </span>
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-2xl sm:text-3xl font-black text-orange-600 leading-none">{order.qtyTriples + order.qtySimples}</p>
                         <p className="text-[8px] sm:text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">Unidades</p>
                         <span className="text-xs sm:text-sm bg-blue-600 text-white px-2 sm:px-3 py-1 rounded-lg font-black shadow-sm uppercase">{order.pickupTime}</span>
                      </div>
                   </div>

                   <div className="bg-slate-50 p-3 sm:p-4 rounded-xl mb-3 sm:mb-4 space-y-2 sm:space-y-3 border border-slate-100">
                      <div className="flex justify-between border-b border-slate-200 pb-2">
                          <span className="text-slate-500 font-bold text-[10px] sm:text-xs uppercase tracking-wider">RETIRO: <b className="text-slate-900">{order.pickupBranch}</b></span>
                          <div className="flex gap-2 sm:gap-4">
                               <span className="font-black text-blue-600 text-sm sm:text-lg">{order.qtyTriples}T</span>
                               <span className="font-black text-orange-600 text-sm sm:text-lg">{order.qtySimples}S</span>
                          </div>
                      </div>
                      
                      <div className="space-y-1.5 sm:space-y-2">
                          <div className="flex items-start gap-2 sm:gap-3 text-slate-800">
                              <MapPin size={16} className="mt-1 flex-shrink-0 text-orange-600 sm:w-5 sm:h-5" /> 
                              <span className="font-black text-sm sm:text-xl leading-tight uppercase line-clamp-2">{order.address || 'SIN DIRECCIÓN'}</span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 text-slate-900">
                              <Phone size={16} className="flex-shrink-0 text-green-600 sm:w-5 sm:h-5" /> 
                              <span className="font-black text-lg sm:text-2xl tracking-tighter">{order.phone || 'SIN TELÉFONO'}</span>
                          </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 sm:pt-3 border-t border-slate-200">
                          <span className={`text-[9px] sm:text-[11px] font-black px-2 sm:px-3 py-0.5 sm:py-1 rounded-full uppercase border ${order.paymentStatus === PaymentStatus.PAID ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-100'}`}>{order.paymentStatus}</span>
                          <div className="flex items-center gap-1 font-black text-xs sm:text-sm text-slate-700">
                              <Package size={12} className="text-slate-400 sm:w-3.5 sm:h-3.5" /> {order.packageCount} bultos
                          </div>
                      </div>
                   </div>

                   <div className="flex gap-2 sm:gap-3">
                      <button 
                          onClick={() => handlePrint(order)} 
                          className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all border border-slate-200 flex items-center justify-center shadow-sm" 
                      >
                          <Printer size={24} className="sm:w-8 sm:h-8" />
                      </button>
                      {isDelivered ? (
                           <button disabled className="flex-1 bg-teal-600 text-white rounded-xl font-black flex justify-center items-center gap-2 uppercase tracking-widest text-[10px] sm:text-sm">ENTREGADO OK</button>
                      ) : order.location ? (
                          <button 
                              onClick={() => executeDeliver(order.id)} 
                              disabled={processingId === order.id}
                              className="flex-1 py-3 sm:py-4 rounded-xl font-black text-white transition-all shadow-md active:scale-[0.98] bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2 uppercase tracking-widest text-xs sm:text-base"
                          >
                            {processingId === order.id ? <Loader2 className="animate-spin" size={20} /> : <><PackageCheck size={20} className="sm:w-7 sm:h-7" /> ENTREGAR</>}
                          </button>
                      ) : (
                          <button disabled className="flex-1 bg-slate-100 text-slate-300 py-3 sm:py-4 rounded-xl font-black border border-slate-200 cursor-not-allowed uppercase text-[8px] sm:text-[10px] tracking-widest leading-tight">Esperando ubicación...</button>
                      )}
                   </div>
                 </div>
              </div>
              );
            })
          )}
       </div>
    </div>
  );
};
