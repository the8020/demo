import {
  type Insertable,
  type Row,
  type Selectable,
  t,
  table,
  type TableDatabase,
  type Updateable,
} from "/p/the8020/db/mod.ts";
import { auditColumns } from "../src/database/audit_columns.ts";
import Customers from "./customers.ts";

const Orders = table("the8020__demo__orders", {
  ...auditColumns,
  id: t.integer().primaryKey().generated(),
  customerId: t.text().references(() => Customers.id),
  status: t.enum(["draft", "confirmed", "cancelled"] as const).default(
    "draft",
  ),
  total: t.decimal(18, 2),
  score: t.float().default(0),
  receipt: t.bytes().nullable(),
  metadata: t.json<{ source: string; tags?: string[] }>().nullable(),
}, {
  indexes: [{ columns: ["customerId", "status"] }],
});

declare module "/p/the8020/db/types.ts" {
  interface Database extends TableDatabase<typeof Orders> {}
}

export type OrderRow = Row<typeof Orders>;
export type Order = Selectable<OrderRow>;
export type NewOrder = Insertable<OrderRow>;
export type OrderUpdate = Updateable<OrderRow>;

export default Orders;
