import { router } from "./trpc";
import { userRouter } from "./routers/user";
import { companyRouter } from "./routers/company";
import { dashboardRouter } from "./routers/dashboard";
import { customerRouter } from "./routers/customer";
import { itemRouter } from "./routers/item";
import { invoiceRouter } from "./routers/invoice";
import { paymentRouter } from "./routers/payment";
import { bankRouter } from "./routers/bank";
import { vendorRouter } from "./routers/vendor";
import { vendorBillRouter } from "./routers/vendorBill";
import { reportRouter } from "./routers/report";
import { ledgerRouter } from "./routers/ledger";
import { attachmentRouter } from "./routers/attachment";
import { settingRouter } from "./routers/setting";

export const appRouter = router({
  user: userRouter,
  company: companyRouter,
  dashboard: dashboardRouter,
  customer: customerRouter,
  item: itemRouter,
  invoice: invoiceRouter,
  payment: paymentRouter,
  bank: bankRouter,
  vendor: vendorRouter,
  vendorBill: vendorBillRouter,
  report: reportRouter,
  ledger: ledgerRouter,
  attachment: attachmentRouter,
  setting: settingRouter,
});

export type AppRouter = typeof appRouter;
