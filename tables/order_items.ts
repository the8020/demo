import {
  type Insertable,
  type Row,
  type Selectable,
  t,
  table,
  type TableDatabase,
  type Updateable,
} from "/p/the8020/db/mod.ts";
import Orders from "./orders.ts";

const OrderItems = table("the8020__demo__order_items", {
  orderId: t.integer().primaryKey().references(() => Orders.id),
  itemNumber: t.integer().primaryKey(),
  sku: t.text(),
  quantity: t.integer().default(1),
  unitPrice: t.decimal(18, 2),
}, {
  indexes: [{ columns: ["sku"] }],
});

declare module "/p/the8020/db/types.ts" {
  interface Database extends TableDatabase<typeof OrderItems> {}
}

export type OrderItemRow = Row<typeof OrderItems>;
export type OrderItem = Selectable<OrderItemRow>;
export type NewOrderItem = Insertable<OrderItemRow>;
export type OrderItemUpdate = Updateable<OrderItemRow>;

export default OrderItems;
