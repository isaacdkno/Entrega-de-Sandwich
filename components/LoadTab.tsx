
import React, { useState } from 'react';
import { UserSession, Order, PickupBranch, OrderStatus, ProductionBranch, UserRole, PaymentStatus } from '../types';
import { PICKUP_DATES, PICKUP_BRANCHES, PRODUCTION_BRANCHES, PAYMENT_STATUS_OPTIONS } from '../constants';
import { saveOrder, deleteOrder, searchOrders } from '../services/storageService';
import { Save, Settings, Loader2, Search, Trash2, XCircle, Edit3, ChevronDown, ChevronUp, AlertCircle, PlusCircle } from 'lucide-react';

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
      else if (results.length === 1) loadOrderForEdit(results[0]);
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
      {/* Header & Settings */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
          className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Settings size={18} className="text-orange-600" />
          Fábrica: {session.currentProductionBranch}
          <ChevronDown size={14} />
        </button>
        <button 
          onClick={() => setShowSearchPanel(!showSearchPanel)}
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
        <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100 shadow-inner animate-fade-in">
          <form onSubmit={handleSearchForEdit} className="flex gap-2">
            <input type="text" placeholder="ID Comanda o Nombre de Cliente..." className="flex-1 p-4 rounded-2xl border border-blue-200 text-sm focus:ring-2 focus:ring-blue-400 outline-none font-bold" value={searchId} onChange={e => setSearchId(e.target.value)} />
            <button type="submit" disabled={isSearching} className="bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-md font-bold flex items-center gap-2">
              {isSearching ? <Loader2 className="animate-spin" size={20}/> : <Search size={20} />}
              BUSCAR
            </button>
          </form>
          {searchResults.length > 0 && (
            <div className="mt-3 bg-white rounded-2xl overflow-hidden border border-blue-100 shadow-xl max-h-64 overflow-y-auto">
              {searchResults.map(r => (
                <button key={r.id} onClick={() => loadOrderForEdit(r)} className="w-full text-left p-4 border-b last:border-0 hover:bg-blue-50 flex justify-between items-center transition-colors">
                  <div>
                    <span className="font-black text-slate-800 text-lg">#{r.id}</span>
                    <span className="ml-4 text-slate-600 font-bold uppercase">{r.customerName}</span>
                  </div>
                  <Edit3 size={18} className="text-blue-500" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Formulario Principal Optimizado para PC */}
      <div className={`bg-white rounded-[2.5rem] p-8 shadow-md border transition-all ${isEditing ? 'ring-8 ring-blue-50 border-blue-300' : 'border-slate-100'}`}>
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
                {isEditing ? <Edit3 className="text-blue-600" size={32} /> : <PlusCircle className="text-orange-600" size={32} />}
                {isEditing ? `EDITANDO COMANDA #${originalId}` : 'NUEVA CARGA DE PEDIDO'}
            </h2>
            {isEditing && (
              <button onClick={handleCancelEdit} className="bg-slate-100 px-4 py-2 rounded-xl text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-colors">
                <XCircle size={18} /> Cancelar edición
              </button>
            )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* SECCIÓN 1: DATOS DE LA COMANDA (ORDEN SOLICITADO) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
            {/* 1. Número de comanda */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">1. Número de comanda</label>
              <input id="comanda-id" type="text" required placeholder="Ej: 0542" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:border-orange-500 outline-none font-mono font-black text-2xl transition-all shadow-sm" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isSaving} />
            </div>

            {/* 2. Fecha de retiro */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">2. Fecha de retiro</label>
              <select className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-lg focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm cursor-pointer" value={formData.pickupDate} onChange={e => setFormData({...formData, pickupDate: e.target.value as any})} disabled={isSaving}>
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* 3. Hora */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">3. Hora de retiro</label>
              <input type="time" required className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-xl focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm" value={formData.pickupTime || ''} onChange={e => setFormData({...formData, pickupTime: e.target.value})} disabled={isSaving} />
            </div>

            {/* 4. Nombre Completo */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">4. Nombre Completo</label>
              <input type="text" required placeholder="JUAN PÉREZ" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black uppercase text-lg focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm" value={formData.customerName || ''} onChange={e => setFormData({...formData, customerName: e.target.value.toUpperCase()})} disabled={isSaving} />
            </div>

            {/* 5. Dirección */}
            <div className="space-y-2 lg:col-span-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">5. Dirección / Reparto</label>
              <input type="text" placeholder="Calle, Barrio, Manzana..." className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} disabled={isSaving} />
            </div>

            {/* 6. Teléfono */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">6. Teléfono</label>
              <input type="tel" placeholder="3816543210" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} disabled={isSaving} />
            </div>

            {/* 7. Sucursal de retiro */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">7. Sucursal de retiro</label>
              <select className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-lg focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm cursor-pointer" value={formData.pickupBranch} onChange={e => setFormData({...formData, pickupBranch: e.target.value as any})} disabled={isSaving}>
                {PICKUP_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
          </div>

          {/* SECCIÓN 2: CANTIDADES (ORDEN 8) */}
          <div className="bg-slate-900 p-8 rounded-[2rem] border-b-8 border-slate-800 shadow-xl">
             <div className="flex items-center gap-3 mb-6">
                <div className="bg-orange-600 p-2 rounded-xl text-white"><PlusCircle size={20} /></div>
                <h3 className="text-white font-black uppercase text-sm tracking-widest">8. Cantidades de Sándwiches</h3>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="flex items-center gap-6 bg-slate-800/50 p-6 rounded-3xl border border-slate-700">
                    <div className="flex-1">
                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Unid. Triples</label>
                        <input type="number" min="0" placeholder="0" className="w-full bg-slate-900 p-4 text-5xl font-black text-blue-500 border-2 border-slate-700 rounded-2xl text-center shadow-inner focus:border-blue-500 outline-none transition-all" value={formData.qtyTriples || ''} onChange={e => setFormData({...formData, qtyTriples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} disabled={isSaving} />
                    </div>
                </div>
                <div className="flex items-center gap-6 bg-slate-800/50 p-6 rounded-3xl border border-slate-700">
                    <div className="flex-1">
                        <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest block mb-2">Unid. Simples</label>
                        <input type="number" min="0" placeholder="0" className="w-full bg-slate-900 p-4 text-5xl font-black text-orange-500 border-2 border-slate-700 rounded-2xl text-center shadow-inner focus:border-orange-500 outline-none transition-all" value={formData.qtySimples || ''} onChange={e => setFormData({...formData, qtySimples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} disabled={isSaving} />
                    </div>
                </div>
             </div>
          </div>

          {/* SECCIÓN 3: PAGO Y NOTAS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Estado de Pago</label>
              <select className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-lg focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm cursor-pointer" value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value as PaymentStatus})} disabled={isSaving}>
                {PAYMENT_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Monto de Seña ($)</label>
              <input type="number" min="0" step="100" placeholder="0.00" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-2xl text-green-700 focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm" value={depositInput === '0' ? '' : depositInput} onChange={e => { setDepositInput(e.target.value); setFormData({...formData, deposit: parseFloat(e.target.value) || 0}); }} disabled={isSaving} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Observaciones / Notas internas</label>
              <textarea className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm" rows={2} placeholder="Ej: Sin mayonesa, Cliente habitual..." value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} disabled={isSaving} />
            </div>
          </div>

          {/* BOTÓN DE ACCIÓN FINAL */}
          <div className="pt-6 space-y-4">
             <button type="submit" disabled={isSaving} className={`w-full py-6 rounded-[2rem] font-black text-2xl shadow-2xl transition-all flex items-center justify-center gap-4 active:scale-[0.98] disabled:opacity-50 ${isEditing ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-orange-600 hover:bg-orange-700 text-white'}`}>
                {isSaving ? <Loader2 className="animate-spin" size={32} /> : <Save size={32} />}
                {isSaving ? 'PROCESANDO REGISTRO...' : (isEditing ? 'GUARDAR CAMBIOS EN COMANDA' : 'REGISTRAR PEDIDO FINAL')}
             </button>

             {message && (
               <div className={`p-5 rounded-[2rem] text-center font-black text-lg border-2 animate-bounce flex items-center justify-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                 <AlertCircle size={24} />
                 {message.text}
               </div>
             )}
          </div>
        </form>
      </div>
    </div>
  );
};
