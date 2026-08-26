import { callScreen, field, z } from "@platform/uui";
import layout from "./layouts/main.json" with { type: "json" };

const FormScreen = z.object({
  username: field(z.string().min(3), {
    label: "Username",
    group: "account",
    control: "text",
    readOnly: true,
  }),
  email: field(z.string().email(), {
    label: "Email",
    group: "account",
    control: "email",
  }),
  biography: field(z.string().optional(), {
    label: "Biography",
    group: "profile",
    control: "textarea",
  }),
  enabled: field(z.boolean(), {
    label: "Enabled",
    group: "status",
    control: "switch",
  }),
  role: field(z.enum(["administrator", "operator", "viewer"]), {
    label: "Role",
    group: "account",
    control: "select",
  }),
  saveCount: field(z.number().int().nonnegative(), {
    label: "Save count",
    readOnly: true,
  }),
  status: field(z.string(), { label: "Status", readOnly: true }),
});

const initial: z.infer<typeof FormScreen> = {
  username: "admin",
  email: "admin@example.com",
  biography: "",
  enabled: true,
  role: "administrator",
  saveCount: 0,
  status: "",
};

export default async function demoForm(): Promise<void> {
  const model = structuredClone(initial);
  while (true) {
    const event = await callScreen({
      id: "demo-form",
      title: "Form and binding demonstration",
      schema: FormScreen,
      model,
      layout,
      controls: [
        { id: "username", bind: "username" },
        { id: "primary-email", bind: "email", label: "Primary email" },
        {
          id: "confirmation-email",
          bind: "email",
          label: "Confirmation email",
        },
        { id: "biography", bind: "biography" },
        { id: "enabled", bind: "enabled" },
        { id: "role", bind: "role" },
        { id: "saveCount", bind: "saveCount" },
        { id: "status", bind: "status" },
      ],
      actions: [
        { id: "save", label: "Save", kind: "primary" },
        { id: "reset", label: "Reset" },
        { id: "throw-type-error", label: "Throw TypeError", kind: "danger" },
        { id: "back", label: "Back" },
      ],
    });
    if (event.action === "throw-type-error") raiseDemoTypeError();
    if (event.action === "back") return;
    if (event.action === "reset") {
      Object.assign(model, structuredClone(initial));
    }
    if (event.action === "save") {
      model.saveCount++;
      model.status = `Saved ${model.saveCount} time${
        model.saveCount === 1 ? "" : "s"
      }.`;
    }
  }
}

function raiseDemoTypeError(): never {
  throw new TypeError(
    "The form demo intentionally raised an uncaught TypeError.",
  );
}
