
import { Order, OrderStatus, UserSession, UserRole, AppUser, PaymentStatus } from '../types';
import { STORAGE_KEY_SESSION } from '../constants';
import { supabase, isSupabaseConfigured } from './client';

// --- Session (Keeps using LocalStorage for simplicity) ---
export const getSession = (): UserSession | null => {
  const stored = localStorage.getItem(STORAGE_KEY_SESSION);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem(STORAGE_KEY_SESSION);
    return null;
  }
};

export const saveSession = (session: UserSession) => {
  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY_SESSION);
};

// --- Auth & Users ---

export const updateUserActivity = async (email: string): Promise<void> => {
  if (!isSupabaseConfigured() || !email) return;
  try {
    await supabase.from('app_users')
      .update({ last_active: new Date().toISOString() })
      .ilike('email', email.trim().toLowerCase());
  } catch (e) {
    console.error("Error updating activity:", e);
  }
};

export const verifyUserRole = async (email: string): Promise<UserRole | null> => {
  if (!isSupabaseConfigured()) {
      console.warn("Supabase not configured.");
      return null;
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase
      .from('app_users')
      .select('role')
      .ilike('email', cleanEmail)
      .single();

    if (error || !data) return null;
    await updateUserActivity(cleanEmail);
    return data.role as UserRole;
  } catch (e) {
    return null;
  }
};

export const getAppUsers = async (): Promise<AppUser[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('app_users')
    .select('email, name, role, last_active')
    .order('last_active', { ascending: false, nullsFirst: false });
    
  if (error) return [];
  return (data || []).map(d => ({
    email: d.email,
    name: d.name,
    role: d.role as UserRole,
    lastActive: d.last_active
  }));
};

export const saveAppUser = async (user: AppUser): Promise<void> => {
  if (!isSupabaseConfigured()) throw new Error("No hay conexión con la base de datos.");
  
  const { error } = await supabase.from('app_users').upsert({
    email: user.email.trim().toLowerCase(),
    name: user.name,
    role: user.role
  }, { 
    onConflict: 'email' 
  });

  if (error) throw new Error(error.message);
};

export const deleteAppUser = async (email: string): Promise<void> => {
  if (!isSupabaseConfigured()) throw new Error("No DB connection");
  const { error } = await supabase.from('app_users').delete().eq('email', email);
  if (error) throw error;
};

// --- Orders ---

const mapFromDb = (row: any): Order => ({
    id: row.id,
    pickupDate: row.pickup_date,
    pickupTime: row.pickup_time || '',
    customerName: row.customer_name,
    address: row.address || '',
    phone: row.phone || '',
    pickupBranch: row.pickup_branch,
    qtyTriples: row.qty_triples,
    qtySimples: row.qty_simples,
    notes: row.notes || '',
    deposit: Number(row.deposit),
    paymentStatus: row.payment_status || PaymentStatus.UNPAID,
    originBranch: row.origin_branch,
    location: row.location,
    packageCount: row.package_count || 0,
    status: row.status as OrderStatus,
    deliveredAt: row.delivered_at,
    createdBy: row.created_by
});

const mapToDb = (order: Order) => ({
    id: order.id,
    pickup_date: order.pickupDate,
    pickup_time: order.pickupTime,
    customer_name: order.customerName,
    address: order.address,
    phone: order.phone,
    pickup_branch: order.pickupBranch,
    qty_triples: order.qtyTriples,
    qty_simples: order.qtySimples,
    notes: order.notes,
    deposit: order.deposit,
    payment_status: order.paymentStatus,
    origin_branch: order.originBranch,
    location: order.location,
    package_count: order.packageCount,
    status: order.status,
    delivered_at: order.deliveredAt,
    created_by: order.createdBy
});

/**
 * Trae todos los pedidos de una fecha.
 * Implementa paginación automática para superar el límite de 1000 registros.
 */
export const getOrders = async (dateFilter?: string): Promise<Order[]> => {
  if (!isSupabaseConfigured()) return [];
  
  let allOrders: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from('orders').select('*');
    
    if (dateFilter) {
      query = query.eq('pickup_date', dateFilter);
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      allOrders = [...allOrders, ...data];
      from += pageSize;
      // Si trajo menos de lo que pedimos, es que ya no hay más
      if (data.length < pageSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }
  
  return allOrders.map(mapFromDb);
};

export const searchOrders = async (term: string): Promise<Order[]> => {
  if (!isSupabaseConfigured()) return [];
  const safeTerm = term.replace(/[,()*\\]/g, ' ').trim();
  if (!safeTerm) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .or(`id.ilike.%${safeTerm}%,customer_name.ilike.%${safeTerm}%,phone.ilike.%${safeTerm}%,address.ilike.%${safeTerm}%`)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data || []).map(mapFromDb);
};

export const saveOrder = async (order: Order, isUpdate: boolean = false, oldId?: string): Promise<void> => {
  if (!isSupabaseConfigured()) throw new Error("Base de datos no conectada");
  const dbData = mapToDb(order);

  try {
    if (isUpdate && oldId && oldId !== order.id) {
      const { data: collision } = await supabase.from('orders').select('id').eq('id', order.id).single();
      if (collision) throw new Error(`El ID #${order.id} ya existe.`);
      const { error } = await supabase.from('orders').update(dbData).eq('id', oldId);
      if (error) throw error;
      return;
    }

    if (!isUpdate) {
      const { data: existing } = await supabase.from('orders').select('id').eq('id', order.id).single();
      if (existing) throw new Error(`La comanda #${order.id} YA EXISTE.`);
    }

    let result = await supabase.from('orders').upsert(dbData);
    if (result.error) throw result.error;
  } catch (error: any) {
    console.error('Save Error:', error);
    throw error;
  }
};

export const updateOrderLocation = async (id: string, location: string, packageCount: number, allowOverwrite: boolean = true): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  if (!allowOverwrite) {
     const { data: current } = await supabase.from('orders').select('location').eq('id', id).single();
     if (current?.location) throw new Error(`⛔ EL PEDIDO YA FUE UBICADO EN: ${current.location}`);
  }

  const { error } = await supabase.from('orders').update({ 
    location: location, 
    package_count: packageCount,
    status: OrderStatus.READY_FOR_PICKUP 
  }).eq('id', id);

  if (error) throw error;
};

export const markOrderDelivered = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('orders').update({ 
    status: OrderStatus.DELIVERED,
    delivered_at: new Date().toISOString()
  }).eq('id', id);
  if (error) throw error;
};

export const deleteOrder = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    await supabase.from('orders').delete().eq('id', id);
};

export const deleteAllOrders = async (): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    await supabase.from('orders').delete().neq('id', '0');
};
