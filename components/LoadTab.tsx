
import React, { useState, useEffect } from 'react';
import { UserSession, Order, PickupBranch, OrderStatus, ProductionBranch, UserRole, PaymentStatus } from '../types';
import { PICKUP_DATES, PICKUP_BRANCHES, PRODUCTION_BRANCHES, PAYMENT_STATUS_OPTIONS } from '../constants';
import { saveOrder, searchOrders, deleteOrder } from '../services/storageService';
import { Save, Settings, Loader2, Search, XCircle, Edit3, ChevronDown, AlertCircle, PlusCircle } from 'lucide-react';

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
      const timer = setTimeout(() => setMessage(null), 5000);
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
    try {
      const results = await searchOrders(searchId);
      if (results.length === 0) setMessage({ type: 'error', text: 'No se encontraron pedidos.' });
      else setSearchResults(results);
    } catch {
      setMessage({ type: 'error', text: 'Error de red.' });
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
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm text-xs font-bold text-slate-700 hover:bg-slate-50">
          <Settings size={16} className="text-orange-600" />
          Fábrica Origen: <span className="text-orange-600 ml-1 font-black">{session.currentProductionBranch}</span>
          <ChevronDown size={14} />
        </button>
        <button onClick={() => setShowSearchPanel(!showSearchPanel)} className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all uppercase tracking-widest ${showSearchPanel ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 shadow-sm'}`}>
          <Search size={16} />
          {showSearchPanel ? 'Cerrar Buscador' : 'Buscar / Editar'}
        </button>
      </div>

      {isSettingsOpen && (
        <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 animate-fade-in flex gap-3">
          {PRODUCTION_BRANCHES.map(b => (
            <button key={b.value} onClick={() => handleSettingsChange(b.value)} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${session.currentProductionBranch === b.value ? 'bg-orange-600 text-white shadow-md' : 'bg-white border text-slate-600'}`}>
              {b.label}
            </button>
          ))}
        </div>
      )}

      {showSearchPanel && (
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 shadow-inner">
          <form onSubmit={handleSearchForEdit} className="flex gap-3 mb-4">
            <input type="text" placeholder="Número de comanda..." className="flex-1 p-3 rounded-xl border border-blue-200 text-sm focus:ring-2 focus:ring-blue-400 outline-none font-bold" value={searchId} onChange={e => setSearchId(e.target.value)} />
            <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs">BUSCAR</button>
          </form>
          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
              {searchResults.map(r => (
                <div key={r.id} className="bg-white rounded-xl p-3 border border-blue-100 flex justify-between items-center">
                  <div className="truncate"><span className="font-black text-slate-900">#{r.id}</span> <span className="text-[10px] text-slate-500 uppercase">{r.customerName}</span></div>
                  <button onClick={() => loadOrderForEdit(r)} className="bg-blue-600 text-white p-2 rounded-lg"><Edit3 size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`bg-white rounded-3xl p-6 shadow-sm border transition-all ${isEditing ? 'ring-4 ring-blue-50 border-blue-200' : 'border-slate-100'}`}>
        <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-4">
            <h2 className="text-lg font-black text-slate-800 tracking-tighter flex items-center gap-3 uppercase">
                <div className={`p-2 rounded-xl ${isEditing ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                  {isEditing ? <Edit3 size={20} /> : <PlusCircle size={20} />}
                </div>
                {isEditing ? `EDITANDO #${originalId}` : 'NUEVA CARGA'}
            </h2>
            {isEditing && (
                <button onClick={handleCancelEdit} className="bg-slate-100 px-4 py-1.5 rounded-xl text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><XCircle size={14} /> Cancelar</button>
            )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Comanda</label>
              <input id="comanda-id" type="text" required placeholder="0000" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-black text-lg focus:bg-white focus:border-orange-500 outline-none" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isSaving} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Fecha</label>
              <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm" value={formData.pickupDate} onChange={e => setFormData({...formData, pickupDate: e.target.value as any})} disabled={isSaving}>
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">3. Hora</label>
              <input type="time" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm" value={formData.pickupTime || ''} onChange={e => setFormData({...formData, pickupTime: e.target.value})} disabled={isSaving} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">4. Cliente</label>
              <input type="text" required placeholder="NOMBRE COMPLETO" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-black uppercase text-sm" value={formData.customerName || ''} onChange={e => setFormData({...formData, customerName: e.target.value.toUpperCase()})} disabled={isSaving} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">5. Teléfono</label>
              <input type="tel" placeholder="381..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} disabled={isSaving} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">6. Sucursal Retiro</label>
              <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm" value={formData.pickupBranch} onChange={e => setFormData({...formData, pickupBranch: e.target.value as any})} disabled={isSaving}>
                {PICKUP_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">7. Triples</label>
                <input type="number" min="0" className="w-full p-3 bg-blue-50/30 border border-blue-100 rounded-2xl font-black text-xl text-center text-blue-700 outline-none focus:bg-white focus:border-blue-500 shadow-sm" value={formData.qtyTriples || ''} onChange={e => setFormData({...formData, qtyTriples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} disabled={isSaving} />
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest">8. Simples</label>
                <input type="number" min="0" className="w-full p-3 bg-orange-50/30 border border-orange-100 rounded-2xl font-black text-xl text-center text-orange-700 outline-none focus:bg-white focus:border-orange-500 shadow-sm" value={formData.qtySimples || ''} onChange={e => setFormData({...formData, qtySimples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} disabled={isSaving} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">9. Pago</label>
                <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm" value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value as PaymentStatus})} disabled={isSaving}>
                  {PAYMENT_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-green-700 uppercase tracking-widest">10. Seña ($)</label>
                <input type="number" min="0" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-base text-green-700 outline-none focus:bg-white focus:border-orange-500 shadow-sm" value={depositInput === '0' ? '' : depositInput} onChange={e => { setDepositInput(e.target.value); setFormData({...formData, deposit: parseFloat(e.target.value) || 0}); }} disabled={isSaving} />
            </div>
          </div>

          <div className="pt-4 flex flex-col items-center gap-4">
             <button type="submit" disabled={isSaving} className={`w-full max-w-sm py-4 rounded-2xl font-black text-sm tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 ${isEditing ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-orange-600 hover:bg-orange-700 text-white'}`}>
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {isSaving ? 'GUARDANDO...' : (isEditing ? 'GUARDAR CAMBIOS' : 'GUARDAR COMANDA')}
             </button>
             {message && (
               <div className={`px-6 py-2 rounded-xl text-center font-black text-[10px] uppercase tracking-widest border animate-fade-in flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                 <AlertCircle size={14} /> {message.text}
               </div>
             )}
          </div>
        </form>
      </div>
    </div>
  );
};
