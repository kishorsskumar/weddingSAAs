import { db } from "./db";
import { users, userPermissions, events, meetings, employees, daybookEntries, banks } from "@shared/schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create demo users
  const hashedPassword = await bcrypt.hash("demo123", 10);
  
  const [admin] = await db.insert(users).values({
    name: "Admin User",
    email: "admin@oakevent.com",
    password: hashedPassword,
    role: "admin",
    avatar: "https://i.pravatar.cc/150?u=admin",
  }).returning();

  const [manager] = await db.insert(users).values({
    name: "Event Manager",
    email: "manager@oakevent.com",
    password: hashedPassword,
    role: "manager",
    avatar: "https://i.pravatar.cc/150?u=manager",
  }).returning();

  const [employee] = await db.insert(users).values({
    name: "Accountant",
    email: "finance@oakevent.com",
    password: hashedPassword,
    role: "employee",
    avatar: "https://i.pravatar.cc/150?u=finance",
  }).returning();

  // Set permissions
  const allPages = ["dashboard", "event-calendar", "team-calendar", "event-database", "daybook", "hr", "admin"];
  
  await db.insert(userPermissions).values(
    allPages.map(pageId => ({ userId: admin.id, pageId }))
  );

  await db.insert(userPermissions).values([
    { userId: manager.id, pageId: "dashboard" },
    { userId: manager.id, pageId: "event-calendar" },
    { userId: manager.id, pageId: "event-database" },
    { userId: manager.id, pageId: "team-calendar" },
  ]);

  await db.insert(userPermissions).values([
    { userId: employee.id, pageId: "dashboard" },
    { userId: employee.id, pageId: "daybook" },
  ]);

  // Create sample events
  await db.insert(events).values([
    {
      title: "Sharma Wedding",
      date: "2025-05-15",
      type: "wedding",
      planner: "Sarah Jenkins",
      customer: "Rahul Sharma",
      venue: "Grand Oak Hall",
      salesValue: "500000",
      paymentReceived: "200000",
      cost: "350000",
    },
    {
      title: "Tech Corp Annual Meet",
      date: "2025-05-20",
      type: "corporate",
      planner: "Mike Ross",
      customer: "Tech Corp",
      venue: "Oak Conference Center",
      salesValue: "150000",
      paymentReceived: "150000",
      cost: "80000",
    },
    {
      title: "Birthday Bash",
      date: "2025-06-10",
      type: "birthday",
      planner: "Sarah Jenkins",
      customer: "Priya Singh",
      venue: "Oak Garden",
      salesValue: "50000",
      paymentReceived: "10000",
      cost: "25000",
    },
  ]);

  // Create sample meetings
  const today = new Date().toISOString().split('T')[0];
  await db.insert(meetings).values([
    {
      title: "Team Sync",
      date: today,
      time: "09:00",
      attendees: "All Staff",
    },
    {
      title: "Client Call - Sharma",
      date: today,
      time: "14:30",
      attendees: "Sarah, Mike",
    },
  ]);

  // Create sample employees
  await db.insert(employees).values([
    {
      name: "John Doe",
      employeeId: "OAK001",
      joinDate: "2023-01-15",
      designation: "Senior Planner",
      salary: "45000",
      address: "123 Main Street",
      emergencyContact: "9876543210",
    },
    {
      name: "Jane Smith",
      employeeId: "OAK002",
      joinDate: "2023-03-01",
      designation: "Operations Manager",
      salary: "55000",
      address: "456 Palm Ave, Mumbai",
      emergencyContact: "9876543211",
    },
  ]);

  // Create sample daybook entries
  await db.insert(daybookEntries).values([
    {
      date: "2025-05-01",
      description: "Office Rent",
      type: "expense",
      amount: "25000",
      category: "Rent",
    },
    {
      date: "2025-05-02",
      description: "Advance - Sharma Wedding",
      type: "income",
      amount: "50000",
      category: "Sales",
    },
  ]);

  // Create sample banks
  await db.insert(banks).values([
    { name: "HDFC Bank", balance: "1500000" },
    { name: "SBI", balance: "450000" },
    { name: "Cash in Hand", balance: "25000" },
  ]);

  console.log("✅ Database seeded successfully!");
  console.log("\n📝 Demo accounts:");
  console.log("Admin: admin@oakevent.com / demo123");
  console.log("Manager: manager@oakevent.com / demo123");
  console.log("Employee: finance@oakevent.com / demo123");
  
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
