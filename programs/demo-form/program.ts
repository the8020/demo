import { text as localizedText } from "/p/the8020/i18n/mod.ts";
import { msg } from "/p/the8020/demo/i18n/messages.ts";
import {
  BACK_EVENT,
  callScreen,
  captureMessages,
  CONFIRM_CLASS,
  download,
  type DownloadOptions,
  field,
  type MessageOutput,
  Model,
  nextScreenChannel,
  presentModal,
  presentPage,
  sendMessage,
  z,
} from "/p/the8020/uui/mod.ts";
import { demoFields } from "../../src/fields.ts";
import layout from "./layouts/main.json" with { type: "json" };
import { calculationCsv } from "./downloads.ts";
import { codeEditor } from "/p/the8020/uui/services/shell/frontend/components/code-editor/mod.ts";

const FormScreen = z.object({
  source: field(demoFields.shape.source, {
    custom: codeEditor({ language: "typescript" }),
    length: "long",
    rowSpan: 6,
  }),
  username: field(demoFields.shape.username, {
    group: "account",
    control: "text",
    readOnly: true,
  }),
  email: field(demoFields.shape.email, {
    group: "account",
    control: "email",
    length: "long",
  }),
  biography: field(demoFields.shape.biography, {
    group: "profile",
    control: "textarea",
    length: "long",
    rowSpan: 2,
  }),
  enabled: field(demoFields.shape.enabled, {
    group: "status",
    control: "switch",
    length: "short",
  }),
  role: field(demoFields.shape.role, {
    group: "account",
    control: "select",
  }),
  saveCount: field(demoFields.shape.saveCount, {
    length: "short",
    readOnly: true,
  }),
  status: field(demoFields.shape.status, {
    length: "long",
    readOnly: true,
  }),
  downloadRows: field(demoFields.shape.downloadRows, {
    group: "downloads",
    control: "range",
    length: "long",
    minimum: 1_000,
    maximum: 1_000_000,
    step: 1_000,
    valueSuffix: " rows",
  }),
});

const initial: z.infer<typeof FormScreen> = {
  source: 'console.log("Hello from 80|20");\n',
  username: "admin",
  email: "admin@example.com",
  biography: "",
  enabled: true,
  role: "administrator",
  saveCount: 0,
  status: "",
  downloadRows: 100_000,
};

const PresentationScreen = z.object({
  value: field(demoFields.shape.value, { length: "long" }),
  status: field(demoFields.shape.backgroundStatus, {
    length: "long",
    readOnly: true,
  }),
});

