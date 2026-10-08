import type { UUIMessage } from "/p/the8020/uui/messages.ts";
import { Model } from "/p/the8020/uui/mod.ts";
import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  BACK_EVENT,
  callScreen,
  UUI_PROTOCOL_VERSION,
  z,
} from "/p/the8020/uui/mod.ts";
import type {
  ScreenEventMessage,
  ScreenSnapshot,
  UUIClientMessage,
  UUIWorkerOutbound,
} from "/p/the8020/uui/mod.ts";
import { bindSession, type SessionChannel } from "/p/the8020/uui/internal.ts";
import { ChannelRouter } from "/p/the8020/uui/channel.ts";
import {
  DOWNLOAD_POLICY,
  downloadMetadata,
} from "/p/the8020/uui/download_metadata.ts";
import { connectChannels } from "/p/the8020/uui/session.ts";
import demoForm from "./demo-form/program.ts";
import masterDetail from "./demo-master-detail/program.ts";
import arkanoidDemo from "./demo-arkanoid/program.ts";
import responsiveFieldsDemo from "./demo-responsive-fields/program.ts";

interface WorkerScreenShow {
  surfaceId: string;
  screen: ScreenSnapshot;
}
type WorkerMessage = Pick<UUIMessage, "level" | "message">;

class ProgramChannel implements SessionChannel {
  readonly sessionId = "ui-session-program-test";
  #client: UUIClientMessage[] = [];
  #clientWaiters: Array<(message: UUIClientMessage) => void> = [];
  #server: UUIWorkerOutbound[] = [];
  #serverWaiters: Array<(message: UUIWorkerOutbound) => void> = [];
  #clientSequence = 0;
  #messageSequence = 0;
  #messages: WorkerMessage[] = [];
  #messageWaiters: Array<(message: WorkerMessage) => void> = [];

  constructor(
    readonly observe?: (message: UUIWorkerOutbound | Uint8Array) => void,
  ) {}

