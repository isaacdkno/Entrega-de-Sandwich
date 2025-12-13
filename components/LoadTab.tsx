import React, { useState } from 'react';
import { UserSession, Order, PickupBranch, OrderStatus, ProductionBranch, UserRole, PaymentStatus } from '../types';
import { PICKUP_DATES, PICKUP_BRANCHES, PRODUCTION_BRANCHES, PAYMENT_STATUS_OPTIONS } from '../constants';
import { saveOrder, deleteOrder, searchOrders } from '../services/storageService';
import { Save, Settings, Loader2, Search, Trash2, XCircle, Edit3, ChevronDown, ChevronUp } from 'lucide-react';

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
  
  // Local state to handle decimal input correctly (prevents "10." -> "10" glitch)
  const [depositInput, setDepositInput] = useState('0');

  const [formData, setFormData] = useState<Partial<Order>>({
    pickupDate: '24/12/2025',
    pickupTime: '',
    qtyTriples: 0,
    qtySimples: 0,
    deposit: 0,
    paymentStatus: PaymentStatus.UNPAID,
    pickupBranch: PickupBranch.CENTRAL,
  });
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleSettingsChange = (branch: ProductionBranch) => {
    const newSession = { ...session, currentProductionBranch: branch };
    onSessionUpdate(newSession);
    setIsSettingsOpen(false);
  };

  // Prevent Enter key from submitting the form accidentally
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const handleSearchForEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId) return;
    
    setIsSearching(true);
    setMessage(null);
    setSearchResults([]);
    
    try {
      const results = await searchOrders(searchId);
      
      if (results.length === 0) {
        setMessage({ type: 'error', text: 'No se encontraron pedidos.' });
      } else if (results.length === 1) {
        loadOrderForEdit(results[0]);
      } else {
        // Multiple results
        setSearchResults(results);
        setMessage({ type: 'success', text: `Se encontraron ${results.length} pedidos. Seleccione uno.` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al buscar comanda.' });
    } finally {
      setIsSearching(false);
    }
  };

  const loadOrderForEdit = (order: Order) => {
    setFormData(order);
    setDepositInput(order.deposit.toString()); // Sync deposit input
    setIsEditing(true);
    setSearchResults([]); // Clear list
    setMessage({ type: 'success', text: `Pedido #${order.id} cargado para edición.` });
    // Scroll to form
    window.scrollTo({ top: 200, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSearchId('');
    setSearchResults([]);
    setFormData({
        pickupDate: '24/12/2025',
        pickupTime: '',
        qtyTriples: 0,
        qtySimples: 0,
        deposit: 0,
        paymentStatus: PaymentStatus.UNPAID,
        pickupBranch: PickupBranch.CENTRAL,
        id: '',
        customerName: '',
        address: '',
        phone: '',
        notes: ''
    });
    setDepositInput('0'); // Reset deposit input
    setMessage(null);
  };

  const handleDelete = async () => {
    if (!formData.id) return;
    if (!confirm(`¿Está seguro que desea ELIMINAR la comanda #${formData.id}? Esta acción no se puede deshacer.`)) return;

    setIsSaving(true);
    try {
        await deleteOrder(formData.id);
        setMessage({ type: 'success', text: 'Comanda eliminada correctamente.' });
        refreshData();
        handleCancelEdit();
    } catch (e) {
        setMessage({ type: 'error', text: 'Error al eliminar comanda.' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.customerName) {
      setMessage({ type: 'error', text: 'Faltan datos obligatorios (Número o Nombre)' });
      return;
    }

    if (!formData.pickupTime) {
        setMessage({ type: 'error', text: 'El Horario de retiro es obligatorio.' });
        return;
    }

    setIsSaving(true);
    setMessage(null);

    // If editing, preserve existing status and location unless explicitly handled logic changes
    const status = isEditing && formData.status ? formData.status : OrderStatus.PENDING_PRODUCTION;
    const location = isEditing ? formData.location || null : null;
    const deliveredAt = isEditing ? formData.deliveredAt || null : null;

    const newOrder: Order = {
      id: formData.id!,
      pickupDate: formData.pickupDate as any,
      pickupTime: formData.pickupTime || '',
      customerName: formData.customerName!,
      address: formData.address || '',
      phone: formData.phone || '',
      pickupBranch: formData.pickupBranch as PickupBranch,
      qtyTriples: Number(formData.qtyTriples),
      qtySimples: Number(formData.qtySimples),
      notes: formData.notes || '',
      deposit: parseFloat(depositInput) || 0, // Use the robust input value
      paymentStatus: formData.paymentStatus || PaymentStatus.UNPAID,
      originBranch: session.currentProductionBranch,
      location: location,
      packageCount: formData.packageCount || 0,
      status: status,
      deliveredAt: deliveredAt,
      createdBy: session.email,
    };

    try {
      // Pass isEditing flag to prevent duplicates on creation
      await saveOrder(newOrder, isEditing);
      const action = isEditing ? 'actualizada' : 'guardada';
      setMessage({ type: 'success', text: `Comanda #${newOrder.id} ${action} exitosamente.` });
      
      // AUTO-HIDE SUCCESS MESSAGE AFTER 3 SECONDS
      setTimeout(() => {
        setMessage(null);
      }, 3000);

      refreshData(); 
      
      if (isEditing) {
          setTimeout(() => handleCancelEdit(), 1500);
      } else {
        // Reset basic fields, keep date and branch
        setFormData(prev => ({
            ...prev,
            id: '',
            customerName: '',
            pickupTime: '', 
            address: '',
            phone: '',
            qtyTriples: 0,
            qtySimples: 0,
            notes: '',
            deposit: 0,
            paymentStatus: PaymentStatus.UNPAID
        }));
        setDepositInput('0'); // Reset deposit input
        // Focus back on ID for rapid entry
        document.getElementById('comanda-id')?.focus();
      }
    } catch (e: any) {
      console.error(e);
      const errorText = e.message || JSON.stringify(e);
      let friendlyMsg = 'Error desconocido';
      
      // Custom handling for duplicates
      if (errorText.includes('YA EXISTE')) friendlyMsg = errorText;
      else if (errorText.includes('duplicate key')) friendlyMsg = 'El número de comanda ya existe. Use Buscar/Editar.';
      else if (errorText.includes('network')) friendlyMsg = 'Error de conexión.';
      else friendlyMsg = errorText;

      setMessage({ type: 'error', text: `Error: ${friendlyMsg}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 pb-20">
      
      {/* Header Section: Branch Status & Tools */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        
        {/* Current Branch Indicator */}
        <div className="flex items-center gap-3 bg-white p-2 pr-4 rounded-full shadow-sm border border-slate-200">
            <div className="bg-orange-100 p-2 rounded-full">
                <Settings className="text-orange-600" size={18} />
            </div>
            <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide leading-none">Cargando desde</p>
                <button 
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="font-bold text-slate-800 flex items-center gap-1 hover:text-orange-600"
                >
                    {session.currentProductionBranch}
                    <ChevronDown size={14} />
                </button>
            </div>
        </div>

        {/* Search Toggle Button */}
        <button 
            onClick={() => setShowSearchPanel(!showSearchPanel)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all shadow-sm ${
                showSearchPanel 
                ? 'bg-blue-600 text-white ring-2 ring-blue-300' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
        >
            {showSearchPanel ? <ChevronUp size={16} /> : <Search size={16} />}
            {showSearchPanel ? 'Ocultar Búsqueda' : 'Buscar / Editar'}
        </button>
      </div>

      {/* Settings Dropdown Panel */}
      {isSettingsOpen && (
          <div className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-200 animate-fade-in">
              <h3 className="font-bold text-orange-800 mb-3 text-sm">Seleccione Fábrica de Origen:</h3>
              <div className="flex flex-wrap gap-2">
                  {PRODUCTION_BRANCHES.map(b => (
                  <button
                      key={b.value}
                      onClick={() => handleSettingsChange(b.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          session.currentProductionBranch === b.value 
                          ? 'bg-orange-600 text-white shadow-md' 
                          : 'bg-white text-slate-600 hover:bg-orange-100 border border-orange-100'
                      }`}
                  >
                      {b.label}
                  </button>
                  ))}
              </div>
          </div>
      )}

      {/* BLUE PANEL: Search & Edit Area (Conditionally Rendered) */}
      {showSearchPanel && (
        <div className="mb-8 bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-inner animate-fade-in">
            <div className="flex items-center gap-2 mb-4 text-blue-800">
                <Edit3 size={20} />
                <h3 className="font-bold">Buscar Comanda para Editar o Eliminar</h3>
            </div>
            
            <div className="flex flex-col gap-2">
                <form onSubmit={handleSearchForEdit} className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Ingrese Nombre, N° Comanda o Teléfono..." 
                        className="flex-1 p-3 rounded-lg border border-blue-200 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                        value={searchId}
                        onChange={e => setSearchId(e.target.value)}
                        autoFocus
                    />
                    <button 
                        type="submit"
                        disabled={isSearching} 
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-bold shadow-sm disabled:opacity-70"
                    >
                        {isSearching ? <Loader2 className="animate-spin" size={20}/> : <Search size={20} />}
                    </button>
                </form>

                {/* Results List */}
                {searchResults.length > 0 && (
                    <div className="mt-2 bg-white border border-blue-200 rounded-lg max-h-60 overflow-y-auto shadow-lg">
                        {searchResults.map(r => (
                            <div 
                                key={r.id}
                                onClick={() => loadOrderForEdit(r)}
                                className="p-3 border-b border-slate-100 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
                            >
                                <div>
                                    <span className="font-bold text-blue-700 mr-2">#{r.id}</span>
                                    <span className="font-medium text-slate-800">{r.customerName}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-500">{r.pickupDate}</div>
                                    <div className="text-xs font-bold text-slate-400">{r.pickupBranch}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* ORANGE PANEL: Main Form (Create or Edit) */}
      <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors relative ${isEditing ? 'border-blue-400 ring-4 ring-blue-50' : 'border-slate-100'}`}>
        
        {/* Edit Mode Banner */}
        {isEditing && (
            <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white text-xs font-bold uppercase tracking-widest text-center py-1 rounded-t-xl">
                Modo Edición Activo
            </div>
        )}

        <div className="flex justify-between items-center mb-6 mt-2">
             <h2 className={`text-xl font-bold ${isEditing ? 'text-blue-700' : 'text-slate-800'}`}>
                 {isEditing ? `Editando Comanda #${formData.id}` : 'Nueva Comanda'}
             </h2>
             {isEditing && (
                 <button 
                    onClick={handleCancelEdit}
                    className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-200 flex items-center gap-1"
                 >
                     <XCircle size={14} /> Cancelar Edición
                 </button>
             )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label className="label block text-xs font-bold text-slate-500 uppercase mb-1">Número Comanda *</label>
                <input
                id="comanda-id"
                type="text"
                required
                className="input-field w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none font-mono font-bold text-lg"
                value={formData.id || ''}
                onChange={e => setFormData({...formData, id: e.target.value})}
                onKeyDown={handleKeyDown}
                placeholder="Ej: 1054"
                disabled={isSaving || isEditing} 
                />
            </div>
            <div>
                <label className="label block text-xs font-bold text-slate-500 uppercase mb-1">Día de Retiro</label>
                <select
                className="input-field w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                value={formData.pickupDate}
                onChange={e => setFormData({...formData, pickupDate: e.target.value as any})}
                disabled={isSaving}
                >
                {PICKUP_DATES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
            </div>
            <div>
                <label className="label block text-xs font-bold text-slate-500 uppercase mb-1">Horario *</label>
                <input
                type="time"
                required
                className="input-field w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                value={formData.pickupTime || ''}
                onChange={e => setFormData({...formData, pickupTime: e.target.value})}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                />
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
                <label className="label block text-xs font-bold text-slate-500 uppercase mb-1">Nombre y Apellido *</label>
                <input
                type="text"
                required
                className="input-field w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none uppercase"
                value={formData.customerName || ''}
                onChange={e => setFormData({...formData, customerName: e.target.value.toUpperCase()})}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                />
            </div>
            <div>
                <label className="label block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono</label>
                <input
                type="tel"
                className="input-field w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                value={formData.phone || ''}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                />
            </div>
            <div>
                <label className="label block text-xs font-bold text-slate-500 uppercase mb-1">Sucursal Retiro</label>
                <select
                    className="input-field w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                    value={formData.pickupBranch}
                    onChange={e => setFormData({...formData, pickupBranch: e.target.value as any})}
                    disabled={isSaving}
                >
                {PICKUP_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
            </div>
            <div className="md:col-span-2">
                <label className="label block text-xs font-bold text-slate-500 uppercase mb-1">Dirección</label>
                <input
                type="text"
                className="input-field w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                value={formData.address || ''}
                onChange={e => setFormData({...formData, address: e.target.value})}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                />
            </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase">Detalle del Pedido</h4>
            <div className="grid grid-cols-2 gap-6">
                <div>
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1 text-center">Triples</label>
                <input
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full p-3 text-2xl font-black text-slate-800 border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-orange-500 outline-none"
                    value={formData.qtyTriples || ''}
                    onChange={e => setFormData({...formData, qtyTriples: parseInt(e.target.value) || 0})}
                    onKeyDown={handleKeyDown}
                    disabled={isSaving}
                    onFocus={e => e.target.select()}
                    onClick={e => e.currentTarget.select()}
                    onWheel={(e) => e.currentTarget.blur()}
                />
                </div>
                <div>
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1 text-center">Simples</label>
                <input
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full p-3 text-2xl font-black text-slate-800 border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-orange-500 outline-none"
                    value={formData.qtySimples || ''}
                    onChange={e => setFormData({...formData, qtySimples: parseInt(e.target.value) || 0})}
                    onKeyDown={handleKeyDown}
                    disabled={isSaving}
                    onFocus={e => e.target.select()}
                    onClick={e => e.currentTarget.select()}
                    onWheel={(e) => e.currentTarget.blur()}
                />
                </div>
            </div>
            </div>

            <div>
            <label className="label block text-xs font-bold text-slate-500 uppercase mb-1">Observaciones</label>
            <textarea
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                rows={2}
                value={formData.notes || ''}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                disabled={isSaving}
            />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="label block text-xs font-bold text-slate-500 uppercase mb-1">Estado Pago</label>
                    <select
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none font-bold"
                        value={formData.paymentStatus}
                        onChange={e => setFormData({...formData, paymentStatus: e.target.value as PaymentStatus})}
                        disabled={isSaving}
                    >
                        {PAYMENT_STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="label block text-xs font-bold text-slate-500 uppercase mb-1">Seña Abonada ($)</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none font-bold text-lg text-green-700"
                        value={depositInput === '0' ? '' : depositInput}
                        onChange={e => {
                            const val = e.target.value;
                            setDepositInput(val);
                            setFormData({...formData, deposit: val === '' ? 0 : parseFloat(val)});
                        }}
                        onKeyDown={handleKeyDown}
                        disabled={isSaving}
                        onFocus={e => e.target.select()}
                        onClick={e => e.currentTarget.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                    />
                </div>
            </div>

            <div className="pt-2 flex gap-3">
                {isEditing && session.role === UserRole.ADMIN && (
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isSaving}
                        className="flex-1 py-4 rounded-xl font-bold text-lg shadow-sm transition-all flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                    >
                        <Trash2 size={20} />
                        Eliminar
                    </button>
                )}
                <button
                type="submit"
                disabled={isSaving}
                className={`flex-[2] py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${
                    isSaving 
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                    : isEditing 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-orange-600 hover:bg-orange-700 text-white active:scale-95'
                }`}
                >
                {isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                {isSaving ? 'Procesando...' : (isEditing ? 'Actualizar Comanda' : 'Guardar Comanda')}
                </button>
            </div>

            {message && (
            <div className={`p-4 rounded-xl text-center font-bold border animate-fade-in ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {message.text}
            </div>
            )}
        </form>
      </div>
    </div>
  );
};