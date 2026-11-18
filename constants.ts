
import { PickupBranch, ProductionBranch, PaymentStatus } from './types';

export const PICKUP_DATES = ['31/12/2026', '24/12/2026', '31/12/2025', '24/12/2025'];

export const PICKUP_BRANCHES = [
  { value: PickupBranch.CENTRAL, label: 'Central' },
  { value: PickupBranch.BUENOS_AIRES, label: 'Buenos Aires' },
  { value: PickupBranch.ACONQUIJA, label: 'Aconquija' },
  { value: PickupBranch.OPEN_PLAZA, label: 'Open Plaza' },
  { value: PickupBranch.REPARTO, label: 'Reparto' },
];

export const PRODUCTION_BRANCHES = [
  { value: ProductionBranch.CENTRAL, label: 'Fabrica Central' },
  { value: ProductionBranch.ACONQUIJA, label: 'Fabrica Aconquija' },
];

export const PAYMENT_STATUS_OPTIONS = [
  { value: PaymentStatus.UNPAID, label: '🔴 Falta Abonar' },
  { value: PaymentStatus.PARTIAL, label: '🟡 Con Seña' },
  { value: PaymentStatus.PAID, label: '🟢 Pagado Total' },
];

export const STORAGE_KEY_ORDERS = 'sandwich_orders_v1';
export const STORAGE_KEY_SESSION = 'sandwich_session_v1';