export default async function demoForm(): Promise<void> {
  const model = structuredClone(initial);
  const asyncMessages = new AbortController();
  const pendingMessageRuns = new Set<Promise<void>>();
  try {
    const screenModel = new Model(model);
    let nextDownload: DownloadOptions | undefined;
    let nextMessages = false;
    while (true) {
      const channel = nextScreenChannel();
      screenModel.data = model;
      const pending = callScreen({
        id: "demo-form",
        title: msg("program.form_and_binding_demonstration"),
        schema: FormScreen,
        model: screenModel,
        layout,
        controls: [
          { id: "source", bind: "source" },
          { id: "username", bind: "username" },
          {
            id: "primary-email",
            bind: "email",
            label: msg("program.primary_email"),
          },
          {
            id: "confirmation-email",
            bind: "email",
            label: msg("program.confirmation_email"),
          },
          { id: "biography", bind: "biography" },
          { id: "enabled", bind: "enabled" },
          { id: "role", bind: "role" },
          { id: "saveCount", bind: "saveCount" },
          { id: "status", bind: "status" },
          { id: "downloadRows", bind: "downloadRows" },
        ],
        actions: [
          { id: "confirm-choice", label: msg("program.confirm_yes_no") },
          { id: "presentation-flow", label: msg("program.presentation_flow") },
          { id: "message-single", label: msg("program.single_message") },
          { id: "message-types", label: msg("program.message_types") },
          { id: "message-markdown", label: msg("program.long_markdown") },
          { id: "message-async", label: msg("program.async_messages") },
          { id: "message-limits", label: msg("program.message_limits") },
          { id: "download-file", label: msg("program.download_text_file") },
          {
            id: "download-csv",
            label: msg("program.download_calculations_csv"),
          },
        ],
        header: {
          actions: [
            {
              id: "save",
              label: msg("program.save"),
              kind: "primary",
            },
            { id: "reset", label: msg("program.reset") },
            {
              id: "throw-type-error",
              label: msg("program.throw_typeerror"),
              kind: "danger",
            },
          ],
        },
      });
      if (nextDownload) {
        download(nextDownload, channel.downloads);
        nextDownload = undefined;
      }
      if (nextMessages) {
        const run = sendAsyncMessages(captureMessages(), asyncMessages.signal);
        pendingMessageRuns.add(run);
        void run.then(
          () => pendingMessageRuns.delete(run),
          () => pendingMessageRuns.delete(run),
        );
        nextMessages = false;
      }
      const event = await pending;
      if (event.action === "throw-type-error") raiseDemoTypeError();
      if (event.action === BACK_EVENT) return;
      if (event.action === "confirm-choice") {
        const confirmed = await confirmDecision(
          localizedText(msg("program.would_you_like_to_continue")),
        );
        if (confirmed === true) {
          sendMessage(localizedText(msg("program.you_chose_yes")), "success");
        } else if (confirmed === false) {
          sendMessage(localizedText(msg("program.you_chose_no")), "info");
        }
      }
      if (event.action === "presentation-flow") await runPresentationFlow();
      if (event.action === "reset") {
        Object.assign(model, structuredClone(initial));
      }
      if (event.action === "save") {
        model.saveCount++;
        model.status = `Saved ${model.saveCount} time${
          model.saveCount === 1 ? "" : "s"
        }.`;
      }
      if (event.action === "download-file") {
        const file = new File(
          [
            localizedText(
              msg(
                "ui.hello_from_the_80_20_demo_form_this_is_a_small_example_text_file",
              ),
            ),
          ],
          "demo-example.txt",
          { type: "text/plain; charset=utf-8" },
        );
        nextDownload = {
          filename: file.name,
          contentType: file.type,
          body: file.stream(),
        };
      }
      if (event.action === "download-csv") {
        nextDownload = {
          filename: `calculations-${model.downloadRows}.csv`,
          contentType: "text/csv; charset=utf-8",
          body: calculationCsv(model.downloadRows),
        };
      }
      if (event.action === "message-single") {
        sendMessage(
          localizedText(msg("program.the_demo_sent_one_informational_message")),
        );
      }
      if (event.action === "message-types") sendMessageTypes();
      if (event.action === "message-markdown") sendMarkdownMessages();
      if (event.action === "message-async") {
        nextMessages = true;
      }
      if (event.action === "message-limits") {
        for (let sequence = 1; sequence <= 105; sequence++) {
          sendMessage(
            localizedText(
              msg("program.burst_message_sequence_of_105", {
                sequence: sequence,
              }),
            ),
            "info",
          );
        }
      }
    }
  } finally {
    asyncMessages.abort();
    await Promise.allSettled(pendingMessageRuns);
  }
}

async function confirmDecision(
  question: string,
): Promise<boolean | undefined> {
  return await presentModal(async () => {
    const event = await callScreen({
      id: "demo-confirm-decision",
      class: CONFIRM_CLASS,
      title: msg("program.confirm_choice"),
      description: question,
      schema: z.object({}),
      model: new Model({}),
      actions: [
        { id: "no", label: msg("program.no") },
        { id: "yes", label: msg("program.yes"), kind: "primary" },
      ],
    });
    if (event.action === "yes") return true;
    if (event.action === "no") return false;
    return undefined;
  });
}

