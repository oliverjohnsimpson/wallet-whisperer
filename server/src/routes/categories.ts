import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { sendIfError } from "../lib/respond.js";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get("/", async (req, res) => {
  const { data, error } = await req.db.from("categories").select("*").order("sort_order");
  if (sendIfError(res, error)) return;
  res.json(data);
});

export const incomeCategoriesRouter = Router();
incomeCategoriesRouter.use(requireAuth);

incomeCategoriesRouter.get("/", async (req, res) => {
  const { data, error } = await req.db.from("income_categories").select("*").order("sort_order");
  if (sendIfError(res, error)) return;
  res.json(data);
});
