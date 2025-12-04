export interface Event {
  id: string;
  title: string;
  date: string;
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
  description: string;
  type: "income" | "expense";
  amount: string;
  category: string;
  createdAt?: string;
}

export interface Bank {
  id: string;
  name: string;
  balance: string;
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
