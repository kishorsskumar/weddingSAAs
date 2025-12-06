export interface Event {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  type: "wedding" | "corporate" | "birthday" | "other";
  planner: string;
  customer: string;
  venue: string;
  salesValue: string;
  paymentReceived: string;
  cost: string;
  createdAt?: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  attendees: string | null;
  createdAt?: string;
}

export interface Employee {
  id: string;
  name: string;
  employeeId: string;
  joinDate: string;
  designation: string;
  salary: string;
  address: string;
  emergencyContact: string;
  leaveDate?: string | null;
  createdAt?: string;
}

export interface DaybookEntry {
  id: string;
  date: string;
  description?: string | null;
  type: "income" | "expense";
  amount: string;
  category: string;
  bankId?: string | null;
  eventId?: string | null;
  eventName?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  createdAt?: string;
}

export interface DaybookCategory {
  id: string;
  name: string;
  type: "income" | "expense";
  isSystem: boolean;
  createdAt?: string;
}

export interface Vendor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  gstNumber?: string | null;
  category?: string | null;
  billingAddress?: string | null;
  createdAt?: string;
}

export interface Bank {
  id: string;
  name: string;
  openingBalance: string;
  balance: string;
  createdAt?: string;
}

export interface BankTransfer {
  id: string;
  date: string;
  fromBankId: string;
  toBankId: string;
  amount: string;
  description?: string | null;
  createdAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  allowedPages?: string[];
}

export interface EventMilestone {
  id: string;
  eventId: string;
  phase: number;
  phaseName: string;
  name: string;
  date: string;
  time?: string | null;
  status: 'pending' | 'completed';
  createdAt?: string;
}
