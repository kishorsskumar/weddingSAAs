export type Role = "admin" | "manager" | "employee";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  allowedPages: string[]; // IDs of pages they can access
}

export const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard", path: "/" },
  { id: "event-calendar", label: "Oak Event Calendar", path: "/events" },
  { id: "team-calendar", label: "Oak Team Calendar", path: "/team" },
  { id: "event-database", label: "Oak Event Database", path: "/database" },
  { id: "daybook", label: "Oak Daybook", path: "/daybook" },
  { id: "hr", label: "Oak HR", path: "/hr" },
  { id: "admin", label: "Admin Panel", path: "/admin" },
];

export const MOCK_USERS: User[] = [
  {
    id: "1",
    name: "Admin User",
    email: "admin@oakevent.com",
    role: "admin",
    avatar: "https://i.pravatar.cc/150?u=admin",
    allowedPages: ALL_PAGES.map((p) => p.id),
  },
  {
    id: "2",
    name: "Event Manager",
    email: "manager@oakevent.com",
    role: "manager",
    avatar: "https://i.pravatar.cc/150?u=manager",
    allowedPages: ["dashboard", "event-calendar", "event-database", "team-calendar"],
  },
  {
    id: "3",
    name: "Accountant",
    email: "finance@oakevent.com",
    role: "employee",
    avatar: "https://i.pravatar.cc/150?u=finance",
    allowedPages: ["dashboard", "daybook"],
  },
];

export interface Event {
  id: string;
  title: string;
  date: string; // ISO date string
  type: "wedding" | "corporate" | "birthday" | "other";
  planner: string;
  customer: string;
  venue: string;
  salesValue: number;
  paymentReceived: number;
  cost: number;
}

export const MOCK_EVENTS: Event[] = [
  {
    id: "e1",
    title: "Sharma Wedding",
    date: "2025-05-15",
    type: "wedding",
    planner: "Sarah Jenkins",
    customer: "Rahul Sharma",
    venue: "Grand Oak Hall",
    salesValue: 500000,
    paymentReceived: 200000,
    cost: 350000,
  },
  {
    id: "e2",
    title: "Tech Corp Annual Meet",
    date: "2025-05-20",
    type: "corporate",
    planner: "Mike Ross",
    customer: "Tech Corp",
    venue: "Oak Conference Center",
    salesValue: 150000,
    paymentReceived: 150000,
    cost: 80000,
  },
  {
    id: "e3",
    title: "Birthday Bash",
    date: "2025-06-10",
    type: "birthday",
    planner: "Sarah Jenkins",
    customer: "Priya Singh",
    venue: "Oak Garden",
    salesValue: 50000,
    paymentReceived: 10000,
    cost: 25000,
  },
];

export interface Employee {
  id: string;
  name: string;
  employeeId: string;
  joinDate: string;
  designation: string;
  salary: number;
  address: string;
  emergencyContact: string;
  leaveDate?: string;
}

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: "emp1",
    name: "John Doe",
    employeeId: "OAK001",
    joinDate: "2023-01-15",
    designation: "Senior Planner",
    salary: 45000,
    address: "123 Oak Street, Mumbai",
    emergencyContact: "9876543210",
  },
  {
    id: "emp2",
    name: "Jane Smith",
    employeeId: "OAK002",
    joinDate: "2023-03-01",
    designation: "Operations Manager",
    salary: 55000,
    address: "456 Palm Ave, Mumbai",
    emergencyContact: "9876543211",
  },
];

export interface DaybookEntry {
  id: string;
  date: string;
  description: string;
  type: "income" | "expense";
  amount: number;
  category: string;
}

export const MOCK_DAYBOOK: DaybookEntry[] = [
  {
    id: "d1",
    date: "2025-05-01",
    description: "Office Rent",
    type: "expense",
    amount: 25000,
    category: "Rent",
  },
  {
    id: "d2",
    date: "2025-05-02",
    description: "Advance - Sharma Wedding",
    type: "income",
    amount: 50000,
    category: "Sales",
  },
];