  send(message: UUIWorkerOutbound | Uint8Array): void {
    this.observe?.(message);
    if (message instanceof Uint8Array) return;
    const items = message.type === "presentation.show"
      ? message.presentation.messages ?? []
      : message.type === "channel.frame" && message.id === "append"
      ? [message.value as UUIMessage]
      : [];
    for (const item of items) {
      if (item.sequence <= this.#messageSequence) continue;
      this.#messageSequence = item.sequence;
      const value = { level: item.level, message: item.message };
      const receive = this.#messageWaiters.shift();
      if (receive) receive(value);
      else this.#messages.push(value);
    }
    const waiter = this.#serverWaiters.shift();
    if (waiter === undefined) this.#server.push(message);
    else waiter(message);
  }

  receive(): Promise<UUIClientMessage> {
    const message = this.#client.shift();
    if (message !== undefined) return Promise.resolve(message);
    return new Promise((resolve) => this.#clientWaiters.push(resolve));
  }

  async screen(): Promise<WorkerScreenShow> {
    while (true) {
      const message = await this.#nextServer();
      if (
        message.type === "presentation.show" &&
        message.presentation.activeSurfaceId !== null
      ) {
        const surface = message.presentation.surfaces.at(-1)!;
        return { surfaceId: surface.surfaceId, screen: surface.screen };
      }
    }
  }

  message(): Promise<WorkerMessage> {
    const item = this.#messages.shift();
    return item
      ? Promise.resolve(item)
      : new Promise((resolve) => this.#messageWaiters.push(resolve));
  }

  async messages(count: number): Promise<WorkerMessage[]> {
    const messages: WorkerMessage[] = [];
    for (let index = 0; index < count; index++) {
      messages.push(await this.message());
    }
    return messages;
  }

  event(
    screen: WorkerScreenShow,
    action: string,
    changes: ScreenEventMessage["changes"] = [],
  ): void {
    const message: ScreenEventMessage = {
      type: "screen.event",
      protocol: UUI_PROTOCOL_VERSION,
      clientSequence: ++this.#clientSequence,
      sessionId: this.sessionId,
      surfaceId: screen.surfaceId,
      screenId: screen.screen.id,
      screenRevision: screen.screen.revision,
      instanceId: screen.screen.state.instanceId,
      screenState: {
        version: screen.screen.state.version,
        scroll: screen.screen.state.scroll,
        elements: {},
      },
      action,
      eventType: action === BACK_EVENT ? BACK_EVENT : "action",
      changes,
    };
    this.input(message);
  }

  input(message: UUIClientMessage): void {
    const waiter = this.#clientWaiters.shift();
    if (waiter === undefined) this.#client.push(message);
    else waiter(message);
  }

  #nextServer(): Promise<UUIWorkerOutbound> {
    const message = this.#server.shift();
    if (message !== undefined) return Promise.resolve(message);
    return new Promise((resolve) => this.#serverWaiters.push(resolve));
  }
}

Deno.test("form program mutates its model and returns through Back", async () => {
  const channel = new ProgramChannel();
  const unbind = bindSession(channel);
  try {
    const running = demoForm();
    const initial = await channel.screen();
    for (const control of initial.screen.controls) {
      assert(
        control.label && control.description,
        `Missing field help: ${control.bind}`,
      );
    }
    assertEquals(
      initial.screen.title,
      "[[icon=edit color=primary]] Form and binding demonstration",
    );
    assertEquals(
      initial.screen.header.actions[0]?.label,
      "[[icon=save color=#ffffff]] Save",
    );
    assertEquals(
      initial.screen.controls.find((control) => control.id === "biography")
        ?.rowSpan,
      2,
    );
    channel.event(initial, "save", [{
      bind: "email",
      value: "changed@example.com",
    }]);
    const saved = await channel.screen();
    const model = saved.screen.model as Record<string, unknown>;
    assertEquals(model.email, "changed@example.com");
    assertEquals(model.saveCount, 1);
    assertEquals(model.status, "Saved 1 time.");
    channel.event(saved, BACK_EVENT);
    await running;
  } finally {
    unbind();
  }
});

Deno.test("form program demonstrates bounded, Markdown, and async messages", async () => {
  const channel = new ProgramChannel();
  const unbind = bindSession(channel);
  try {
    connectChannels("demo-messages");
    const running = demoForm();
    let screen = await channel.screen();
    assertEquals(
      screen.screen.actions.map((action) => action.id),
      [
        "confirm-choice",
        "presentation-flow",
        "message-single",
        "message-types",
        "message-markdown",
        "message-async",
        "message-limits",
        "download-file",
        "download-csv",
      ],
    );

    channel.event(screen, "message-single");
    assertEquals(await channel.message(), {
      level: "info",
      message: "The demo sent one informational message.",
    });
    screen = await channel.screen();

    channel.event(screen, "message-types");
    assertEquals(
      (await channel.messages(4)).map((message) => message.level),
      ["info", "success", "warning", "error"],
    );
    screen = await channel.screen();

    channel.event(screen, "message-markdown");
    const markdown = await channel.message();
    assertEquals(markdown.level, "info");
    assertEquals(markdown.message.includes("# Deployment summary"), true);
    assertEquals(markdown.message.includes("| Component | Result |"), true);
    assertEquals((await channel.message()).level, "success");
    const followUp = await channel.message();
    assertEquals(followUp.level, "warning");
    assertEquals(followUp.message.includes("## Follow-up validation"), true);
    assertEquals(followUp.message.includes("| Check | State |"), true);
    assertEquals((await channel.message()).level, "error");
    screen = await channel.screen();

    channel.event(screen, "message-async");
    screen = await channel.screen();
    assertEquals(
      (await channel.messages(3)).map((message) => message.level),
      ["info", "success", "warning"],
    );

    channel.event(screen, "message-limits");
    const burst = await channel.messages(100);
    assertEquals(burst[0]?.message, "Burst message 6 of 105.");
    assertEquals(burst.at(-1)?.message, "Burst message 105 of 105.");
    screen = await channel.screen();
    channel.event(screen, BACK_EVENT);
    await running;
  } finally {
    unbind();
  }
});

Deno.test("form downloads run in the background and capture the selected CSV size", async () => {
  const downloads = new Map<
    string,
    { contentType: string; stream: ReadableStream<Uint8Array> }
  >();
  const lifetimes = new Map<string, AbortController>();
  const browser = new ChannelRouter("client", (command) => {
    if (command instanceof Uint8Array) {
      throw new Error("This fixture only consumes downloads");
    }
    channel.input({
      ...command,
      protocol: UUI_PROTOCOL_VERSION,
      clientSequence: 0,
      sessionId: channel.sessionId,
    });
  });
  browser.connect("demo-download-test");
  const channel = new ProgramChannel((message) => {
    if (message instanceof Uint8Array) browser.bytes(message);
    else if (message.type === "channel.frame") browser.receive(message);
    else if (message.type === "presentation.show") {
      const screen = message.presentation.surfaces.at(-1)?.screen;
      if (!screen?.channelGeneration || !screen.downloadNamespace) return;
      if (!lifetimes.has(screen.channelGeneration)) {
        for (const lifetime of lifetimes.values()) lifetime.abort();
        lifetimes.clear();
        const lifetime = new AbortController();
        lifetimes.set(screen.channelGeneration, lifetime);
        const endpoint = browser.register(
          screen.downloadNamespace,
          screen.channelGeneration,
          () => {},
          lifetime.signal,
          DOWNLOAD_POLICY,
        );
        const metadata = new Map<
          string,
          ReturnType<typeof downloadMetadata.parse>
        >();
        endpoint.subscribe("*", async (id, data) => {
          if (id === "forget") {
            metadata.delete(String(data));
            return;
          }
          if (id === "save") {
            const description = data as { token: string };
            metadata.set(description.token, downloadMetadata.parse(data));
            return;
          }
          if (!(data instanceof ReadableStream)) return;
          const description = metadata.get(id)!;
          metadata.delete(id);
          downloads.set(description.filename, {
            contentType: description.contentType,
            stream: data,
          });
          contents.set(description.filename, await new Response(data).text());
        });
      }
    }
  });
  const contents = new Map<string, string>();
  const unbind = bindSession(channel);
  connectChannels("demo-download-test");
  const untilSaved = async (name: string) => {
    while (!contents.has(name)) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
  try {
    const running = demoForm();
    let screen = await channel.screen();
    const rows = screen.screen.controls.find((control) =>
      control.bind === "downloadRows"
    )!;
    assertEquals([rows.control, rows.minimum, rows.maximum, rows.step], [
      "range",
      1_000,
      1_000_000,
      1_000,
    ]);
    assertEquals(
      (screen.screen.model as { downloadRows: number }).downloadRows,
      100_000,
    );

    channel.event(screen, "download-file");
    screen = await channel.screen();
    await untilSaved("demo-example.txt");
    channel.event(screen, "download-csv", [{
      bind: "downloadRows",
      value: 25_000,
    }]);
    screen = await channel.screen();
    assertEquals(
      (screen.screen.model as { downloadRows: number }).downloadRows,
      25_000,
    );
    await untilSaved("calculations-25000.csv");
    // Completed saves survive subsequent full screen replacement.
    channel.event(screen, "reset");
    screen = await channel.screen();
    assertEquals(
      (screen.screen.model as { downloadRows: number }).downloadRows,
      100_000,
    );

    const file = downloads.get("demo-example.txt")!;
    assertEquals(file.contentType, "text/plain; charset=utf-8");
    assertEquals(
      contents.get("demo-example.txt"),
      "Hello from the 80|20 demo form!\n\nThis is a small example text file.\n",
    );
    const csv = downloads.get("calculations-25000.csv")!;
    assertEquals(csv.contentType, "text/csv; charset=utf-8");
    const lines = contents.get("calculations-25000.csv")!.trimEnd().split(
      "\r\n",
    );
    assertEquals(lines.length, 25_001);
    assertEquals(lines[0], "row,previous_total,total");
    assertEquals(lines.at(-1), "25000,312487500,312512500");
    channel.event(screen, BACK_EVENT);
    await running;
  } finally {
    browser.disconnect();
    unbind();
  }
});

Deno.test("form program presents a Yes/No confirmation and reports the choice", async () => {
  const channel = new ProgramChannel();
  const unbind = bindSession(channel);
  try {
    const running = demoForm();
    let form = await channel.screen();

    channel.event(form, "confirm-choice");
    let confirmation = await channel.screen();
    assertEquals(confirmation.screen.id, "demo-confirm-decision");
    assertEquals(confirmation.screen.title, "Confirm choice");
    assertEquals(
      confirmation.screen.description,
      "Would you like to continue?",
    );
    assertEquals(
      confirmation.screen.actions.map((action) => [
        action.id,
        action.label,
        action.kind,
      ]),
      [
        ["no", "No", undefined],
        ["yes", "Yes", "primary"],
      ],
    );
    channel.event(confirmation, "yes");
    assertEquals(await channel.message(), {
      level: "success",
      message: "You chose Yes.",
    });

    form = await channel.screen();
    channel.event(form, "confirm-choice");
    confirmation = await channel.screen();
    channel.event(confirmation, "no");
    assertEquals(await channel.message(), {
      level: "info",
      message: "You chose No.",
    });

    form = await channel.screen();
    channel.event(form, BACK_EVENT);
    await running;
  } finally {
    unbind();
  }
});

Deno.test("master-detail statically calls form and resumes its natural stack", async () => {
  const channel = new ProgramChannel();
  const unbind = bindSession(channel);
  try {
    const running = masterDetail();
    const master = await channel.screen();
    assertEquals(master.screen.id, "demo-master-detail");
    const orderList = master.screen.lists.find((item) =>
      item.bind === "orders"
    )!;
    assertEquals(orderList.rows.length, orderList.state.pageSize);
    assertEquals(orderList.totalItems, 60);
    assertEquals(orderList.state.measured, false);
    for (const column of orderList.columns) {
      assert(
        column.heading && column.description,
        `Missing order help: ${column.id}`,
      );
    }
    channel.event(master, "open-form");

    const child = await channel.screen();
    assertEquals(child.screen.id, "demo-form");
    channel.event(child, BACK_EVENT);

    const resumed = await channel.screen();
    assertEquals(resumed.screen.id, "demo-master-detail");
    channel.event(resumed, BACK_EVENT);
    await running;
  } finally {
    unbind();
  }
});

Deno.test("responsive field demo publishes semantic lengths and row spans", async () => {
  const channel = new ProgramChannel();
  const unbind = bindSession(channel);
  try {
    const running = responsiveFieldsDemo();
    const screen = await channel.screen();
    assertEquals(screen.screen.id, "demo-responsive-fields");
    assertEquals(
      screen.screen.controls.find((control) => control.bind === "firstName")
        ?.description,
      undefined,
    );
    assert(
      screen.screen.controls.find((control) => control.bind === "email")
        ?.description,
    );
    const lengths = new Map(
      screen.screen.controls.map((control) => [control.bind, control.length]),
    );
    assertEquals(lengths.get("honorific"), "short");
    assertEquals(lengths.get("firstName"), "medium");
    assertEquals(lengths.get("email"), "long");
    assertEquals(
      screen.screen.controls.find((control) =>
        control.bind === "spanningShortOne"
      )?.label,
      "A deliberately long one-line short-field label",
    );
    assertEquals(
      screen.screen.controls.find((control) => control.bind === "spanningNote")
        ?.rowSpan,
      2,
    );
    assertEquals(
      screen.screen.controls.find((control) => control.bind === "username")
        ?.description,
      "This deliberately long hint proves that supporting field messages stay on one reserved line across neighboring cards.",
    );
    assertEquals(
      screen.screen.controls.find((control) => control.bind === "spanningNote")
        ?.description,
      "The supporting-message slot participates in this field's two-row geometry.",
    );
    assertEquals(
      (screen.screen.layout as { root: { children: unknown[] } }).root.children
        .length,
      5,
    );
    assertEquals(screen.screen.actions, []);
    assertEquals(screen.screen.header.actions, [{
      id: "reset",
      label: "[[icon=refresh color=warning]] Reset",
    }]);
    channel.event(screen, BACK_EVENT);
    await running;
  } finally {
    unbind();
  }
});

Deno.test("demo exception actions escape to the session framework", async () => {
  const channel = new ProgramChannel();
  const unbind = bindSession(channel);
  try {
    const form = demoForm();
    const formScreen = await channel.screen();
    channel.event(formScreen, "throw-type-error");
    await assertRejects(
      () => form,
      TypeError,
      "intentionally raised an uncaught TypeError",
    );

    const master = masterDetail();
    const masterScreen = await channel.screen();
    channel.event(masterScreen, "throw-value-error");
    await assertRejects(() => master, Error, "order number 'ORD-0' is invalid");
  } finally {
    unbind();
  }
});

Deno.test("programs may retain ordinary class and closure state", async () => {
  class ClassProgram {
    #visits = 0;

    async run(): Promise<void> {
      const model = { visits: ++this.#visits };
      const event = await callScreen({
        id: "class-program",
        schema: z.object({ visits: z.number() }),
        model: new Model(model),
      });
      assertEquals(event.action, BACK_EVENT);
    }
  }
  const closureProgram = (): () => Promise<void> => {
    let visits = 0;
    return async () => {
      const model = { visits: ++visits };
      const event = await callScreen({
        id: "closure-program",
        schema: z.object({ visits: z.number() }),
        model: new Model(model),
      });
      assertEquals(event.action, BACK_EVENT);
    };
  };

  const channel = new ProgramChannel();
  const unbind = bindSession(channel);
  try {
    const classRunning = new ClassProgram().run();
    const classScreen = await channel.screen();
    assertEquals(classScreen.screen.model, { visits: 1 });
    channel.event(classScreen, BACK_EVENT);
    await classRunning;

    const closureRunning = closureProgram()();
    const closureScreen = await channel.screen();
    assertEquals(closureScreen.screen.model, { visits: 1 });
    channel.event(closureScreen, BACK_EVENT);
    await closureRunning;
  } finally {
    unbind();
  }
});

Deno.test("Arkanoid publishes local assets, bounded settings and a fresh run on Reset", async () => {
  const channel = new ProgramChannel();
  const unbind = bindSession(channel);
  try {
    const running = arkanoidDemo();
    const first = await channel.screen();
    assertEquals(first.screen.id, "demo-arkanoid");
    const component = first.screen.customElements[0]!;
    assertEquals(
      component.module,
      "/the8020/uui/shell/package-assets/the8020/demo/arkanoid.js",
    );
    assertEquals(component.preserve, true);
    assertEquals((first.screen.model as { ballSpeed: number }).ballSpeed, 260);
    assert(first.screen.actions.some((action) => action.id === "reset"));
    channel.event(first, "reset", [{ bind: "ballSpeed", value: 400 }]);
    const reset = await channel.screen();
    assertEquals((reset.screen.model as { ballSpeed: number }).ballSpeed, 400);
    assertEquals(reset.screen.customElements[0]!.config.settings, {
      ballSpeed: 400,
      paddleWidth: 100,
      paddleSpeed: 360,
      deadZone: 8,
    });
    assert(reset.screen.customElements[0]!.config.run !== component.config.run);
    channel.event(reset, BACK_EVENT);
    await running;
  } finally {
    unbind();
  }
});
