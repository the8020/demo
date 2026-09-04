import { db, sql } from "/p/the8020/db/mod.ts";
import { defineService, z } from "@the8020/http";
import Customers from "../../tables/customers.ts";
import OrderItems from "../../tables/order_items.ts";
import Orders from "../../tables/orders.ts";

const service = defineService();

service.post(
  "/orders",
  {
    summary: "Create one customer order transactionally",
    body: z.object({
      customerId: z.string().min(1),
      customerName: z.string().min(1),
      email: z.string().email(),
      sku: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.string().regex(/^(?:0|[1-9][0-9]*)\.[0-9]{2}$/),
    }),
    responses: { 201: z.object({ orderId: z.number().int() }) },
  },
  async ({ body }) => {
    const orderId = await db.transaction().execute(async (transaction) => {
      await transaction.insertInto(Customers.table).values({
        id: body.customerId,
        name: body.customerName,
        email: body.email,
        profile: { tier: "standard" },
      }).onConflict((conflict) => conflict.column("id").doNothing()).execute();
      const inserted = await transaction.insertInto(Orders.table).values({
        customerId: body.customerId,
        total: body.unitPrice,
        score: 1,
        receipt: new Uint8Array([0, 1, 254, 255]),
        metadata: { source: "database-demo", tags: ["created"] },
      }).returning(Orders.id).executeTakeFirstOrThrow();
      await transaction.insertInto(OrderItems.table).values({
        orderId: inserted.id,
        itemNumber: 1,
        sku: body.sku,
        quantity: body.quantity,
        unitPrice: body.unitPrice,
      }).execute();
      return inserted.id;
    });
    return Response.json({ orderId }, { status: 201 });
  },
);

service.get(
  "/orders",
  {
    summary: "List orders with their customer and item count",
    responses: {
      200: z.array(z.object({
        id: z.number().int(),
        customer: z.string(),
        status: z.string(),
        total: z.string(),
        itemCount: z.number().int(),
        createdAt: z.string(),
      })),
    },
  },
  async () => {
    const rows = await Orders.select([
      Orders.id,
      Orders.status,
      Orders.total,
      Orders.createdAt,
    ])
      .innerJoin(Customers.table, Customers.id, Orders.customerId)
      .leftJoin(OrderItems.table, OrderItems.orderId, Orders.id)
      .select(`${Customers.name} as customer`)
      .select(
        sql<number>`count(${sql.ref(OrderItems.itemNumber)})`.as("itemCount"),
      )
      .groupBy([
        Orders.id,
        Orders.status,
        Orders.total,
        Orders.createdAt,
        Customers.name,
      ])
      .orderBy(Orders.id)
      .execute();
    return Response.json(rows.map((row) => ({
      ...row,
      itemCount: Number(row.itemCount),
      createdAt: row.createdAt.toISOString(),
    })));
  },
);

service.post(
  "/rollback-check",
  {
    summary: "Prove failed transaction callbacks roll back",
    responses: { 200: z.object({ rolledBack: z.boolean() }) },
  },
  async () => {
    const marker = `rollback-${crypto.randomUUID()}`;
    try {
      await db.transaction().execute(async (transaction) => {
        await transaction.insertInto(Customers.table).values({
          id: marker,
          name: "Rollback test",
          email: `${marker}@example.test`,
        }).execute();
        throw new Error("intentional rollback");
      });
    } catch {
      // Expected: the callback error causes Kysely to roll the transaction back.
    }
    const record = await Customers.select([Customers.id]).where(
      Customers.id,
      "=",
      marker,
    ).executeTakeFirst();
    return Response.json({ rolledBack: record === undefined });
  },
);

export default service;
