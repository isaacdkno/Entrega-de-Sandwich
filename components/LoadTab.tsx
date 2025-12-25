
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
    <div className="space-y-6">
      {/* Header Mobile & Settings */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
          className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm text-sm font-bold text-slate-700"
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
          {showSearchPanel ? 'Ocultar' : 'Buscar / Editar'}
        </button>
      </div>

      {isSettingsOpen && (
        <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 animate-fade-in flex flex-wrap gap-2">
          {PRODUCTION_BRANCHES.map(b => (
            <button key={b.value} onClick={() => handleSettingsChange(b.value)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${session.currentProductionBranch === b.value ? 'bg-orange-600 text-white' : 'bg-white border'}`}>
              {b.label}
            </button>
          ))}
        </div>
      )}

      {showSearchPanel && (
        <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100 shadow-inner animate-fade-in">
          <form onSubmit={handleSearchForEdit} className="flex gap-2">
            <input type="text" placeholder="ID o Nombre..." className="flex-1 p-4 rounded-2xl border border-blue-200 text-sm focus:ring-2 focus:ring-blue-400 outline-none font-bold" value={searchId} onChange={e => setSearchId(e.target.value)} />
            <button type="submit" disabled={isSearching} className="bg-blue-600 text-white p-4 rounded-2xl shadow-md">
              {isSearching ? <Loader2 className="animate-spin" size={20}/> : <Search size={20} />}
            </button>
          </form>
          {searchResults.length > 0 && (
            <div className="mt-3 bg-white rounded-2xl overflow-hidden border border-blue-100 shadow-xl max-h-48 overflow-y-auto">
              {searchResults.map(r => (
                <button key={r.id} onClick={() => loadOrderForEdit(r)} className="w-full text-left p-4 border-b last:border-0 hover:bg-blue-50 flex justify-between items-center transition-colors">
                  <span className="font-bold text-slate-800">#{r.id} - {r.customerName}</span>
                  <Edit3 size={16} className="text-blue-500" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Formulario Principal */}
      <div className={`bg-white rounded-[2rem] p-6 shadow-sm border transition-all ${isEditing ? 'ring-4 ring-blue-100 border-blue-300' : 'border-slate-100'}`}>
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                {isEditing ? <Edit3 className="text-blue-600" /> : <PlusCircle className="text-orange-600" />}
                {isEditing ? `Editando #${originalId}` : 'Carga de Pedido'}
            </h2>
            {isEditing && (
              <button onClick={handleCancelEdit} className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <XCircle size={16} /> Cancelar
              </button>
            )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Fila 1: Datos Comanda */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comanda #</label>
              <input id="comanda-id" type="text" required placeholder="0001" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-orange-100 outline-none font-mono font-black text-xl" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isSaving} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Retiro</label>
              <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-orange-100 outline-none" value={formData.pickupDate} onChange={e => setFormData({...formData, pickupDate: e.target.value as any})} disabled={isSaving}>
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Horario</label>
              <input type="time" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black focus:ring-4 focus:ring-orange-100 outline-none" value={formData.pickupTime || ''} onChange={e => setFormData({...formData, pickupTime: e.target.value})} disabled={isSaving} />
            </div>
          </div>

          {/* Fila 2: Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
              <input type="text" required placeholder="JUAN PÉREZ" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black uppercase focus:ring-4 focus:ring-orange-100 outline-none" value={formData.customerName || ''} onChange={e => setFormData({...formData, customerName: e.target.value.toUpperCase()})} disabled={isSaving} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
              <input type="tel" placeholder="381..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-100 outline-none" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} disabled={isSaving} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sucursal de Retiro</label>
              <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-orange-100 outline-none" value={formData.pickupBranch} onChange={e => setFormData({...formData, pickupBranch: e.target.value as any})} disabled={isSaving}>
                {PICKUP_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección / Reparto</label>
              <input type="text" placeholder="B° San Martín, Mza 2..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-100 outline-none" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} disabled={isSaving} />
            </div>
          </div>

          {/* Sección Unidades (Touch Friendly) */}
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Unid. Triples</label>
                <input type="number" min="0" placeholder="0" className="w-full bg-white p-5 text-4xl font-black text-blue-700 border-2 border-slate-200 rounded-3xl text-center shadow-inner focus:border-blue-500 outline-none transition-all" value={formData.qtyTriples || ''} onChange={e => setFormData({...formData, qtyTriples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} disabled={isSaving} />
              </div>
              <div className="text-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Unid. Simples</label>
                <input type="number" min="0" placeholder="0" className="w-full bg-white p-5 text-4xl font-black text-orange-600 border-2 border-slate-200 rounded-3xl text-center shadow-inner focus:border-orange-500 outline-none transition-all" value={formData.qtySimples || ''} onChange={e => setFormData({...formData, qtySimples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} disabled={isSaving} />
              </div>
            </div>
          </div>

          {/* Pago */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado de Pago</label>
              <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black focus:ring-4 focus:ring-orange-100 outline-none" value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value as PaymentStatus})} disabled={isSaving}>
                {PAYMENT_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Monto de Seña ($)</label>
              <input type="number" min="0" step="100" placeholder="0.00" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-green-700 focus:ring-4 focus:ring-orange-100 outline-none" value={depositInput === '0' ? '' : depositInput} onChange={e => { setDepositInput(e.target.value); setFormData({...formData, deposit: parseFloat(e.target.value) || 0}); }} disabled={isSaving} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones</label>
            <textarea className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-orange-100 outline-none" rows={2} value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} disabled={isSaving} />
          </div>

          <div className="pt-4 space-y-4">
             <button type="submit" disabled={isSaving} className={`w-full py-5 rounded-[1.5rem] font-black text-xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 ${isEditing ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'}`}>
                {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={28} />}
                {isSaving ? 'PROCESANDO...' : (isEditing ? 'ACTUALIZAR PEDIDO' : 'GUARDAR PEDIDO')}
             </button>

             {message && (
               <div className={`p-4 rounded-2xl text-center font-black border animate-bounce ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                 {message.text}
               </div>
             )}
          </div>
        </form>
      </div>
    </div>
  );
};
