export enum PickupBranch {
  CENTRAL = 'Central',
  BUENOS_AIRES = 'Buenos Aires',
  ACONQUIJA = 'Aconquija',
  OPEN_PLAZA = 'Open Plaza',
  REPARTO = 'Reparto',
}

export enum ProductionBranch {
  CENTRAL = 'Central',
  ACONQUIJA = 'Aconquija',
}

export enum OrderStatus {
  PENDING_PRODUCTION = 'Pendiente Elaboración', // Loaded but no location
  READY_FOR_PICKUP = 'Listo para Retirar', // Has location
  DELIVERED = 'Entregado', // Delivered to customer
}

export enum UserRole {
  ADMIN = 'Administrador',
  CARGADOR = 'Cargador',
  UBICADOR = 'Ubicador',
  ENTREGADOR = 'Entregador'
}

export interface AppUser {
  email: string;
  role: UserRole;
  name: string;
}

export interface Order {
  id: string; // Comanda number (manual)
  pickupDate: '24/12/2025' | '31/12/2025';
  pickupTime: string; // HH:MM
  customerName: string;
  address: string;
  phone: string;
  pickupBranch: PickupBranch;
  qtyTriples: number;
  qtySimples: number;
  notes: string;
  deposit: number; // Seña
  
  // Process fields
  originBranch: ProductionBranch; // Where it was loaded
  location: string | null; // e.g., H3a. Null implies not elaborated yet.
  status: OrderStatus;
  deliveredAt: string | null; // ISO Date string
  createdBy: string; // Email of user
}

export interface UserSession {
  email: string;
  role: UserRole;
  currentProductionBranch: ProductionBranch;
}