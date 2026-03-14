import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/schema";
import { 
  menuItems, 
  hotelRooms, 
  bookings,
  medicalAppointments, 
  legalCases, 
  shipments, 
  customersExtended,
} from "../../drizzle/schema-industries";
import { tenants, prospects, users } from "../../drizzle/schema";
import { orders } from "../../drizzle/schema-additions";

const connectionString = process.env['DATABASE_URL'] || "postgresql://servicall_user:servicall_password@localhost:5432/servicall_crm";
const client = postgres(connectionString);
import * as industrySchema from "../../drizzle/schema-industries";
const db = drizzle(client, { schema: { ...schema, ...industrySchema } });

async function main() {
  logger.info("🌱 Seeding industry data with normalized schema...");

  // 1. Get or Create a Tenant
  let [tenant] = await db.select().from(tenants).limit(1);
  if (!tenant) {
    const [newTenant] = await db.insert(tenants).values({
      name: "Demo Industry Tenant",
      slug: "demo-industry",
    }).returning();
    tenant = newTenant;
  }
  const tenantId = tenant!.id;

  // 2. Get or Create a User (Doctor/Agent)
  let [user] = await db.select().from(users).limit(1);
  if (!user) {
    const [newUser] = await db.insert(users).values({
      name: "Dr. Martin",
      email: "dr.martin@example.com",
      openId: "demo-doctor-id",
      role: "agent",
    }).returning();
    user = newUser;
  }
  const userId = user!.id;

  // 3. Create a Prospect (Customer)
  const [prospect] = await db.insert(prospects).values({
    tenantId,
    firstName: "Jean",
    lastName: "Dupont",
    phone: "0612345678",
    email: "jean.dupont@example.com",
  }).returning();
  const prospectId = prospect!.id;

  // 4. RESTAURANT: Menu Items & Orders
  logger.info("🍴 Seeding Restaurant data...");
  const [pizza] = await db.insert(menuItems).values([
    { tenantId, name: "Pizza Margherita", category: "Pizza", price: "10.00", allergens: ["gluten", "lactose"] },
    { tenantId, name: "Pizza Pepperoni", category: "Pizza", price: "12.00", allergens: ["gluten", "lactose"] },
  ]).returning();

  await db.insert(orders).values({
    tenantId,
    prospectId,
    orderNumber: "ORD-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
    metadata: { items: [{ menuItemId: pizza!.id, quantity: 1, price: "10.00" }] },
    totalAmount: "10.00",
    status: "pending",
  });

  // 5. HOTEL: Rooms & Bookings
  logger.info("🏨 Seeding Hotel data...");
  const [room] = await db.insert(hotelRooms).values([
    { tenantId, roomNumber: "101", roomType: "Standard", pricePerNight: "120.00" },
    { tenantId, roomNumber: "201", roomType: "Suite", pricePerNight: "250.00" },
  ]).returning();

  await db.insert(bookings).values({
    tenantId,
    roomId: room!.id,
    prospectId,
    checkIn: new Date(Date.now() + 86400000),
    checkOut: new Date(Date.now() + 86400000 * 3),
    totalPrice: "240.00",
    status: "confirmed",
  });

  // 6. MEDICAL: Appointments
  logger.info("🩺 Seeding Medical data...");
  await db.insert(medicalAppointments).values({
    tenantId,
    prospectId,
    doctorId: userId,
    appointmentDate: new Date(Date.now() + 86400000),
    symptoms: "Mal de gorge et fièvre",
    urgencyLevel: "medium",
    status: "scheduled",
  });

  // 7. CUSTOMER EXTENDED
  logger.info("👤 Seeding Customer Extended data...");
  await db.insert(customersExtended).values({
    prospectId,
    address: "15 rue de la République, 75001 Paris",
    preferences: { allergies: ["gluten"], favorite_dishes: ["Pizza Pepperoni"] },
  });

  logger.info("✅ Seeding completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  logger.error("❌ Seeding failed:", err);
  process.exit(1);
});

import { realEstateProperties, jobOffers } from "../../drizzle/schema-industries";

async function extendSeed() {
  logger.info("🏘️ Seeding real estate and recruitment data...");
  const [tenant] = await db.select().from(tenants).limit(1);
  if (!tenant) return;
  const tenantId = tenant!.id;

  // Real Estate
  await db.insert(realEstateProperties).values([
    { tenantId, title: "Appartement T3 Centre-Ville", type: "Achat", propertyType: "Appartement", price: "250000.00", location: "Paris 11", rooms: 3, surface: "65.00" },
    { tenantId, title: "Maison de campagne avec jardin", type: "Achat", propertyType: "Maison", price: "450000.00", location: "Normandie", rooms: 5, surface: "120.00" },
    { tenantId, title: "Studio étudiant proche facultés", type: "Location", propertyType: "Appartement", price: "850.00", location: "Lyon", rooms: 1, surface: "20.00" },
  ]);

  // Recruitment
  await db.insert(jobOffers).values([
    { tenantId, title: "Développeur Fullstack Senior", department: "Engineering", location: "Paris / Remote", contractType: "CDI", salaryRange: "60k-75k" },
    { tenantId, title: "Product Manager", department: "Product", location: "Paris", contractType: "CDI", salaryRange: "55k-70k" },
    { tenantId, title: "Customer Success Manager", department: "Customer", location: "Lyon", contractType: "CDI", salaryRange: "40k-50k" },
  ]);

  logger.info("✅ Extended industry data seeded successfully!");
}

extendSeed().catch(console.error);

import { interventions, enrollments } from "../../drizzle/schema-industries";
import { logger } from '../core/logger/index';

async function finalSeed() {
  logger.info("⚖️📦🔧🎓 Seeding remaining industry data...");
  const [tenant] = await db.select().from(tenants).limit(1);
  if (!tenant) return;
  const tenantId = tenant!.id;
  const [prospect] = await db.select().from(prospects).limit(1);
  if (!prospect) return;
  const prospectId = prospect.id;

  // Legal
  await db.insert(legalCases).values({ tenantId, prospectId, caseType: "Travail", description: "Litige licenciement abusif", status: "open" });

  // Logistics
  await db.insert(shipments).values({ tenantId, prospectId, trackingNumber: "SC-999888777", status: "in_transit", estimatedDelivery: new Date(Date.now() + 86400000 * 5), shippingAddress: "42 rue de la Paix, 75002 Paris" });

  // Services
  await db.insert(interventions).values({ tenantId, prospectId, type: "Plomberie", description: "Fuite d'eau cuisine", urgency: "high", status: "scheduled", scheduledAt: new Date(Date.now() + 3600000 * 2) });

  // Education
  await db.insert(enrollments).values({ tenantId, prospectId, courseName: "Développement Web Fullstack", educationLevel: "Bac +2", status: "interested" });

  logger.info("✅ Final industry data seeded successfully!");
}

finalSeed().catch(console.error);
