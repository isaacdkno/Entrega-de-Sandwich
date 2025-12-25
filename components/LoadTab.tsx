
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
    <div className="space-y-2 max-w-[1400px] mx-auto">
      {/* Botones de acción compactos */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm text-[10px] font-black text-slate-700 hover:bg-slate-50 transition-colors">
          <Settings size={12} className="text-orange-600" />
          Fábrica: {session.currentProductionBranch}
          <ChevronDown size={10} />
        </button>
        <button onClick={() => setShowSearchPanel(!showSearchPanel)} className={`px-2.5 py-1 rounded-lg font-black text-[10px] flex items-center gap-1.5 transition-all uppercase tracking-widest ${showSearchPanel ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
          <Search size={12} />
          {showSearchPanel ? 'Cerrar' : 'Buscar / Editar'}
        </button>
      </div>

      {isSettingsOpen && (
        <div className="p-2 bg-orange-50 rounded-lg border border-orange-200 animate-fade-in flex flex-wrap gap-2">
          {PRODUCTION_BRANCHES.map(b => (
            <button key={b.value} onClick={() => handleSettingsChange(b.value)} className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${session.currentProductionBranch === b.value ? 'bg-orange-600 text-white' : 'bg-white border hover:bg-slate-50'}`}>
              {b.label}
            </button>
          ))}
        </div>
      )}

      {showSearchPanel && (
        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 shadow-inner animate-fade-in">
          <form onSubmit={handleSearchForEdit} className="flex gap-2 mb-3">
            <input type="text" placeholder="Comanda o Nombre..." className="flex-1 p-2 rounded-lg border border-blue-200 text-xs focus:ring-2 focus:ring-blue-400 outline-none font-bold" value={searchId} onChange={e => setSearchId(e.target.value)} />
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md font-black text-xs flex items-center gap-1.5 hover:bg-blue-700">
              <Search size={14} /> BUSCAR
            </button>
          </form>
          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
              {searchResults.map(r => (
                <div key={r.id} className="bg-white rounded-lg p-2 border border-blue-100 shadow-sm flex justify-between items-center">
                  <div className="truncate">
                    <span className="font-black text-slate-900 mr-2">#{r.id}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{r.customerName}</span>
                  </div>
                  <button onClick={() => loadOrderForEdit(r)} className="bg-blue-600 text-white p-1.5 rounded-md hover:bg-blue-700">
                     <Edit3 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Formulario Principal Compacto */}
      <div className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${isEditing ? 'ring-2 ring-blue-400 border-blue-200' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h2 className="text-sm font-black text-slate-800 tracking-widest flex items-center gap-2 uppercase">
                {isEditing ? <Edit3 className="text-blue-600" size={16} /> : <PlusCircle className="text-orange-600" size={16} />}
                {isEditing ? `EDITANDO #${originalId}` : 'NUEVA CARGA DE PEDIDO'}
            </h2>
            {isEditing && (
              <div className="flex gap-1.5">
                <button onClick={handleDeleteOrder} className="bg-red-50 px-2 py-1 rounded text-[9px] font-black text-red-600 uppercase border border-red-100 hover:bg-red-100"><Trash2 size={10} /></button>
                <button onClick={handleCancelEdit} className="bg-slate-100 px-2 py-1 rounded text-[9px] font-black text-slate-500 uppercase hover:bg-slate-200">X</button>
              </div>
            )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Fila 1: Comanda, Fecha, Hora, Teléfono */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-0.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">1. Comanda</label>
              <input id="comanda-id" type="text" required placeholder="Ej: 0542" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-orange-500 outline-none font-mono font-black text-sm" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isSaving} />
            </div>
            <div className="space-y-0.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">2. Fecha</label>
              <select className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-black text-xs focus:bg-white focus:border-orange-500 outline-none cursor-pointer" value={formData.pickupDate} onChange={e => setFormData({...formData, pickupDate: e.target.value as any})} disabled={isSaving}>
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-0.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">3. Hora</label>
              <input type="time" required className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-black text-xs focus:bg-white focus:border-orange-500 outline-none" value={formData.pickupTime || ''} onChange={e => setFormData({...formData, pickupTime: e.target.value})} disabled={isSaving} />
            </div>
            <div className="space-y-0.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">6. Teléfono</label>
              <input type="tel" placeholder="3816543210" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs focus:bg-white focus:border-orange-500 outline-none" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} disabled={isSaving} />
            </div>
          </div>

          {/* Fila 2: Nombre y Dirección */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-0.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">4. Nombre Completo</label>
              <input type="text" required placeholder="JUAN PÉREZ" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-black uppercase text-xs focus:bg-white focus:border-orange-500 outline-none" value={formData.customerName || ''} onChange={e => setFormData({...formData, customerName: e.target.value.toUpperCase()})} disabled={isSaving} />
            </div>
            <div className="space-y-0.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">5. Dirección / Reparto</label>
              <input type="text" placeholder="Calle, Barrio, Manzana..." className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs focus:bg-white focus:border-orange-500 outline-none" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} disabled={isSaving} />
            </div>
          </div>

          {/* Fila 3: Sucursal, Cantidades, Pago y Seña */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="space-y-0.5 col-span-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">7. Sucursal Retiro</label>
              <select className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-black text-xs focus:bg-white focus:border-orange-500 outline-none cursor-pointer" value={formData.pickupBranch} onChange={e => setFormData({...formData, pickupBranch: e.target.value as any})} disabled={isSaving}>
                {PICKUP_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div className="space-y-0.5">
                <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1">8a. Triples</label>
                <input type="number" min="0" className="w-full p-2 bg-blue-50/30 border border-blue-100 rounded-lg font-black text-sm text-center outline-none focus:bg-white focus:border-blue-500" value={formData.qtyTriples || ''} onChange={e => setFormData({...formData, qtyTriples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} disabled={isSaving} />
            </div>
            <div className="space-y-0.5">
                <label className="text-[9px] font-black text-orange-600 uppercase tracking-widest ml-1">8b. Simples</label>
                <input type="number" min="0" className="w-full p-2 bg-orange-50/30 border border-orange-100 rounded-lg font-black text-sm text-center outline-none focus:bg-white focus:border-orange-500" value={formData.qtySimples || ''} onChange={e => setFormData({...formData, qtySimples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} disabled={isSaving} />
            </div>
            <div className="space-y-0.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">9. Pago</label>
                <select className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-black text-[10px] focus:bg-white focus:border-orange-500 outline-none" value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value as PaymentStatus})} disabled={isSaving}>
                  {PAYMENT_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
            <div className="space-y-0.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">10. Seña ($)</label>
                <input type="number" min="0" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-black text-sm text-green-700 outline-none focus:bg-white focus:border-orange-500" value={depositInput === '0' ? '' : depositInput} onChange={e => { setDepositInput(e.target.value); setFormData({...formData, deposit: parseFloat(e.target.value) || 0}); }} disabled={isSaving} />
            </div>
          </div>

          {/* Fila Final: Observaciones y Guardar */}
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex-1 space-y-0.5 w-full">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">11. Observaciones</label>
              <textarea className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs focus:bg-white focus:border-orange-500 outline-none resize-none" rows={1} placeholder="Ej: Sin mayonesa..." value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} disabled={isSaving} />
            </div>
            <button type="submit" disabled={isSaving} className={`h-10 px-8 rounded-xl font-black text-xs tracking-[0.2em] shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 min-w-[180px] ${isEditing ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-orange-600 hover:bg-orange-700 text-white'}`}>
                {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                {isSaving ? 'GUARDANDO...' : 'GUARDAR COMANDA'}
            </button>
          </div>

          {message && (
            <div className={`p-1.5 rounded-lg text-center font-black text-[9px] border uppercase animate-fade-in ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
               {message.text}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
