export interface User {
  id: string; name: string; email: string; role: string; roleLabel: string; baseRole: string; phone: string;
  assignedExecutiveId: string | null; hasAvatar: boolean; active: boolean; kycVerified: boolean; permissions: string[];
}
export interface Service { id: string; name: string; description: string; icon: string; fee: number; limit: number }
export interface Payment {
  id: string; userId: string; kind: string; recipient: string; reference: string; note: string;
  beneficiaryName?: string; documentType?: string; documentNumber?: string; bankName?: string; accountType?: string; accountNumberMasked?: string; deliveryMethod?: string;
  amount: number; fee: number; tax: number; total: number; taxRate: number; taxRule: string; status: string; statusCode?: 'PENDING'|'APPROVED'|'REJECTED';
  createdAt: string; providerReference: string; reviewedAt?: string | null; reviewNote?: string | null; simulated: boolean;
}
export interface Quote { amount: number; fee: number; tax: number; taxRate: number; total: number; taxRule: string; requiresReview: boolean }
export interface Dashboard {
  balance: number; ledgerBalance: number; reserved: number; pendingTopups: number; todayVolume: number;
  completed: number; pending: number; fees: number; recent: Payment[];
}
export interface Page<T> { total: number; items: T[] }
export interface TopUp { id: string; userId: string; userName?: string; userEmail?: string; kind: string; amount: number; bank: string; reference: string; depositorName?: string; senderName?: string; transactionReference?: string; phoneNumber?: string; beneficiaryName?: string; withdrawalCode?: string | null; beneficiaryCode?: string | null; status: string; statusCode?: 'PENDING'|'APPROVED'|'REJECTED'; createdAt: string; reviewNote?: string | null }
export interface AuditEvent { id: number; actorId: string | null; action: string; resource: string; createdAt: string }
export interface RoleView { name: string; displayName: string; baseRole: string; system: boolean; permissions: string[] }
export interface RoleData { roles: RoleView[]; permissions: { code: string; description: string }[]; allowedByBase: Record<string, string[]> }
export interface PlatformSettings {
  mode: string; currency: string; timezone: string;
  fiscal: { vatRate: number; ruleVersion: string };
  limits: { daily: number; reviewFrom: number };
  integrations: { name: string; status: string }[];
}
export interface IntegrationSettings {
  mode: string; enabled: boolean; endpoint: string; hasClientId: boolean; hasApiKey: boolean; hasClientSecret: boolean; requestTemplate: string;
  scorePath: string; apiKeyHeader: string; clientIdHeader: string; secretHeader: string; contractVerified: boolean; updatedAt: string;
}

/** Credit bureau data as returned by the API (sandbox or contracted provider). */
export interface CreditData {
  simulated: boolean; disclaimer?: string; score: number; scoreRange?: string; risk?: string; subject?: string; generatedAt?: string;
  summary?: {
    directObligations?: number; indirectObligations?: number; totalDebt?: number; overdue?: number;
    activeAccounts?: number; onTimePayments?: number; inquiries12m?: number; maxDaysPastDue?: number;
  };
  delinquency?: { period: string; d30: number; d60: number; d90: number; d120: number }[];
  entities?: { institution: string; type?: string; product?: string; direct?: number; indirect?: number; overdue?: number; balance?: number; status?: string; share?: number }[];
}
export interface CreditReport {
  id: string; documentMasked: string; documentType: string; mode: string; status: string; cost: number;
  createdAt: string; completedAt?: string | null; error?: string | null; report: CreditData | null;
}
