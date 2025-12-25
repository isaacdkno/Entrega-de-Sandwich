
import React, { useState, useEffect } from 'react';
import { UserSession, Order, PickupBranch, OrderStatus, ProductionBranch, UserRole, PaymentStatus } from '../types';
import { PICKUP_DATES, PICKUP_BRANCHES, PRODUCTION_BRANCHES, PAYMENT_STATUS_OPTIONS } from '../constants';
import { saveOrder, searchOrders, deleteOrder } from '../services/storageService';
import { Save, Settings, Loader2, Search, XCircle, Edit3, ChevronDown, ChevronUp, AlertCircle, PlusCircle, Trash2, Calendar, Clock, MapPin, Package, DollarSign, StickyNote, Phone } from 'lucide-react';

interface LoadTabProps {
  session: UserSession;
  onSessionUpdate: (session: UserSession) => void;
  refreshData: () => void;
}

export const LoadTab: React.FC<LoadTabProps> = ({ session, onSessionUpdate, refreshData }) => {
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
    setMessage(null);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const confirmed = confirm(`¿ESTÁS SEGURO? Se eliminará permanentemente la comanda #${originalId}.`);
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await deleteOrder(originalId);
      setMessage({ type: 'success', text: `Comanda #${originalId} eliminada.` });
      refreshData();
      handleCancelEdit();
    } catch (e: any) {
      setMessage({ type: 'error', text: 'No se pudo eliminar: ' + e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleWheelDisable = (e: React.WheelEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).blur();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.customerName || !formData.pickupTime) {
      setMessage({ type: 'error', text: 'Datos obligatorios incompletos.' });
      return;
    }
    setIsSaving(true);
    try {
      const newOrder: Order = {
        ...formData,
        id: formData.id!,
        pickupDate: formData.pickupDate as any,
        pickupTime: formData.pickupTime!,
        customerName: formData.customerName!,
        qtyTriples: Number(formData.qtyTriples),
        qtySimples: Number(formData.qtySimples),
        deposit: parseFloat(depositInput) || 0,
        originBranch: session.currentProductionBranch,
        status: formData.status || OrderStatus.PENDING_PRODUCTION,
        createdBy: session.email,
      } as Order;

      await saveOrder(newOrder, isEditing, originalId || undefined);
      setMessage({ type: 'success', text: `¡Guardado! #${newOrder.id}` });
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
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* Settings & Search Toggle - Compacted */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
          className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Settings size={14} className="text-orange-600" />
          Fábrica: {session.currentProductionBranch}
          <ChevronDown size={12} />
        </button>
        <button 
          onClick={() => { setShowSearchPanel(!showSearchPanel); setSearchResults([]); }}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${showSearchPanel ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
        >
          {showSearchPanel ? <ChevronUp size={14} /> : <Search size={14} />}
          {showSearchPanel ? 'Cerrar' : 'Buscar / Editar'}
        </button>
      </div>

      {isSettingsOpen && (
        <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 animate-fade-in flex flex-wrap gap-2">
          {PRODUCTION_BRANCHES.map(b => (
            <button key={b.value} onClick={() => handleSettingsChange(b.value)} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${session.currentProductionBranch === b.value ? 'bg-orange-600 text-white' : 'bg-white border hover:bg-slate-50'}`}>
              {b.label}
            </button>
          ))}
        </div>
      )}

      {showSearchPanel && (
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 shadow-inner animate-fade-in">
          <form onSubmit={handleSearchForEdit} className="flex gap-2 mb-4">
            <input type="text" placeholder="Comanda, Nombre o Tel..." className="flex-1 p-2.5 rounded-xl border border-blue-200 text-sm focus:ring-2 focus:ring-blue-400 outline-none font-bold" value={searchId} onChange={e => setSearchId(e.target.value)} />
            <button type="submit" disabled={isSearching} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow-md font-bold text-sm flex items-center gap-2 hover:bg-blue-700 transition-colors">
              {isSearching ? <Loader2 className="animate-spin" size={16}/> : <Search size={16} />}
              BUSCAR
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
              {searchResults.map(r => (
                <div key={r.id} className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2 border-b border-slate-50 pb-2">
                       <span className="font-black text-slate-900 text-2xl tracking-tighter">#{r.id}</span>
                       <button onClick={() => loadOrderForEdit(r)} className="bg-blue-600 text-white px-3 py-1 rounded-lg font-black text-[10px] uppercase flex items-center gap-1 hover:bg-blue-700 transition-colors">
                          <Edit3 size={12} /> EDITAR
                       </button>
                    </div>
                    <h4 className="font-black text-slate-800 uppercase text-sm mb-2 leading-tight truncate">{r.customerName}</h4>
                    <div className="grid grid-cols-2 gap-1 text-[10px] mb-2">
                       <div className="flex items-center gap-1 text-slate-500 font-bold"><Calendar size={12} className="text-blue-500" /> {r.pickupDate}</div>
                       <div className="flex items-center gap-1 text-slate-500 font-bold"><Clock size={12} className="text-blue-500" /> {r.pickupTime}</div>
                       <div className="flex items-center gap-1 text-slate-900 font-black col-span-2"><Phone size={12} className="text-green-600" /> {r.phone || 'SIN TEL'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Form Section - Optimized for PC */}
      <div className={`bg-white rounded-[1.5rem] p-5 shadow-sm border transition-all ${isEditing ? 'ring-4 ring-blue-50 border-blue-200' : 'border-slate-100'}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-2">
            <h2 className="text-xl font-black text-slate-800 tracking-tighter flex items-center gap-2">
                {isEditing ? <Edit3 className="text-blue-600" size={24} /> : <PlusCircle className="text-orange-600" size={24} />}
                {isEditing ? `EDITANDO #${originalId}` : 'NUEVA CARGA DE PEDIDO'}
            </h2>
            {isEditing && (
              <div className="flex gap-2">
                <button onClick={handleDeleteOrder} disabled={isSaving} className="bg-red-50 px-3 py-1.5 rounded-lg text-[10px] font-black text-red-600 uppercase flex items-center gap-1 hover:bg-red-100 border border-red-100">
                  <Trash2 size={14} /> Borrar
                </button>
                <button onClick={handleCancelEdit} className="bg-slate-100 px-3 py-1.5 rounded-lg text-[10px] font-black text-slate-500 uppercase flex items-center gap-1 hover:bg-slate-200">
                  <XCircle size={14} /> Cancelar
                </button>
              </div>
            )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* SECCIÓN 1: DATOS DE LA COMANDA Y PERSONALES */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">1. Comanda</label>
              <input id="comanda-id" type="text" required placeholder="0542" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 outline-none font-mono font-black text-lg shadow-sm" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isSaving} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">2. Fecha</label>
              <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm focus:bg-white focus:border-orange-500 outline-none shadow-sm cursor-pointer" value={formData.pickupDate} onChange={e => setFormData({...formData, pickupDate: e.target.value as any})} disabled={isSaving}>
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">3. Hora</label>
              <input type="time" required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm focus:bg-white focus:border-orange-500 outline-none shadow-sm" value={formData.pickupTime || ''} onChange={e => setFormData({...formData, pickupTime: e.target.value})} disabled={isSaving} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">6. Teléfono</label>
              <input type="tel" placeholder="3816543210" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:bg-white focus:border-orange-500 outline-none shadow-sm" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} disabled={isSaving} />
            </div>

            <div className="space-y-1 lg:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">4. Nombre Completo</label>
              <input type="text" required placeholder="JUAN PÉREZ" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black uppercase text-sm focus:bg-white focus:border-orange-500 outline-none shadow-sm" value={formData.customerName || ''} onChange={e => setFormData({...formData, customerName: e.target.value.toUpperCase()})} disabled={isSaving} />
            </div>

            <div className="space-y-1 lg:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">5. Dirección / Reparto</label>
              <input type="text" placeholder="Calle, Barrio..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:bg-white focus:border-orange-500 outline-none shadow-sm" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} disabled={isSaving} />
            </div>

            <div className="space-y-1 lg:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">7. Sucursal de retiro</label>
              <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm focus:bg-white focus:border-orange-500 outline-none shadow-sm cursor-pointer" value={formData.pickupBranch} onChange={e => setFormData({...formData, pickupBranch: e.target.value as any})} disabled={isSaving}>
                {PICKUP_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>

            {/* SECCIÓN 2: CANTIDADES - Integrada en el grid */}
            <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">8a. Triples</label>
                <input type="number" min="0" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg focus:bg-white focus:border-blue-500 outline-none text-center shadow-sm" value={formData.qtyTriples || ''} onChange={e => setFormData({...formData, qtyTriples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} onWheel={handleWheelDisable} disabled={isSaving} />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-1">8b. Simples</label>
                <input type="number" min="0" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg focus:bg-white focus:border-orange-500 outline-none text-center shadow-sm" value={formData.qtySimples || ''} onChange={e => setFormData({...formData, qtySimples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} onWheel={handleWheelDisable} disabled={isSaving} />
            </div>

            {/* SECCIÓN 3: PAGO Y OBSERVACIONES */}
            <div className="space-y-1 lg:col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">9. Pago</label>
                <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm focus:bg-white focus:border-orange-500 outline-none shadow-sm cursor-pointer" value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value as PaymentStatus})} disabled={isSaving}>
                  {PAYMENT_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
            <div className="space-y-1 lg:col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">10. Seña ($)</label>
                <input type="number" min="0" step="100" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg text-green-700 focus:bg-white focus:border-orange-500 outline-none shadow-sm" value={depositInput === '0' ? '' : depositInput} onChange={e => { setDepositInput(e.target.value); setFormData({...formData, deposit: parseFloat(e.target.value) || 0}); }} onWheel={handleWheelDisable} disabled={isSaving} />
            </div>

            <div className="space-y-1 lg:col-span-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">11. Observaciones</label>
              <textarea className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:bg-white focus:border-orange-500 outline-none shadow-sm resize-none" rows={1} placeholder="Notas..." value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} disabled={isSaving} />
            </div>
          </div>

          {/* ACCIÓN DE GUARDADO */}
          <div className="pt-2 flex flex-col items-center gap-2">
             <button type="submit" disabled={isSaving} className={`w-full max-w-[200px] py-2.5 rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 ${isEditing ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-orange-600 hover:bg-orange-700 text-white'}`}>
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {isSaving ? 'GUARDANDO...' : 'GUARDAR COMANDA'}
             </button>

             {message && (
               <div className={`w-full max-w-sm p-2 rounded-lg text-center font-black text-[10px] border-2 animate-fade-in flex items-center justify-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                 <AlertCircle size={14} />
                 {message.text}
               </div>
             )}
          </div>
        </form>
      </div>
    </div>
  );
};
