
import { Order, OrderStatus, UserSession, UserRole, AppUser, PaymentStatus } from '../types';
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
    paymentStatus: row.payment_status || PaymentStatus.UNPAID,
    originBranch: row.origin_branch,
    location: row.location,
    packageCount: row.package_count || 0,
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
    payment_status: order.paymentStatus,
    origin_branch: order.originBranch,
    location: order.location,
    package_count: order.packageCount,
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

// Modified to accept an isUpdate flag to prevent accidental overwrites
// NEW: Accepts oldId to handle ID renaming
export const saveOrder = async (order: Order, isUpdate: boolean = false, oldId?: string): Promise<void> => {
  if (!isSupabaseConfigured()) throw new Error("Base de datos no conectada");

  const dbData = mapToDb(order);

  // CASE 1: Updating an existing order AND the ID has changed (Rename)
  if (isUpdate && oldId && oldId !== order.id) {
     // Check if the NEW ID already exists (collision check)
     const { data: collision } = await supabase
        .from('orders')
        .select('id')
        .eq('id', order.id)
        .single();
     
     if (collision) {
         throw new Error(`No se puede cambiar el ID a #${order.id} porque ya existe otra comanda con ese número.`);
     }

     // Perform the update on the OLD ID row
     const { error } = await supabase
        .from('orders')
        .update(dbData)
        .eq('id', oldId);
    
     if (error) throw new Error(error.message);
     return;
  }

  // CASE 2: Creating a new order
  if (!isUpdate) {
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('id', order.id)
      .single();
      
    if (existing) {
      throw new Error(`La comanda número #${order.id} YA EXISTE. No se puede sobrescribir. Use la opción de Buscar/Editar.`);
    }
  }

  // CASE 3: Standard Update (Same ID) or Insert New
  const { error } = await supabase
    .from('orders')
    .upsert(dbData);

  if (error) {
    // Graceful degradation checks...
    const missingCols = ['pickup_time', 'payment_status', 'package_count'];
    for (const col of missingCols) {
        if (error.code === '42703' || (error.message && error.message.includes(col))) {
            console.warn(`Schema mismatch: '${col}' column missing. Retrying save without it...`);
            delete (dbData as any)[col];
            const { error: retryError } = await supabase.from('orders').upsert(dbData);
            if (retryError) throw new Error(retryError.message);
            return;
        }
    }

    console.error('Error saving order:', error);
    throw new Error(error.message || 'Error desconocido al guardar pedido');
  }
};

// Updated: 'allowOverwrite' defaults to true for backward compatibility with other calls.
// Pass false when you want to ensure the location is currently empty.
export const updateOrderLocation = async (id: string, location: string, packageCount: number, allowOverwrite: boolean = true): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  // 1. Concurrency Check: If overwrite is NOT allowed, check DB first
  if (!allowOverwrite) {
     const { data: current, error } = await supabase
        .from('orders')
        .select('location')
        .eq('id', id)
        .single();

     if (!error && current && current.location) {
         // It has a location, so we block the update
         throw new Error(`⛔ EL PEDIDO YA FUE UBICADO.\n\nUbicación actual: ${current.location}\n\nSi necesitas cambiarla, usa el modo "Editar / Corregir".`);
     }
  }

  // 2. Perform Update
  const { error } = await supabase
    .from('orders')
    .update({ 
        location: location, 
        package_count: packageCount,
        status: OrderStatus.READY_FOR_PICKUP 
    })
    .eq('id', id);

  if (error) {
      // Backward compatibility if column doesn't exist yet
      if (error.message && error.message.includes('package_count')) {
          await supabase
            .from('orders')
            .update({ 
                location: location, 
                status: OrderStatus.READY_FOR_PICKUP 
            })
            .eq('id', id);
      } else {
          console.error('Error updating location:', error);
          throw new Error('Error de base de datos al guardar ubicación.');
      }
  }
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

export const deleteAllOrders = async (): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    // Delete all rows from orders table
    const { error } = await supabase.from('orders').delete().neq('id', '0'); // Hack to delete all where ID is not 0 (basically all)
    if (error) throw error;
};
