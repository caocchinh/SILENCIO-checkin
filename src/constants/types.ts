import { customer } from "@/drizzle/schema";

export type Customer = typeof customer.$inferSelect;
