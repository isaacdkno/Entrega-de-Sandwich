
import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, PaymentStatus, ProductionBranch } from '../types';
import { markOrderDelivered } from '../services/storageService';
import { generateTicketPDF } from '../services/pdfService';
import { PICKUP_BRANCHES, PRODUCTION_BRANCHES, PICKUP_DATES } from '../constants';
import { Search, Printer, Filter, Loader2, PackageCheck, MapPin, Package, Factory, RefreshCw, Calendar, Truck } from 'lucide-react';

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
    let result = orders.filter(o => o.pickupDate === selectedDate);

    if (filterBranch) {
      result = result.filter(o => o.pickupBranch === filterBranch);
    }
    
    if (filterFactory !== 'ALL') {
      result = result.filter(o => o.originBranch === filterFactory);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(o => 
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.phone.includes(q) ||
        o.address.toLowerCase().includes(q)
      );
    }

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
    <div className="max-w-4xl mx-auto p-4 pb-24">
       {/* Header de Filtros */}
       <div className="bg-orange-600 p-6 rounded-2xl shadow-lg mb-4 text-white border-b-4 border-orange-700">
         <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-black flex items-center gap-2 tracking-tighter uppercase">
                <PackageCheck size={28} /> Entregas
            </h2>
            <button 
                onClick={handleManualRefresh} 
                className={`p-2.5 bg-white/20 rounded-full hover:bg-white/30 transition-all active:scale-90 ${isRefreshing ? 'animate-spin' : ''}`}
            >
                <RefreshCw size={24} />
            </button>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
           <div className="lg:col-span-2 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text"
                className="w-full pl-12 p-3 rounded-xl text-slate-900 outline-none shadow-inner font-bold text-sm"
                placeholder="Buscar comanda..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           
           <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
              <select 
                className="w-full pl-9 p-3 rounded-xl text-slate-900 outline-none font-bold text-sm appearance-none bg-white cursor-pointer"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              >
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
           </div>

           <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
              <select
                className="w-full pl-9 p-3 rounded-xl text-slate-900 outline-none font-bold text-sm appearance-none bg-white cursor-pointer"
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
          {filteredOrders.length === 0 && (
             <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400 flex flex-col items-center gap-2">
               <PackageCheck size={40} className="opacity-10" />
               <p className="font-bold text-slate-500 uppercase text-xs tracking-widest">Sin resultados</p>
             </div>
          )}

          {filteredOrders.map(order => {
            const statusStyle = getStatusHeader(order);
            const isDelivered = order.status === OrderStatus.DELIVERED;
            const isCentral = order.originBranch === ProductionBranch.CENTRAL;
            
            return (
            <div key={order.id} className={`bg-white rounded-2xl shadow-md overflow-hidden border transition-all ${isDelivered ? 'border-teal-100 opacity-60' : 'border-slate-200'}`}>
               <div className={`p-2 text-center text-white font-black text-[10px] tracking-[0.2em] uppercase ${statusStyle.color}`}>
                  {statusStyle.text}
               </div>
               
               <div className="p-5">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tighter">{order.customerName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-mono font-black text-slate-400">#{order.id}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black border uppercase flex items-center gap-1 ${isCentral ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                                <Factory size={10} /> {order.originBranch}
                          </span>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-2xl font-black text-orange-600 leading-none">{order.qtyTriples + order.qtySimples}</p>
                       <p className="text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">Unidades</p>
                       <span className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded-lg font-black shadow-sm uppercase">{order.pickupTime}</span>
                    </div>
                 </div>

                 <div className="bg-slate-50 p-3 rounded-xl mb-4 text-xs border border-slate-100">
                    <div className="flex justify-between mb-2">
                        <span className="text-slate-500 font-bold">RETIRO: <b className="text-slate-900">{order.pickupBranch}</b></span>
                        <div className="flex gap-3">
                             <span className="font-black text-blue-600">{order.qtyTriples}T</span>
                             <span className="font-black text-orange-600">{order.qtySimples}S</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 mb-1">
                        <MapPin size={12} className="flex-shrink-0" /> <span className="truncate italic">{order.address || 'Sin dirección'}</span>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${order.paymentStatus === PaymentStatus.PAID ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-100'}`}>{order.paymentStatus}</span>
                        <div className="flex items-center gap-1 font-black text-slate-700">
                            <Package size={12} className="text-slate-400" /> {order.packageCount} bultos
                        </div>
                    </div>
                 </div>

                 <div className="flex gap-3">
                    <button 
                        onClick={() => handlePrint(order)} 
                        className="px-5 py-4 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all border border-slate-200 flex items-center justify-center shadow-sm" 
                    >
                        <Printer size={28} />
                    </button>
                    {isDelivered ? (
                         <button disabled className="flex-1 bg-teal-600 text-white rounded-xl font-black flex justify-center items-center gap-2 uppercase tracking-widest text-sm">DESPACHADO</button>
                    ) : order.location ? (
                        <button 
                            onClick={() => executeDeliver(order.id)} 
                            disabled={processingId === order.id}
                            className={`flex-1 py-4 rounded-xl font-black text-white transition-all shadow-md active:scale-[0.98] bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2 uppercase tracking-widest text-sm`}
                        >
                          {processingId === order.id ? <Loader2 className="animate-spin" size={24} /> : <><PackageCheck size={24} /> ENTREGAR</>}
                        </button>
                    ) : (
                        <button disabled className="flex-1 bg-slate-100 text-slate-300 py-4 rounded-xl font-black border border-slate-200 cursor-not-allowed uppercase text-[10px] tracking-widest">Pendiente Prod.</button>
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
