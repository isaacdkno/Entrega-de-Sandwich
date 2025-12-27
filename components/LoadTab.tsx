
import React, { useState, useEffect, useMemo } from 'react';
import { UserSession, Order, PickupBranch, OrderStatus, ProductionBranch, UserRole, PaymentStatus } from '../types';
import { PICKUP_DATES, PICKUP_BRANCHES, PRODUCTION_BRANCHES, PAYMENT_STATUS_OPTIONS } from '../constants';
import { saveOrder, searchOrders, deleteOrder } from '../services/storageService';
import { Save, Settings, Loader2, Search, XCircle, Edit3, ChevronDown, ChevronUp, AlertCircle, PlusCircle, Trash2, Calendar, Clock, MapPin, Package, DollarSign, StickyNote, Phone, Hash, ClipboardList } from 'lucide-react';

interface LoadTabProps {
  session: UserSession;
  onSessionUpdate: (session: UserSession) => void;
  refreshData: () => void;
  orders: Order[];
}

export const LoadTab: React.FC<LoadTabProps> = ({ session, onSessionUpdate, refreshData, orders }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Order[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [originalId, setOriginalId] = useState<string | null>(null);
  const [depositInput, setDepositInput] = useState('0');

  const [formData, setFormData] = useState<Partial<Order>>({
    pickupDate: '31/12/2025',
    pickupTime: '',
    qtyTriples: 0,
    qtySimples: 0,
    deposit: 0,
    paymentStatus: PaymentStatus.UNPAID,
    pickupBranch: PickupBranch.CENTRAL,
  });
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // --- Estadísticas de Carga ---
  const stats = useMemo(() => {
    const factoryOrders = orders.filter(o => 
      o.originBranch === session.currentProductionBranch && 
      o.pickupDate === formData.pickupDate
    );
    
    const totals = factoryOrders.reduce((acc, o) => {
      acc.count++;
      acc.triples += o.qtyTriples;
      acc.simples += o.qtySimples;
      
      const branchLabel = PICKUP_BRANCHES.find(pb => pb.value === o.pickupBranch)?.label || o.pickupBranch;
      if (!acc.byBranch[branchLabel]) {
        acc.byBranch[branchLabel] = { count: 0, t: 0, s: 0 };
      }
      acc.byBranch[branchLabel].count++;
      acc.byBranch[branchLabel].t += o.qtyTriples;
      acc.byBranch[branchLabel].s += o.qtySimples;
      
      return acc;
    }, { 
      count: 0, 
      triples: 0, 
      simples: 0, 
      byBranch: {} as Record<string, { count: number; t: number; s: number }> 
    });
    
    return totals;
  }, [orders, session.currentProductionBranch, formData.pickupDate]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSettingsChange = (branch: ProductionBranch) => {
    onSessionUpdate({ ...session, currentProductionBranch: branch });
    setIsSettingsOpen(false);
  };

  const handleSearchForEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId) return;
    setIsSearching(true);
    try {
      const results = await searchOrders(searchId);
      if (results.length === 0) setMessage({ type: 'error', text: 'No se encontraron pedidos.' });
      else setSearchResults(results);
    } catch {
      setMessage({ type: 'error', text: 'Error de red.' });
    } finally {
      setIsSearching(false);
    }
  };

  const loadOrderForEdit = (order: Order) => {
    setFormData(order);
    setDepositInput(order.deposit.toString());
    setOriginalId(order.id);
    setIsEditing(true);
    setSearchResults([]);
    setShowSearchPanel(false);
    setMessage({ type: 'success', text: `Editando #${order.id}` });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setOriginalId(null);
    setFormData({
        pickupDate: '31/12/2025', pickupTime: '', qtyTriples: 0, qtySimples: 0, deposit: 0,
        paymentStatus: PaymentStatus.UNPAID, pickupBranch: PickupBranch.CENTRAL, id: '', customerName: '',
        address: '', phone: '', notes: ''
    });
    setDepositInput('0');
    setMessage(null);
  };

  const handleDeleteOrder = async () => {
    if (!originalId) return;
    if (!confirm(`¿Borrar permanentemente comanda #${originalId}?`)) return;
    setIsSaving(true);
    try {
      await deleteOrder(originalId);
      refreshData();
      handleCancelEdit();
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Error: ' + e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.customerName || !formData.pickupTime) {
      setMessage({ type: 'error', text: 'Campos incompletos.' });
      return;
    }
    setIsSaving(true);
    try {
      const newOrder: Order = {
        ...formData,
        id: formData.id!,
        qtyTriples: Number(formData.qtyTriples),
        qtySimples: Number(formData.qtySimples),
        deposit: parseFloat(depositInput) || 0,
        originBranch: session.currentProductionBranch,
        status: formData.status || OrderStatus.PENDING_PRODUCTION,
        createdBy: session.email,
      } as Order;

      await saveOrder(newOrder, isEditing, originalId || undefined);
      setMessage({ type: 'success', text: `Guardado #${newOrder.id}` });
      refreshData();
      if (isEditing) handleCancelEdit();
      else {
        setFormData(prev => ({ ...prev, id: '', customerName: '', pickupTime: '', qtyTriples: 0, qtySimples: 0, deposit: 0 }));
        setDepositInput('0');
        document.getElementById('comanda-id')?.focus();
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto p-2">
      {/* Barra de Herramientas Superior */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
          <Settings size={16} className="text-orange-600" />
          Fábrica Origen: <span className="text-orange-600 ml-1">{session.currentProductionBranch}</span>
          <ChevronDown size={14} />
        </button>
        <button onClick={() => setShowSearchPanel(!showSearchPanel)} className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all uppercase tracking-widest ${showSearchPanel ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 shadow-sm'}`}>
          <Search size={16} />
          {showSearchPanel ? 'Cerrar Buscador' : 'Buscar / Editar comanda'}
        </button>
      </div>

      {isSettingsOpen && (
        <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 animate-fade-in flex gap-3 shadow-inner">
          {PRODUCTION_BRANCHES.map(b => (
            <button key={b.value} onClick={() => handleSettingsChange(b.value)} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${session.currentProductionBranch === b.value ? 'bg-orange-600 text-white shadow-md' : 'bg-white border hover:bg-slate-100 text-slate-600'}`}>
              {b.label}
            </button>
          ))}
        </div>
      )}

      {showSearchPanel && (
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 shadow-inner animate-fade-in">
          <form onSubmit={handleSearchForEdit} className="flex gap-3 mb-4">
            <input type="text" placeholder="Número de comanda, Nombre del cliente o Teléfono..." className="flex-1 p-3 rounded-xl border border-blue-200 text-sm focus:ring-2 focus:ring-blue-400 outline-none font-bold shadow-sm" value={searchId} onChange={e => setSearchId(e.target.value)} />
            <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg font-black text-xs flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95">
              <Search size={18} /> BUSCAR
            </button>
          </form>
          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {searchResults.map(r => (
                <div key={r.id} className="bg-white rounded-xl p-3 border border-blue-100 shadow-sm flex justify-between items-center group hover:border-blue-300 transition-all">
                  <div className="truncate">
                    <span className="font-black text-slate-900 text-lg mr-2 tracking-tighter">#{r.id}</span>
                    <span className="text-[10px] font-black text-slate-500 uppercase block truncate">{r.customerName}</span>
                  </div>
                  <button onClick={() => loadOrderForEdit(r)} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 shadow-md transition-all active:scale-90">
                     <Edit3 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Monitor de Carga (Stats) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
         <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-lg border-b-4 border-orange-600 flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-2xl"><ClipboardList className="text-orange-500" /></div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50">Comandas Hoy</p>
              <p className="text-2xl font-black">{stats.count}</p>
            </div>
         </div>
         <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-2xl text-blue-600 font-black text-xl">T</div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Triples</p>
              <p className="text-2xl font-black text-slate-800">{stats.triples}</p>
            </div>
         </div>
         <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="bg-orange-100 p-3 rounded-2xl text-orange-600 font-black text-xl">S</div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Simples</p>
              <p className="text-2xl font-black text-slate-800">{stats.simples}</p>
            </div>
         </div>
         {/* Desglose por Sucursal */}
         <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Carga por Destino</p>
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
               {PICKUP_BRANCHES.map(branch => {
                  const branchStat = stats.byBranch[branch.label] || { count: 0 };
                  return (
                    <div key={branch.value} className="flex-shrink-0 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                       <p className="text-[7px] font-black text-slate-500 uppercase truncate">{branch.label}</p>
                       <p className="text-xs font-black text-slate-800">{branchStat.count}</p>
                    </div>
                  );
               })}
            </div>
         </div>
      </div>

      {/* Formulario Principal */}
      <div className={`bg-white rounded-[2rem] p-6 shadow-sm border transition-all ${isEditing ? 'ring-4 ring-blue-50 border-blue-200' : 'border-slate-100'}`}>
        <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-4">
            <h2 className="text-xl font-black text-slate-800 tracking-tighter flex items-center gap-3 uppercase">
                <div className={`p-2 rounded-xl ${isEditing ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                  {isEditing ? <Edit3 size={24} /> : <PlusCircle size={24} />}
                </div>
                {isEditing ? `EDITANDO COMANDA #${originalId}` : 'NUEVA CARGA DE PEDIDO'}
            </h2>
            {isEditing && (
              <div className="flex gap-2">
                <button onClick={handleDeleteOrder} className="bg-red-50 px-4 py-2 rounded-xl text-xs font-black text-red-600 uppercase border border-red-100 hover:bg-red-100 flex items-center gap-2 transition-all"><Trash2 size={16} /> Eliminar</button>
                <button onClick={handleCancelEdit} className="bg-slate-100 px-4 py-2 rounded-xl text-xs font-black text-slate-500 uppercase hover:bg-slate-200 flex items-center gap-2 transition-all"><XCircle size={16} /> Cancelar</button>
              </div>
            )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Fila 1: Datos de Comanda, Fecha y Hora */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">1. Número de Comanda</label>
              <input id="comanda-id" type="text" required placeholder="Ej: 0542" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-orange-500 outline-none font-mono font-black text-xl shadow-sm transition-all" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isSaving} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">2. Fecha de Retiro</label>
              <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-base focus:bg-white focus:border-orange-500 outline-none cursor-pointer shadow-sm" value={formData.pickupDate} onChange={e => setFormData({...formData, pickupDate: e.target.value as any})} disabled={isSaving}>
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">3. Hora de Retiro</label>
              <div className="relative">
                <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                <input type="time" required className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-base focus:bg-white focus:border-orange-500 outline-none shadow-sm" value={formData.pickupTime || ''} onChange={e => setFormData({...formData, pickupTime: e.target.value})} disabled={isSaving} />
              </div>
            </div>
          </div>

          {/* Fila 2: Nombre, Dirección y Teléfono */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2 md:col-span-1">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">4. Nombre Completo</label>
              <input type="text" required placeholder="JUAN PÉREZ" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black uppercase text-base focus:bg-white focus:border-orange-500 outline-none shadow-sm" value={formData.customerName || ''} onChange={e => setFormData({...formData, customerName: e.target.value.toUpperCase()})} disabled={isSaving} />
            </div>
            <div className="space-y-2 md:col-span-1">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">5. Dirección / Reparto</label>
              <input type="text" placeholder="Calle, Barrio, Manzana..." className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-base focus:bg-white focus:border-orange-500 outline-none shadow-sm" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} disabled={isSaving} />
            </div>
            <div className="space-y-2 md:col-span-1">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">6. Teléfono de Contacto</label>
              <div className="relative">
                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                <input type="tel" placeholder="3816543210" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-base focus:bg-white focus:border-orange-500 outline-none shadow-sm" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} disabled={isSaving} />
              </div>
            </div>
          </div>

          {/* Fila 3: Sucursal y Cantidades */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">7. Sucursal de Retiro</label>
              <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-base focus:bg-white focus:border-orange-500 outline-none cursor-pointer shadow-sm" value={formData.pickupBranch} onChange={e => setFormData({...formData, pickupBranch: e.target.value as any})} disabled={isSaving}>
                {PICKUP_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
                <label className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] ml-1">8a. Unidades Triples</label>
                <input type="number" min="0" className="w-full p-3.5 bg-blue-50/50 border border-blue-100 rounded-2xl font-black text-2xl text-center text-blue-800 outline-none focus:bg-white focus:border-blue-500 shadow-sm" value={formData.qtyTriples || ''} onChange={e => setFormData({...formData, qtyTriples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} disabled={isSaving} />
            </div>
            <div className="space-y-2">
                <label className="text-[11px] font-black text-orange-600 uppercase tracking-[0.2em] ml-1">8b. Unidades Simples</label>
                <input type="number" min="0" className="w-full p-3.5 bg-orange-50/50 border border-orange-100 rounded-2xl font-black text-2xl text-center text-orange-800 outline-none focus:bg-white focus:border-orange-500 shadow-sm" value={formData.qtySimples || ''} onChange={e => setFormData({...formData, qtySimples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} disabled={isSaving} />
            </div>
          </div>

          {/* Fila 4: Pago, Seña y Notas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">9. Estado de Pago</label>
                <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-base focus:bg-white focus:border-orange-500 outline-none cursor-pointer shadow-sm" value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value as PaymentStatus})} disabled={isSaving}>
                  {PAYMENT_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
            <div className="space-y-2">
                <label className="text-[11px] font-black text-green-700 uppercase tracking-[0.2em] ml-1">10. Monto de Seña ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600" size={20} />
                  <input type="number" min="0" className="w-full pl-10 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-green-700 outline-none focus:bg-white focus:border-orange-500 shadow-sm" value={depositInput === '0' ? '' : depositInput} onChange={e => { setDepositInput(e.target.value); setFormData({...formData, deposit: parseFloat(e.target.value) || 0}); }} disabled={isSaving} />
                </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">11. Observaciones / Notas Internas</label>
              <textarea className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:bg-white focus:border-orange-500 outline-none resize-none shadow-sm" rows={1} placeholder="Ej: Sin mayonesa, Cliente habitual..." value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} disabled={isSaving} />
            </div>
          </div>

          {/* Botón Guardar - Centrado y Destacado */}
          <div className="pt-2 flex flex-col items-center gap-4">
             <button type="submit" disabled={isSaving} className={`w-full max-w-md py-4 rounded-2xl font-black text-base tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 ${isEditing ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200' : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200'}`}>
                {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                {isSaving ? 'PROCESANDO...' : (isEditing ? 'GUARDAR CAMBIOS' : 'GUARDAR COMANDA')}
             </button>

             {message && (
               <div className={`px-8 py-3 rounded-2xl text-center font-black text-xs uppercase tracking-widest border-2 animate-fade-in flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                 <AlertCircle size={20} />
                 {message.text}
               </div>
             )}
          </div>
        </form>
      </div>
    </div>
  );
};
