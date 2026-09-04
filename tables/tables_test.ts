import { assertEquals } from "@std/assert";
import {
  kernelDatabaseBackendSymbol,
  kernelInvokeSymbol,
} from "@the8020/kernel";

(globalThis as unknown as Record<symbol, unknown>)[
  kernelDatabaseBackendSymbol
] = "sqlite";
(globalThis as unknown as Record<symbol, unknown>)[kernelInvokeSymbol] = (
  operation: string,
) => {
  if (operation === "database.info") {
    return Promise.resolve({ backend: "sqlite", state: "READY" });
  }
  return Promise.reject(new Error(`unexpected operation ${operation}`));
};

const { descriptorOf } = await import("/p/the8020/db/mod.ts");
const Customers = (await import("./customers.ts")).default;
const Orders = (await import("./orders.ts")).default;
const OrderItems = (await import("./order_items.ts")).default;

Deno.test("database demo definitions cover references and composite keys", () => {
  const customers = descriptorOf(Customers);
  const orders = descriptorOf(Orders);
  const items = descriptorOf(OrderItems);

  assertEquals(customers.table_id, "the8020__demo__customers");
  assertEquals(
    orders.columns.find((column) => column.name === "customerId")?.reference,
    { table: Customers.table, column: "id" },
  );
  assertEquals(items.primary_key, ["orderId", "itemNumber"]);
  assertEquals(
    items.columns.find((column) => column.name === "orderId")?.reference,
    { table: Orders.table, column: "id" },
  );
  assertEquals(
    orders.columns.find((column) => column.name === "createdAt")?.default,
    { kind: "now" },
  );
  assertEquals(
    orders.columns.find((column) => column.name === "total")?.logical_type,
    "decimal",
  );
});
