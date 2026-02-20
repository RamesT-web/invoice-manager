/** Indian states with GST state codes */
export const INDIAN_STATES = [
  { code: "01", name: "Jammu & Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "25", name: "Daman & Diu" },
  { code: "26", name: "Dadra & Nagar Haveli" },
  { code: "27", name: "Maharashtra" },
  { code: "28", name: "Andhra Pradesh (Old)" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman & Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
] as const;

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export const PAYMENT_MODES = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
] as const;

export const INVOICE_STATUSES = [
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-700" },
  { value: "sent", label: "Sent", color: "bg-blue-100 text-blue-700" },
  { value: "partially_paid", label: "Partially Paid", color: "bg-yellow-100 text-yellow-700" },
  { value: "paid", label: "Paid", color: "bg-green-100 text-green-700" },
  { value: "overdue", label: "Overdue", color: "bg-red-100 text-red-700" },
  { value: "disputed", label: "Disputed", color: "bg-orange-100 text-orange-700" },
  { value: "on_hold", label: "On Hold", color: "bg-purple-100 text-purple-700" },
  { value: "cancelled", label: "Cancelled", color: "bg-gray-100 text-gray-500" },
] as const;

export const QUOTE_STATUSES = [
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-700" },
  { value: "sent", label: "Sent", color: "bg-blue-100 text-blue-700" },
  { value: "accepted", label: "Accepted", color: "bg-green-100 text-green-700" },
  { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
  { value: "expired", label: "Expired", color: "bg-gray-100 text-gray-500" },
  { value: "converted", label: "Converted", color: "bg-purple-100 text-purple-700" },
] as const;

export const COST_CENTERS = [
  { value: "interiors", label: "Interiors" },
  { value: "leasing", label: "Leasing" },
  { value: "maintenance", label: "Maintenance" },
  { value: "mep", label: "MEP" },
] as const;

export const ITEM_UNITS = [
  { value: "nos", label: "Nos" },
  { value: "sq_ft", label: "Sq Ft" },
  { value: "sq_m", label: "Sq M" },
  { value: "rft", label: "Rft" },
  { value: "per_job", label: "Per Job" },
  { value: "per_month", label: "Per Month" },
  { value: "hrs", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "kg", label: "Kg" },
  { value: "lot", label: "Lot" },
  { value: "ls", label: "Lump Sum" },
] as const;

export const TDS_RATES = [0, 1, 2, 5, 10, 20] as const;

export const TDS_CERTIFICATE_STATUSES = [
  { value: "not_applicable", label: "Not Applicable" },
  { value: "pending", label: "Pending" },
  { value: "requested", label: "Requested" },
  { value: "received", label: "Received" },
] as const;

export const VENDOR_BILL_STATUSES = [
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  { value: "partially_paid", label: "Partially Paid", color: "bg-blue-100 text-blue-700" },
  { value: "paid", label: "Paid", color: "bg-green-100 text-green-700" },
  { value: "overdue", label: "Overdue", color: "bg-red-100 text-red-700" },
  { value: "cancelled", label: "Cancelled", color: "bg-gray-100 text-gray-500" },
] as const;

export const ROLES = ["admin", "accounts", "staff"] as const;
