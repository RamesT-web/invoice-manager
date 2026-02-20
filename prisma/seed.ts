import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const passwordHash = await hash("admin123", 12);
  const user = await prisma.user.upsert({
    where: { email: "admin@invoicemanager.com" },
    update: {},
    create: {
      email: "admin@invoicemanager.com",
      passwordHash,
      name: "Admin",
      phone: "+91 98765 43210",
    },
  });
  console.log("Created user:", user.email);

  // Create Company 1: TES Engineering
  const tes = await prisma.company.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "TES Engineering",
      legalName: "TES Engineering Services",
      gstin: "33AABCT1234F1ZP",
      pan: "AABCT1234F",
      addressLine1: "123 Industrial Estate",
      city: "Chennai",
      state: "33",
      stateName: "Tamil Nadu",
      pincode: "600001",
      phone: "+91 44 1234 5678",
      email: "accounts@tesengineering.com",
      bankName: "State Bank of India",
      bankAccountNo: "1234567890",
      bankIfsc: "SBIN0001234",
      bankBranch: "Anna Nagar Branch",
      bankUpiId: "tes@sbi",
      invoicePrefix: "TES/",
      quotePrefix: "TES/Q/",
      defaultTerms:
        "1. Payment is due within 30 days of invoice date.\n2. Late payments may attract interest at 18% per annum.\n3. All disputes subject to Chennai jurisdiction.",
      defaultPaymentTermsDays: 30,
    },
  });
  console.log("Created company:", tes.name);

  // Create Company 2: Zetasky Pvt Ltd
  const zetasky = await prisma.company.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Zetasky Pvt Ltd",
      legalName: "Zetasky Private Limited",
      gstin: "33BBBCZ5678G2YQ",
      pan: "BBBCZ5678G",
      addressLine1: "456 Tech Park",
      city: "Chennai",
      state: "33",
      stateName: "Tamil Nadu",
      pincode: "600002",
      phone: "+91 44 9876 5432",
      email: "billing@zetasky.com",
      bankName: "HDFC Bank",
      bankAccountNo: "9876543210",
      bankIfsc: "HDFC0001234",
      bankBranch: "T Nagar Branch",
      bankUpiId: "zetasky@hdfc",
      invoicePrefix: "ZS/",
      quotePrefix: "ZS/Q/",
      defaultTerms:
        "1. Payment within 30 days.\n2. GST as applicable.\n3. Subject to Chennai jurisdiction.",
      defaultPaymentTermsDays: 30,
    },
  });
  console.log("Created company:", zetasky.name);

  // Link user to both companies
  await prisma.companyUser.upsert({
    where: {
      companyId_userId: { companyId: tes.id, userId: user.id },
    },
    update: {},
    create: {
      companyId: tes.id,
      userId: user.id,
      role: "admin",
      isDefault: true,
    },
  });

  await prisma.companyUser.upsert({
    where: {
      companyId_userId: { companyId: zetasky.id, userId: user.id },
    },
    update: {},
    create: {
      companyId: zetasky.id,
      userId: user.id,
      role: "admin",
      isDefault: false,
    },
  });
  console.log("Linked user to both companies");

  // Create sample items for TES
  const items = [
    {
      companyId: tes.id,
      name: "Interior Design Consultation",
      description: "Professional interior design consultation services",
      hsnSacCode: "998311",
      type: "service",
      unit: "per_job",
      defaultRate: 50000,
      gstRate: 18,
    },
    {
      companyId: tes.id,
      name: "Civil Works",
      description: "Civil construction and renovation work",
      hsnSacCode: "995411",
      type: "service",
      unit: "sq_ft",
      defaultRate: 250,
      gstRate: 18,
    },
    {
      companyId: tes.id,
      name: "MEP Services",
      description: "Mechanical, Electrical and Plumbing services",
      hsnSacCode: "998311",
      type: "service",
      unit: "ls",
      defaultRate: 100000,
      gstRate: 18,
    },
    {
      companyId: tes.id,
      name: "Monthly Office Rent",
      description: "Commercial office space rental",
      hsnSacCode: "997212",
      type: "service",
      unit: "per_month",
      defaultRate: 50000,
      gstRate: 18,
    },
    {
      companyId: tes.id,
      name: "Maintenance AMC",
      description: "Annual maintenance contract",
      hsnSacCode: "998311",
      type: "service",
      unit: "per_month",
      defaultRate: 15000,
      gstRate: 18,
    },
  ];

  for (const item of items) {
    await prisma.item.create({ data: item });
  }
  console.log("Created", items.length, "sample items");

  // Create sample customers for TES
  const customers = [
    {
      companyId: tes.id,
      name: "Alpha Corporation",
      gstin: "33AABCA1234F1ZP",
      billingAddressLine1: "100 Alpha Street",
      billingCity: "Chennai",
      billingState: "33",
      billingStateName: "Tamil Nadu",
      billingPincode: "600028",
      contactName: "Rajesh Kumar",
      contactEmail: "rajesh@alphacorp.com",
      contactPhone: "+91 98765 11111",
    },
    {
      companyId: tes.id,
      name: "Beta Technologies Ltd",
      gstin: "27BBBCB5678G2YQ",
      billingAddressLine1: "200 Beta Tower",
      billingCity: "Mumbai",
      billingState: "27",
      billingStateName: "Maharashtra",
      billingPincode: "400001",
      contactName: "Priya Sharma",
      contactEmail: "priya@betatech.com",
      contactPhone: "+91 98765 22222",
    },
    {
      companyId: tes.id,
      name: "Gamma Industries",
      gstin: "33CCCDC9012H3XR",
      billingAddressLine1: "300 Gamma Complex",
      billingCity: "Chennai",
      billingState: "33",
      billingStateName: "Tamil Nadu",
      billingPincode: "600040",
      contactName: "Suresh Iyer",
      contactEmail: "suresh@gamma.in",
      contactPhone: "+91 98765 33333",
    },
  ];

  for (const customer of customers) {
    await prisma.customer.create({ data: customer });
  }
  console.log("Created", customers.length, "sample customers");

  console.log("\nSeed complete!");
  console.log("Login with: admin@invoicemanager.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
