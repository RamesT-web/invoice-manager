"use client";

import { useParams } from "next/navigation";
import { CustomerForm } from "@/components/customers/customer-form";

export default function EditCustomerPage() {
  const params = useParams();
  return <CustomerForm customerId={params.id as string} />;
}
