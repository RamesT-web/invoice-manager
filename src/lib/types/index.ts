import type { Company, CompanyUser } from "@prisma/client";

export type UserWithCompanies = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  companyUsers: (CompanyUser & {
    company: Company;
  })[];
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};
