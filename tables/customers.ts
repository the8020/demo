import {
  type Insertable,
  type Row,
  type Selectable,
  t,
  table,
  type TableDatabase,
  type Updateable,
} from "/p/the8020/db/mod.ts";
import { customerFields } from "../src/fields.ts";
import { auditColumns } from "../src/database/audit_columns.ts";

const Customers = table("the8020__demo__customers", {
  ...auditColumns,
  id: t.text().primaryKey(),
  name: t.from(customerFields.shape.name),
  email: t.from(customerFields.shape.email).unique(),
  enabled: t.from(customerFields.shape.enabled).default(true),
  profile: t.json<{ tier: "standard" | "priority"; notes?: string }>()
    .nullable(),
});

declare module "/p/the8020/db/types.ts" {
  interface Database extends TableDatabase<typeof Customers> {}
}

export type CustomerRow = Row<typeof Customers>;
export type Customer = Selectable<CustomerRow>;
export type NewCustomer = Insertable<CustomerRow>;
export type CustomerUpdate = Updateable<CustomerRow>;

export default Customers;