async function runPresentationFlow(): Promise<void> {
  await presentModal(async () => {
    const model = {
      value: localizedText(
        msg("program.edit_this_before_the_background_redraw"),
      ),
      status: localizedText(msg("program.waiting_for_background_redraw")),
    };
    const screenModel1 = new Model(model);
    while (true) {
      const channel = nextScreenChannel();
      const redraw = setTimeout(() => {
        model.status = localizedText(
          msg("program.background_redraw_completed"),
        );
        channel.redraw();
      }, 800);
      let action: string;
      try {
        screenModel1.data = model;
        action = (await callScreen({
          id: "presentation-modal-b",
          title: msg("program.presentation_modal_b"),
          description: msg("program.this_ordinary_screen_is_running_in_a"),
          schema: PresentationScreen,
          model: screenModel1,
          actions: [
            { id: "open-modal", label: msg("program.open_nested_modal") },
            { id: "open-page", label: msg("program.open_page") },
          ],
          header: {
            actions: [{ id: "close", label: msg("program.close_modal") }],
          },
        })).action;
      } finally {
        clearTimeout(redraw);
      }
      if (action === BACK_EVENT || action === "close") return;
      if (action === "open-modal") {
        await presentModal(() =>
          presentationLeaf(localizedText(msg("program.presentation_modal_c")))
        );
      }
      if (action === "open-page") await runPresentationPage();
    }
  });
}

async function runPresentationPage(): Promise<void> {
  await presentPage(async () => {
    const model = {
      value: "Page D",
      status: localizedText(msg("program.ready")),
    };
    const screenModel2 = new Model(model);
    while (true) {
      screenModel2.data = model;
      const event = await callScreen({
        id: "presentation-page-d",
        title: msg("program.presentation_page_d"),
        description: msg("program.the_earlier_page_and_modal_remain_suspended"),
        schema: PresentationScreen,
        model: screenModel2,
        actions: [{ id: "open-modal", label: msg("program.open_modal_e") }],
      });
      if (event.action === BACK_EVENT) return;
      if (event.action === "open-modal") {
        await presentModal(() =>
          presentationLeaf(localizedText(msg("program.presentation_modal_e")))
        );
      }
    }
  });
}

async function presentationLeaf(title: string): Promise<void> {
  const model = { value: title, status: localizedText(msg("program.ready")) };
  const screenModel3 = new Model(model);
  while (true) {
    screenModel3.data = model;
    const event = await callScreen({
      id: "presentation-leaf",
      title,
      schema: PresentationScreen,
      model: screenModel3,
      header: { actions: [{ id: "close", label: msg("program.close_modal") }] },
    });
    if (event.action === BACK_EVENT || event.action === "close") return;
  }
}

function sendMessageTypes(): void {
  sendMessage(
    localizedText(msg("program.an_informational_update_is_available")),
    "info",
  );
  sendMessage(
    localizedText(msg("program.the_requested_operation_completed")),
    "success",
  );
  sendMessage(
    localizedText(msg("program.the_operation_needs_your_attention")),
    "warning",
  );
  sendMessage(
    localizedText(msg("program.the_operation_could_not_be_completed")),
    "error",
  );
}

function sendMarkdownMessages(): void {
  sendMessage(
    localizedText(
      msg("program.deployment_summary_the_release_completed_with_three"),
    ),
    "info",
  );
  sendMessage(
    localizedText(msg("program.a_short_success_card_is_stacked_underneath")),
    "success",
  );
  sendMessage(
    localizedText(
      msg("program.follow_up_validation_this_second_markdown_message"),
    ),
    "warning",
  );
  sendMessage(
    localizedText(msg("program.a_short_error_card_completes_the_alternating")),
    "error",
  );
}

async function sendAsyncMessages(
  output: MessageOutput,
  signal: AbortSignal,
): Promise<void> {
  const messages = [
    [localizedText(msg("program.the_background_task_started")), "info"],
    [
      localizedText(msg("program.the_background_task_reached_its_checkpoint")),
      "success",
    ],
    [
      localizedText(msg("program.the_background_task_finished_with_a_warning")),
      "warning",
    ],
  ] as const;
  for (const [body, kind] of messages) {
    if (!await waitForMessage(120, signal)) return;
    try {
      output.send(body, kind);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      throw error;
    }
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
