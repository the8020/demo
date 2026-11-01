import { text as localizedText } from "/p/the8020/i18n/mod.ts";
import { msg } from "/p/the8020/demo/i18n/messages.ts";
import {
  BACK_EVENT,
  callScreen,
  CONFIRM_CLASS,
  field,
  Model,
  presentModal,
  z,
} from "/p/the8020/uui/mod.ts";
import { orderSelection } from "../../src/fields.ts";
import demoForm from "../demo-form/program.ts";
import layout from "./layouts/main.json" with { type: "json" };

const Order = orderSelection;
const MasterDetailScreen = z.object({
  orders: field(z.array(Order.extend({ selected: z.boolean() })), {
    label: msg("program.orders"),
    description: msg("program.select_an_order_to_review_its_details"),
    control: "list",
    readOnly: true,
  }),
  newCustomer: field(Order.shape.customer, {
    label: msg("program.new_customer"),
    length: "short",
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
    orders: orders.map((order) => ({ ...order, selected: false })),
    newCustomer: localizedText(msg("program.new_customer")),
    selectedOrderId: orders[0]!.id,
    selectedOrder: structuredClone(orders[0]!),
  };
  const screenModel = new Model(model);
  while (true) {
    screenModel.data = model;
    const event = await callScreen({
      id: "demo-master-detail",
      title: msg("program.master_detail_demonstration"),
      schema: MasterDetailScreen,
      model: screenModel,
      layout,
      header: {
        actions: [
          {
            id: "open-form",
            label: msg("program.open_form_demo"),
            kind: "primary",
          },
          { id: "change-status", label: msg("program.change_status") },
          {
            id: "throw-value-error",
            label: msg("program.throw_valueerror"),
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
    if (event.action === "add-row") {
      const id = String(
        Math.max(1000, ...model.orders.map((order) => Number(order.id))) + 1,
      );
      model.orders.push({
        id,
        number: `ORD-${id}`,
        customer: model.newCustomer,
        status: "draft",
        selected: false,
      });
    }
    if (event.action === "confirm-selected") {
      for (const order of model.orders) {
        if (order.selected) {
          order.status = "confirmed";
          if (order.id === model.selectedOrderId) {
            model.selectedOrder.status = order.status;
          }
        }
      }
    }
    if (
      event.action === "delete-selected" &&
      model.orders.some((order) => order.selected)
    ) {
      const choice = await presentModal(() =>
        callScreen({
          id: "delete-orders",
          class: CONFIRM_CLASS,
          title: msg("program.delete_selected_orders"),
          description: msg("program.value1_orders_will_be_deleted", {
            value1: model.orders.filter((order) => order.selected).length,
          }),
          schema: z.object({}),
          model: new Model({}),
          layout: {
            schema: 1,
            id: "decision",
            root: {
              type: "actions",
              elements: [
                { id: "cancel-delete", label: msg("program.cancel") },
                { type: "separator" },
                {
                  id: "confirm-delete",
                  label: msg("program.delete_orders"),
                  kind: "danger",
                },
              ],
            },
          },
        })
      );
      if (choice.action === "confirm-delete") {
        model.orders = model.orders.filter((order) => !order.selected);
        if (!model.orders.some((order) => order.id === model.selectedOrderId)) {
          model.selectedOrder = structuredClone(
            model.orders[0] ?? {
              id: "",
              number: "",
              customer: "",
              status: "draft",
            },
          );
          model.selectedOrderId = model.selectedOrder.id;
        }
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
    super(
      localizedText(
        msg("program.the_order_number_value_is_invalid", { value: value }),
      ),
    );
    this.name = "ValueError";
    this.rejectedValue = value;
  }
}

function validateImpossibleOrder(value: string): never {
  throw new ValueError(value);
}
