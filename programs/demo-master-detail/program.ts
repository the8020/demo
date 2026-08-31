import { BACK_EVENT, callScreen, field, z } from "@packages/the8020/uui/mod.ts";
import demoForm from "../demo-form/program.ts";
import layout from "./layouts/main.json" with { type: "json" };

const Order = z.object({
  id: z.string(),
  number: z.string(),
  customer: z.string(),
  status: z.enum(["draft", "confirmed"]),
});
const MasterDetailScreen = z.object({
  orders: field(z.array(Order), {
    label: "Orders",
    control: "list",
    readOnly: true,
  }),
  selectedOrderId: z.string(),
  selectedOrder: Order,
});

export default async function masterDetail(): Promise<void> {
  const orders: Array<z.infer<typeof Order>> = [
    {
      id: "1001",
      number: "ORD-1001",
      customer: "Example Corp",
      status: "draft",
    },
    {
      id: "1002",
      number: "ORD-1002",
      customer: "Another Corp",
      status: "confirmed",
    },
    ...Array.from(
      { length: 58 },
      (_, index): z.infer<typeof Order> => {
        const number = 1003 + index;
        return {
          id: String(number),
          number: `ORD-${number}`,
          customer: `Customer ${number}`,
          status: index % 2 === 0 ? "draft" : "confirmed",
        };
      },
    ),
  ];
  const model: z.infer<typeof MasterDetailScreen> = {
    orders,
    selectedOrderId: orders[0]!.id,
    selectedOrder: structuredClone(orders[0]!),
  };
  while (true) {
    const event = await callScreen({
      id: "demo-master-detail",
      title: "Master-detail demonstration",
      schema: MasterDetailScreen,
      model,
      layout,
      header: {
        actions: [
          { id: "open-form", label: "Open form demo", kind: "primary" },
          { id: "change-status", label: "Change status" },
          {
            id: "throw-value-error",
            label: "Throw ValueError",
            kind: "danger",
          },
        ],
      },
    });
    if (event.action === "throw-value-error") validateImpossibleOrder("ORD-0");
    if (event.action === BACK_EVENT) return;
    if (event.action === "select" && typeof event.value === "string") {
      const selected = model.orders.find((order) => order.id === event.value);
      if (selected !== undefined) {
        model.selectedOrderId = selected.id;
        model.selectedOrder = structuredClone(selected);
      }
    }
    if (event.action === "change-status") {
      model.selectedOrder.status = model.selectedOrder.status === "draft"
        ? "confirmed"
        : "draft";
      const source = model.orders.find((order) =>
        order.id === model.selectedOrderId
      );
      if (source !== undefined) source.status = model.selectedOrder.status;
    }
    if (event.action === "open-form") await demoForm();
  }
}

class ValueError extends Error {
  readonly field = "orderNumber";
  readonly rejectedValue: string;

  constructor(value: string) {
    super(`The order number '${value}' is invalid.`);
    this.name = "ValueError";
    this.rejectedValue = value;
  }
}

function validateImpossibleOrder(value: string): never {
  throw new ValueError(value);
}
