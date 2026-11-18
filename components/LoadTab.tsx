
import React, { useState, useEffect } from 'react';
import { UserSession, Order, PickupBranch, OrderStatus, ProductionBranch, PaymentStatus } from '../types';
import { PICKUP_DATES, PICKUP_BRANCHES, PRODUCTION_BRANCHES, PAYMENT_STATUS_OPTIONS } from '../constants';
import { saveOrder, searchOrders, deleteOrder } from '../services/storageService';
import { Save, Settings, Loader2, Search, XCircle, Edit3, ChevronDown, AlertCircle, PlusCircle, Clock, Phone, MapPin, StickyNote, Trash2 } from 'lucide-react';

interface LoadTabProps {
  session: UserSession;
  onSessionUpdate: (session: UserSession) => void;
  refreshData: () => void;
  selectedDate: string;
}

const QUICK_TIMES = ['12:00', '13:00', '14:00', '20:00', '21:00', '22:00'];

export const LoadTab: React.FC<LoadTabProps> = ({ session, onSessionUpdate, refreshData, selectedDate }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [searchResults, setSearchResults] = useState<Order[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [originalId, setOriginalId] = useState<string | null>(null);
  const [depositInput, setDepositInput] = useState('0');

  const [formData, setFormData] = useState<Partial<Order>>({
    pickupDate: selectedDate || PICKUP_DATES[0],
    pickupTime: '',
    qtyTriples: 0,
    qtySimples: 0,
    deposit: 0,
    paymentStatus: PaymentStatus.UNPAID,
    pickupBranch: PickupBranch.CENTRAL,
    address: '',
    notes: '',
    customerName: '',
    phone: '',
    id: ''
  });
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setFormData(prev => ({ ...prev, pickupDate: selectedDate }));
    }
  }, [selectedDate, isEditing]);

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
        pickupDate: selectedDate || PICKUP_DATES[0], pickupTime: '', qtyTriples: 0, qtySimples: 0, deposit: 0,
        paymentStatus: PaymentStatus.UNPAID, pickupBranch: PickupBranch.CENTRAL, id: '', customerName: '',
        address: '', phone: '', notes: ''
    });
    setDepositInput('0');
  };

  const handleDeleteOrder = async () => {
    if (!originalId) return;
    if (!window.confirm(`¿Estás seguro de ELIMINAR permanentemente la comanda #${originalId}?`)) return;
    
    setIsSaving(true);
    try {
      await deleteOrder(originalId);
      setMessage({ type: 'success', text: `Comanda #${originalId} eliminada.` });
      refreshData();
      handleCancelEdit();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.customerName || !formData.pickupTime) {
      setMessage({ type: 'error', text: 'Campos incompletos (ID, Nombre, Hora).' });
      return;
    }
    const totalSandwiches = (Number(formData.qtyTriples) || 0) + (Number(formData.qtySimples) || 0);
    if (totalSandwiches <= 0) {
      setMessage({ type: 'error', text: 'Debe cargar al menos 1 sándwich (Triple o Simple).' });
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
        originBranch: isEditing && formData.originBranch ? formData.originBranch : session.currentProductionBranch,
        status: formData.status || OrderStatus.PENDING_PRODUCTION,
        createdBy: isEditing && formData.createdBy ? formData.createdBy : session.email,
      } as Order;

      await saveOrder(newOrder, isEditing, originalId || undefined);
      setMessage({ type: 'success', text: `Guardado exitoso #${newOrder.id}` });
      refreshData();
      if (isEditing) handleCancelEdit();
      else {
        setFormData(prev => ({ ...prev, id: '', customerName: '', phone: '', address: '', notes: '', pickupTime: '', qtyTriples: 0, qtySimples: 0, deposit: 0 }));
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
    <div className="flex flex-col h-full max-w-[1250px] mx-auto space-y-2">
      {/* Header Compacto */}
      <div className="flex items-center justify-between gap-4">
        <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition-all">
          <Settings size={14} className="text-orange-600" />
          Fábrica Origen: <span className="text-orange-600 font-black">{session.currentProductionBranch}</span>
          <ChevronDown size={12} />
        </button>

        <button onClick={() => setShowSearchPanel(!showSearchPanel)} className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-xl border border-slate-200 shadow-sm text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all">
          <Search size={14} />
          {showSearchPanel ? 'Cerrar Buscador' : 'BUSCAR / EDITAR COMANDA'}
        </button>
      </div>

      {isSettingsOpen && (
        <div className="p-2 bg-orange-50 rounded-xl border border-orange-100 animate-fade-in flex gap-2">
          {PRODUCTION_BRANCHES.map(b => (
            <button key={b.value} onClick={() => handleSettingsChange(b.value)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${session.currentProductionBranch === b.value ? 'bg-orange-600 text-white shadow-md' : 'bg-white border text-slate-500 hover:bg-slate-50'}`}>
              {b.label}
            </button>
          ))}
        </div>
      )}

      {showSearchPanel && (
        <div className="bg-blue-50 p-2 rounded-2xl border border-blue-100 shadow-inner animate-fade-in">
          <form onSubmit={handleSearchForEdit} className="flex gap-2 mb-2">
            <input type="text" placeholder="Número de comanda o nombre..." className="flex-1 p-2 rounded-xl border border-blue-200 text-xs focus:ring-2 focus:ring-blue-400 outline-none font-bold shadow-sm" value={searchId} onChange={e => setSearchId(e.target.value)} />
            <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">BUSCAR</button>
          </form>
          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-[100px] overflow-y-auto custom-scrollbar">
              {searchResults.map(r => (
                <div key={r.id} className="bg-white rounded-lg p-2 border border-blue-100 flex justify-between items-center shadow-sm">
                  <div className="truncate"><span className="font-black text-slate-900 text-[11px]">#{r.id}</span> <span className="text-[9px] text-slate-500 uppercase ml-1">{r.customerName}</span></div>
                  <button onClick={() => loadOrderForEdit(r)} className="bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700"><Edit3 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Form Container - Optimizado para PC sin Scroll */}
      <div className={`bg-white rounded-[2.5rem] px-4 sm:px-8 py-6 shadow-2xl border transition-all flex-1 flex flex-col justify-center ${isEditing ? 'ring-4 ring-blue-100 border-blue-300' : 'border-slate-100'}`}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className={`p-2.5 rounded-full ${isEditing ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                {isEditing ? <Edit3 size={18} /> : <PlusCircle size={18} />}
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase">
                {isEditing ? `EDITANDO COMANDA #${originalId}` : 'NUEVA CARGA DE PEDIDO'}
            </h2>
            {isEditing && (
              <div className="ml-auto flex gap-2">
                <button 
                  type="button"
                  onClick={handleDeleteOrder} 
                  className="bg-rose-50 px-4 py-2 rounded-xl text-[9px] font-black text-rose-600 uppercase flex items-center gap-2 hover:bg-rose-100 border border-rose-100 transition-all"
                >
                  <Trash2 size={14} /> ELIMINAR COMANDA
                </button>
                <button onClick={handleCancelEdit} className="bg-slate-100 px-4 py-2 rounded-xl text-[9px] font-black text-slate-500 uppercase flex items-center gap-2 hover:bg-slate-200 transition-all">
                  <XCircle size={14} /> CANCELAR
                </button>
              </div>
            )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fila 1: Comanda, Fecha, Hora */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">1. NÚMERO DE COMANDA</label>
              <input id="comanda-id" type="text" required placeholder="Ej: 0542" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm focus:bg-white focus:border-orange-500 outline-none transition-all shadow-sm" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isSaving} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">2. FECHA DE RETIRO</label>
              <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm outline-none focus:bg-white focus:border-orange-500 transition-all shadow-sm cursor-pointer" value={formData.pickupDate} onChange={e => setFormData({...formData, pickupDate: e.target.value as any})} disabled={isSaving}>
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">3. HORA DE RETIRO</label>
              <div className="relative">
                <input type="time" required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm outline-none focus:bg-white focus:border-orange-500 transition-all shadow-sm" value={formData.pickupTime || ''} onChange={e => setFormData({...formData, pickupTime: e.target.value})} disabled={isSaving} />
                <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {QUICK_TIMES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData({ ...formData, pickupTime: t })}
                    disabled={isSaving}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black transition-all border ${formData.pickupTime === t ? 'bg-orange-600 text-white border-orange-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-orange-50 hover:text-orange-600'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Fila 2: Nombre, Dirección, Teléfono */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">4. NOMBRE COMPLETO</label>
              <input type="text" required placeholder="JUAN PÉREZ" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-black uppercase text-sm focus:bg-white focus:border-orange-500 outline-none shadow-sm" value={formData.customerName || ''} onChange={e => setFormData({...formData, customerName: e.target.value.toUpperCase()})} disabled={isSaving} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">5. DIRECCIÓN / REPARTO</label>
              <div className="relative">
                <input type="text" placeholder="Calle, Barrio, Manzana..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm focus:bg-white focus:border-orange-500 outline-none shadow-sm" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} disabled={isSaving} />
                <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">6. TELÉFONO DE CONTACTO</label>
              <div className="relative">
                <input type="tel" placeholder="3816543210" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm focus:bg-white focus:border-orange-500 outline-none shadow-sm" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} disabled={isSaving} />
                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              </div>
            </div>
          </div>

          {/* Fila 3: Sucursal, Triples, Simples */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">7. SUCURSAL DE RETIRO</label>
              <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm outline-none focus:bg-white focus:border-orange-500 shadow-sm cursor-pointer" value={formData.pickupBranch} onChange={e => setFormData({...formData, pickupBranch: e.target.value as any})} disabled={isSaving}>
                {PICKUP_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1 text-center block leading-none mb-1">8A. UNIDADES TRIPLES</label>
                <input type="number" min="0" className="w-full p-2 bg-blue-50/40 border border-blue-100 rounded-2xl font-black text-2xl text-center text-blue-800 outline-none focus:bg-white focus:border-blue-500 shadow-inner" value={formData.qtyTriples || ''} onChange={e => setFormData({...formData, qtyTriples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} onWheel={(e) => e.currentTarget.blur()} disabled={isSaving} />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-1 text-center block leading-none mb-1">8B. UNIDADES SIMPLES</label>
                <input type="number" min="0" className="w-full p-2 bg-orange-50/40 border border-orange-100 rounded-2xl font-black text-2xl text-center text-orange-800 outline-none focus:bg-white focus:border-orange-500 shadow-inner" value={formData.qtySimples || ''} onChange={e => setFormData({...formData, qtySimples: parseInt(e.target.value) || 0})} onFocus={e => e.target.select()} onWheel={(e) => e.currentTarget.blur()} disabled={isSaving} />
            </div>
          </div>

          {/* Fila 4: Pago, Seña, Notas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">9. ESTADO DE PAGO</label>
                <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm focus:bg-white focus:border-orange-500 outline-none shadow-sm cursor-pointer" value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value as PaymentStatus})} disabled={isSaving}>
                  {PAYMENT_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-black text-green-700 uppercase tracking-widest ml-1">10. MONTO DE SEÑA ($)</label>
                <div className="relative">
                    <input type="number" min="0" className="w-full py-2.5 pr-2.5 pl-8 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm text-green-700 outline-none focus:bg-white focus:border-orange-500 shadow-sm" value={depositInput === '0' ? '' : depositInput} onChange={e => { setDepositInput(e.target.value); setFormData({...formData, deposit: parseFloat(e.target.value) || 0}); }} onWheel={(e) => e.currentTarget.blur()} disabled={isSaving} />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-black">$</span>
                </div>
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">11. OBSERVACIONES / NOTAS INTERNAS</label>
                <div className="relative">
                    <input type="text" placeholder="Ej: Sin mayonesa, Cliente habitual..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm focus:bg-white focus:border-orange-500 outline-none shadow-sm" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} disabled={isSaving} />
                    <StickyNote className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                </div>
            </div>
          </div>

          {/* Botón de Guardar Centrado y Grande */}
          <div className="pt-4 flex flex-col items-center">
             <button type="submit" disabled={isSaving} className={`w-full max-w-[600px] py-4 rounded-[1.5rem] font-black text-sm tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 ${isEditing ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100' : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200'}`}>
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {isSaving ? 'PROCESANDO...' : (isEditing ? 'GUARDAR CAMBIOS' : 'GUARDAR COMANDA')}
             </button>
             {message && (
               <div className={`mt-3 px-6 py-2 rounded-xl text-center font-black text-[10px] uppercase tracking-widest border animate-fade-in flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                 <AlertCircle size={14} /> {message.text}
               </div>
             )}
          </div>
        </form>
      </div>
    </div>
  );
};
