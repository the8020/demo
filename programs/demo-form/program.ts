import {
  BACK_EVENT,
  callScreen,
  field,
  sendMessage,
  z,
} from "@packages/the8020/uui/mod.ts";
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
    length: "long",
  }),
  biography: field(z.string().optional(), {
    label: "Biography",
    group: "profile",
    control: "textarea",
    length: "long",
    rowSpan: 2,
  }),
  enabled: field(z.boolean(), {
    label: "Enabled",
    group: "status",
    control: "switch",
    length: "short",
  }),
  role: field(z.enum(["administrator", "operator", "viewer"]), {
    label: "Role",
    group: "account",
    control: "select",
  }),
  saveCount: field(z.number().int().nonnegative(), {
    label: "Save count",
    length: "short",
    readOnly: true,
  }),
  status: field(z.string(), {
    label: "Status",
    length: "long",
    readOnly: true,
  }),
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
  const asyncMessages = new AbortController();
  const pendingMessageRuns = new Set<Promise<void>>();
  try {
    while (true) {
      const event = await callScreen({
        id: "demo-form",
        title: "[[icon=edit color=primary]] Form and binding demonstration",
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
          { id: "message-single", label: "Single message" },
          { id: "message-types", label: "Message types" },
          { id: "message-markdown", label: "Long Markdown" },
          { id: "message-async", label: "Async messages" },
          { id: "message-limits", label: "Message limits" },
        ],
        header: {
          actions: [
            {
              id: "save",
              label: "[[icon=save color=#ffffff]] Save",
              kind: "primary",
            },
            { id: "reset", label: "Reset" },
            {
              id: "throw-type-error",
              label: "Throw TypeError",
              kind: "danger",
            },
          ],
        },
      });
      if (event.action === "throw-type-error") raiseDemoTypeError();
      if (event.action === BACK_EVENT) return;
      if (event.action === "reset") {
        Object.assign(model, structuredClone(initial));
      }
      if (event.action === "save") {
        model.saveCount++;
        model.status = `Saved ${model.saveCount} time${
          model.saveCount === 1 ? "" : "s"
        }.`;
      }
      if (event.action === "message-single") {
        sendMessage("The demo sent one informational message.");
      }
      if (event.action === "message-types") sendMessageTypes();
      if (event.action === "message-markdown") sendMarkdownMessages();
      if (event.action === "message-async") {
        const run = sendAsyncMessages(asyncMessages.signal);
        pendingMessageRuns.add(run);
        void run.then(
          () => pendingMessageRuns.delete(run),
          () => pendingMessageRuns.delete(run),
        );
      }
      if (event.action === "message-limits") {
        for (let sequence = 1; sequence <= 105; sequence++) {
          sendMessage(`Burst message ${sequence} of 105.`, "info");
        }
      }
    }
  } finally {
    asyncMessages.abort();
    await Promise.allSettled(pendingMessageRuns);
  }
}

function sendMessageTypes(): void {
  sendMessage("An informational update is available.", "info");
  sendMessage("The requested operation completed.", "success");
  sendMessage("The operation needs your attention.", "warning");
  sendMessage("The operation could not be completed.", "error");
}

function sendMarkdownMessages(): void {
  sendMessage(
    `# Deployment summary

The release completed with **three checks** and a deliberately long explanation so the active toast expands while the cards below remain aligned to its lower edge.

| Component | Result |
| --- | --- |
| API | Ready |
| Worker | Ready |
| Browser | Ready |

- Review the result
- Continue when ready

## Notes

The first paragraph is intentionally detailed: every item remains available in the message history after its toast closes, and the currently visible card keeps its content readable without changing the dimensions of the cards stacked beneath it.

The second paragraph adds enough content to exercise the bounded reading area. You can scroll inside the message while the toast remains in place, then open Messages from the session menu to read the same Markdown in the longer history view.

## Follow-up

Run \`deno task check\` for a local verification, review the table above, and continue when the reported components are ready.`,
    "info",
  );
  sendMessage("A short success card is stacked underneath.", "success");
  sendMessage("A short warning card completes the stack.", "warning");
}

async function sendAsyncMessages(signal: AbortSignal): Promise<void> {
  const messages = [
    ["The background task started.", "info"],
    ["The background task reached its checkpoint.", "success"],
    ["The background task finished with a warning.", "warning"],
  ] as const;
  for (const [body, kind] of messages) {
    if (!await waitForMessage(120, signal)) return;
    sendMessage(body, kind);
  }
}

function waitForMessage(
  milliseconds: number,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const aborted = (): void => {
      clearTimeout(timeout);
      resolve(false);
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", aborted);
      resolve(true);
    }, milliseconds);
    signal.addEventListener("abort", aborted, { once: true });
  });
}

function raiseDemoTypeError(): never {
  throw new TypeError(
    "The form demo intentionally raised an uncaught TypeError.",
  );
}
