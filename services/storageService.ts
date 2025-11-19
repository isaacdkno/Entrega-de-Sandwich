import { Order, OrderStatus, UserSession, UserRole, AppUser } from '../types';
import { STORAGE_KEY_SESSION } from '../constants';
import { supabase, isSupabaseConfigured } from './client';

// --- Session (Keeps using LocalStorage for simplicity) ---
export const getSession = (): UserSession | null => {
  const stored = localStorage.getItem(STORAGE_KEY_SESSION);
  return stored ? JSON.parse(stored) : null;
};

export const saveSession = (session: UserSession) => {
  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY_SESSION);
};

// --- Auth & Users ---

export const verifyUserRole = async (email: string): Promise<UserRole | null> => {
  if (!isSupabaseConfigured()) {
      console.warn("Supabase not configured.");
      return null;
  }

  try {
    // Trim whitespace and lowercase for consistent matching
    const cleanEmail = email.trim().toLowerCase();

    const { data, error } = await supabase
      .from('app_users')
      .select('role')
      .ilike('email', cleanEmail) // Case insensitive match
      .single();

    if (error || !data) {
      console.warn('User not authorized:', email);
      return null;
    }

    return data.role as UserRole;
  } catch (e) {
    console.error("Error verifying user:", e);
    return null;
  }
};

// User Management (CRUD)
export const getAppUsers = async (): Promise<AppUser[]> => {
  if (!isSupabaseConfigured()) return [];
  
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .order('role', { ascending: true }); // Sort by role usually puts Admin first

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  
  return data as AppUser[];
};

export const saveAppUser = async (user: AppUser): Promise<void> => {
  if (!isSupabaseConfigured()) throw new Error("No DB connection");
  
  const { error } = await supabase
    .from('app_users')
    .upsert({
      email: user.email.toLowerCase(),
      name: user.name,
      role: user.role
    }); // upsert updates if email exists

  if (error) throw error;
};

export const deleteAppUser = async (email: string): Promise<void> => {
  if (!isSupabaseConfigured()) throw new Error("No DB connection");
  
  const { error } = await supabase
    .from('app_users')
    .delete()
    .eq('email', email);
    
  if (error) throw error;
};

// --- Orders (Now using Supabase) ---

// Helper to map DB columns (snake_case) to App types (camelCase)
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
    originBranch: row.origin_branch,
    location: row.location,
    status: row.status as OrderStatus,
    deliveredAt: row.delivered_at,
    createdBy: row.created_by
});

// Helper to map App types to DB columns
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
    origin_branch: order.originBranch,
    location: order.location,
    status: order.status,
    delivered_at: order.deliveredAt,
    created_by: order.createdBy
});

export const getOrders = async (): Promise<Order[]> => {
  if (!isSupabaseConfigured()) {
      console.warn("Supabase not configured. Returning empty list.");
      return [];
  }

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }

  return (data || []).map(mapFromDb);
};

export const getOrderById = async (id: string): Promise<Order | null> => {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapFromDb(data);
};

export const searchOrders = async (term: string): Promise<Order[]> => {
  if (!isSupabaseConfigured()) return [];
  
  // Remove commas to prevent breaking the OR syntax of PostgREST
  const safeTerm = term.replace(/,/g, ' ').trim();
  if (!safeTerm) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .or(`id.eq.${safeTerm},customer_name.ilike.%${safeTerm}%,phone.ilike.%${safeTerm}%,address.ilike.%${safeTerm}%`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error searching orders:', error);
    return [];
  }

  return (data || []).map(mapFromDb);
};

export const saveOrder = async (order: Order): Promise<void> => {
  if (!isSupabaseConfigured()) throw new Error("Base de datos no conectada");

  const dbData = mapToDb(order);

  // Using upsert to handle both create and update if ID exists
  const { error } = await supabase
    .from('orders')
    .upsert(dbData);

  if (error) {
    // Graceful degradation: If pickup_time column is missing (Code 42703), retry without it
    if (error.code === '42703') {
        console.warn("Schema mismatch: 'pickup_time' column missing. Retrying save without it...");
        const { pickup_time, ...legacyData } = dbData;
        const { error: retryError } = await supabase.from('orders').upsert(legacyData);
        
        if (retryError) {
            console.error('Error saving order (retry):', retryError);
            throw new Error(retryError.message);
        }
        return;
    }

    console.error('Error saving order:', error);
    throw new Error(error.message || 'Error desconocido al guardar pedido');
  }
};

export const updateOrderLocation = async (id: string, location: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('orders')
    .update({ 
        location: location, 
        status: OrderStatus.READY_FOR_PICKUP 
    })
    .eq('id', id);

  if (error) console.error('Error updating location:', error);
};

export const markOrderDelivered = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('orders')
    .update({ 
        status: OrderStatus.DELIVERED,
        delivered_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) console.error('Error delivering order:', error);
};

export const deleteOrder = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) console.error('Error deleting order:', error);
};