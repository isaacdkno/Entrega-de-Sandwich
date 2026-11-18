
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
  IN_SEARCH = 'En Búsqueda', // Ticket printed, runner fetching order
  DELIVERED = 'Entregado', // Delivered to customer
}

export enum PaymentStatus {
  PAID = 'Pagado',
  PARTIAL = 'Con Seña',
  UNPAID = 'Falta Abonar'
}

export enum UserRole {
  ADMIN = 'Administrador',
  CARGADOR = 'Cargador',
  UBICADOR = 'Ubicador',
  ENTREGADOR = 'Entregador',
  LOCATOR_DELIVERER = 'Entregador/Ubicador', // Nuevo Rol Híbrido
  OPERATOR = 'Operador'
}

export interface AppUser {
  email: string;
  role: UserRole;
  name: string;
  lastActive?: string; // ISO Date string
}

export interface Order {
  id: string; // Comanda number (manual)
  pickupDate: string;
  pickupTime: string; // HH:MM
  customerName: string;
  address: string;
  phone: string;
  pickupBranch: PickupBranch;
  qtyTriples: number;
  qtySimples: number;
  notes: string;
  deposit: number; // Seña
  paymentStatus: PaymentStatus;
  
  // Process fields
  originBranch: ProductionBranch; // Where it was loaded
  location: string | null; // e.g., H3a. Null implies not elaborated yet.
  packageCount: number; // Number of packages/bags
  status: OrderStatus;
  deliveredAt: string | null; // ISO Date string
  createdBy: string; // Email of user
}

export interface UserSession {
  email: string;
  role: UserRole;
  currentProductionBranch: ProductionBranch;
}
