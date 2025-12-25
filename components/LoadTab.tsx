
import React, { useState, useEffect } from 'react';
import { UserSession, Order, PickupBranch, OrderStatus, ProductionBranch, UserRole, PaymentStatus } from '../types';
import { PICKUP_DATES, PICKUP_BRANCHES, PRODUCTION_BRANCHES, PAYMENT_STATUS_OPTIONS } from '../constants';
import { saveOrder, searchOrders, deleteOrder } from '../services/storageService';
import { Save, Settings, Loader2, Search, XCircle, Edit3, ChevronDown, ChevronUp, AlertCircle, PlusCircle, Trash2, Calendar, Clock, MapPin, Package, DollarSign, StickyNote } from 'lucide-react';

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

  // Efecto para hacer desaparecer el mensaje automáticamente después de 5 segundos
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
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Settings & Search Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
          className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Settings size={18} className="text-orange-600" />
          Fábrica Origen: {session.currentProductionBranch}
          <ChevronDown size={14} />
        </button>
        <button 
          onClick={() => { setShowSearchPanel(!showSearchPanel); setSearchResults([]); }}
          className={`px-4 py-2 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all ${showSearchPanel ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
        >
          {showSearchPanel ? <ChevronUp size={16} /> : <Search size={16} />}
          {showSearchPanel ? 'Ocultar Buscador' : 'Buscar / Editar comanda'}
        </button>
      </div>

      {isSettingsOpen && (
        <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 animate-fade-in flex flex-wrap gap-2">
          {PRODUCTION_BRANCHES.map(b => (
            <button key={b.value} onClick={() => handleSettingsChange(b.value)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${session.currentProductionBranch === b.value ? 'bg-orange-600 text-white' : 'bg-white border hover:bg-slate-50'}`}>
              {b.label}
            </button>
          ))}
        </div>
      )}

      {showSearchPanel && (
        <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 shadow-inner animate-fade-in">
          <form onSubmit={handleSearchForEdit} className="flex gap-2 mb-6">
            <input type="text" placeholder="Escriba Comanda, Nombre o Teléfono..." className="flex-1 p-4 rounded-2xl border border-blue-200 text-sm focus:ring-2 focus:ring-blue-400 outline-none font-bold" value={searchId} onChange={e => setSearchId(e.target.value)} />
            <button type="submit" disabled={isSearching} className="bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-md font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors">
              {isSearching ? <Loader2 className="animate-spin" size={20}/> : <Search size={20} />}
              BUSCAR
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {searchResults.map(r => (
                <div key={r.id} className="bg-white rounded-2xl p-5 border border-blue-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3 border-b border-slate-50 pb-2">
                       <span className="font-black text-slate-900 text-3xl tracking-tighter">#{r.id}</span>
                       <button onClick={() => loadOrderForEdit(r)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-black text-xs uppercase flex items-center gap-2 hover:bg-blue-700 transition-colors">
                          <Edit3 size={14} /> EDITAR
                       </button>
                    </div>
                    
                    <h4 className="font-black text-slate-800 uppercase text-lg mb-3 leading-tight">{r.customerName}</h4>
                    
                    <div className="grid grid-cols-2 gap-y-3 text-xs mb-4">
                       <div className="flex items-center gap-2 text-slate-500 font-bold">
                          <Calendar size={14} className="text-blue-500" /> {r.pickupDate}
                       </div>
                       <div className="flex items-center gap-2 text-slate-500 font-bold">
                          <Clock size={14} className="text-blue-500" /> {r.pickupTime}
                       </div>
                       <div className="flex items-center gap-2 text-slate-500 font-bold">
                          <MapPin size={14} className="text-blue-500" /> {r.pickupBranch}
                       </div>
                       <div className="flex items-center gap-2 text-slate-500 font-bold">
                          <Package size={14} className="text-blue-500" /> {r.qtyTriples}T | {r.qtySimples}S
                       </div>
                       <div className="col-span-2 flex items-center gap-2">
                          <DollarSign size={14} className="text-green-600" />
                          <span className={`px-2 py-0.5 rounded-md font-black uppercase text-[10px] border ${r.paymentStatus === PaymentStatus.PAID ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-100'}`}>
                             {r.paymentStatus} (${r.deposit} seña)
                          </span>
                       </div>
                    </div>
                  </div>

                  {r.notes && (
                    <div className="bg-slate-50 p-2 rounded-lg flex items-start gap-2 border border-slate-100 italic text-[11px] text-slate-600">
                       <StickyNote size={12} className="flex-shrink-0 mt-0.5 text-slate-400" />
                       <span className="line-clamp-2">{r.notes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Form Section */}
      <div className={`bg-white rounded-[2.5rem] p-8 shadow-md border transition-all ${isEditing ? 'ring-8 ring-blue-50 border-blue-300' : 'border-slate-100'}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
                {isEditing ? <Edit3 className="text-blue-600" size={32} /> : <PlusCircle className="text-orange-600" size={32} />}
                {isEditing ? `EDITANDO COMANDA #${originalId}` : 'NUEVA CARGA DE PEDIDO'}
            </h2>
            {isEditing && (
              <div className="flex gap-3">
                <button 
                  onClick={handleDeleteOrder} 
                  disabled={isSaving}
                  className="bg-red-50 px-4 py-2 rounded-xl text-xs font-black text-red-600 uppercase tracking-widest flex items-center gap-2 hover:bg-red-100 transition-colors border border-red-100"
                >
                  <Trash2 size={18} /> Eliminar Comanda
                </button>
                <button 
                  onClick={handleCancelEdit} 
                  className="bg-slate-100 px-4 py-2 rounded-xl text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-colors"
                >
                  <XCircle size={18} /> Cancelar edición
                </button>
              </div>
            )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* SECCIÓN 1: DATOS DE LA COMANDA Y PERSONALES */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">1. Número de comanda</label>
              <input id="comanda-id" type="text" required placeholder="Ej: 0542" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:border-orange-500 outline-none font-mono font-black text-2xl transition-all shadow-sm" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isSaving} />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">2. Fecha de retiro</label>
              <select className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-lg focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm cursor-pointer" value={formData.pickupDate} onChange={e => setFormData({...formData, pickupDate: e.target.value as any})} disabled={isSaving}>
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">3. Hora de retiro</label>
              <input type="time" required className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-xl focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm" value={formData.pickupTime || ''} onChange={e => setFormData({...formData, pickupTime: e.target.value})} disabled={isSaving} />
            </div>

            <div className="hidden lg:block"></div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">4. Nombre Completo</label>
              <input type="text" required placeholder="JUAN PÉREZ" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black uppercase text-lg focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm" value={formData.customerName || ''} onChange={e => setFormData({...formData, customerName: e.target.value.toUpperCase()})} disabled={isSaving} />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">5. Dirección / Reparto</label>
              <input type="text" placeholder="Calle, Barrio, Manzana..." className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} disabled={isSaving} />
            </div>

            <div className="space-y-2 lg:col-span-1">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">6. Teléfono</label>
              <input type="tel" placeholder="3816543210" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} disabled={isSaving} />
            </div>

            <div className="space-y-2 lg:col-span-1">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">7. Sucursal de retiro</label>
              <select className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-lg focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm cursor-pointer" value={formData.pickupBranch} onChange={e => setFormData({...formData, pickupBranch: e.target.value as any})} disabled={isSaving}>
                {PICKUP_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>

            <div className="hidden lg:block lg:col-span-2"></div>
          </div>

          {/* SECCIÓN 2: CANTIDADES */}
          <div className="space-y-6 pt-4">
             <div className="flex items-center gap-3">
                <div className="bg-orange-600 p-2 rounded-xl text-white"><PlusCircle size={20} /></div>
                <h3 className="text-slate-800 font-black uppercase text-sm tracking-widest">8. Cantidades de Sándwiches</h3>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 text-blue-600">Unid. Triples</label>
                    <input 
                      type="number" 
                      min="0" 
                      placeholder="0" 
                      className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-2xl focus:bg-white focus:border-blue-500 outline-none transition-all shadow-sm text-center" 
                      value={formData.qtyTriples || ''} 
                      onChange={e => setFormData({...formData, qtyTriples: parseInt(e.target.value) || 0})} 
                      onFocus={e => e.target.select()} 
                      onWheel={handleWheelDisable}
                      disabled={isSaving} 
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 text-orange-600">Unid. Simples</label>
                    <input 
                      type="number" 
                      min="0" 
                      placeholder="0" 
                      className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-2xl focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm text-center" 
                      value={formData.qtySimples || ''} 
                      onChange={e => setFormData({...formData, qtySimples: parseInt(e.target.value) || 0})} 
                      onFocus={e => e.target.select()} 
                      onWheel={handleWheelDisable}
                      disabled={isSaving} 
                    />
                </div>
             </div>
          </div>

          {/* SECCIÓN 3: PAGO Y OBSERVACIONES */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Estado de Pago</label>
                <select className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-lg focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm cursor-pointer" value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value as PaymentStatus})} disabled={isSaving}>
                  {PAYMENT_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Monto de Seña ($)</label>
                <input 
                  type="number" 
                  min="0" 
                  step="100" 
                  placeholder="0.00" 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-2xl text-green-700 focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm" 
                  value={depositInput === '0' ? '' : depositInput} 
                  onChange={e => { setDepositInput(e.target.value); setFormData({...formData, deposit: parseFloat(e.target.value) || 0}); }} 
                  onWheel={handleWheelDisable}
                  disabled={isSaving} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Observaciones / Notas internas</label>
              <textarea className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm" rows={2} placeholder="Ej: Sin mayonesa, Cliente habitual..." value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} disabled={isSaving} />
            </div>
          </div>

          {/* ACCIÓN DE GUARDADO */}
          <div className="pt-2 flex flex-col items-center gap-4">
             <button type="submit" disabled={isSaving} className={`w-full max-w-[240px] py-3 rounded-xl font-black text-lg shadow-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 ${isEditing ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-orange-600 hover:bg-orange-700 text-white'}`}>
                {isSaving ? <Loader2 className="animate-spin" size={22} /> : <Save size={22} />}
                {isSaving ? 'GUARDANDO...' : 'GUARDAR COMANDA'}
             </button>

             {message && (
               <div className={`w-full max-w-md p-3 rounded-xl text-center font-black text-sm border-2 animate-fade-in flex items-center justify-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                 <AlertCircle size={18} />
                 {message.text}
               </div>
             )}
          </div>
        </form>
      </div>
    </div>
  );
};
