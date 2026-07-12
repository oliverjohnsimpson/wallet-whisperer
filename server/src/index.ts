import "express-async-errors"; // must be imported before the route files below so their async handlers are patched
import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { budgetsRouter } from "./routes/budgets.js";
import { expensesRouter } from "./routes/expenses.js";
import { incomesRouter } from "./routes/incomes.js";
import { categoriesRouter, incomeCategoriesRouter } from "./routes/categories.js";
import { reportsRouter } from "./routes/reports.js";
import { profileRouter } from "./routes/profile.js";
import { aiRouter } from "./routes/ai.js";
import { billingRouter, billingWebhookHandler } from "./routes/billing.js";
import { fxRouter } from "./routes/fx.js";

const app = express();

app.use(cors({ origin: env.webOrigin, credentials: true }));

// Razorpay webhook needs the raw body for signature verification — mount before express.json().
app.post("/api/billing/webhook", express.raw({ type: "*/*" }), billingWebhookHandler);

app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "wallet-whisperer-server" }));

app.use("/api/budgets", budgetsRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/incomes", incomesRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/income-categories", incomeCategoriesRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/profile", profileRouter);
app.use("/api/billing", billingRouter);
app.use("/api/fx", fxRouter);
app.use("/api/ai", aiRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.port, () => {
  console.log(`Wallet Whisperer server listening on http://localhost:${env.port}`);
});
