import { assertEquals, assertRejects } from "@std/assert";
import { callScreen, z } from "@platform/uui";
import type {
  ScreenEventMessage,
  UUIClientMessage,
  UUIWorkerOutbound,
} from "@platform/uui";
import { bindSession, type SessionChannel } from "@platform/uui/internal";
import demoForm from "./demo-form/program.ts";
import masterDetail from "./demo-master-detail/program.ts";

type WorkerScreenShow = Extract<UUIWorkerOutbound, { type: "screen.show" }>;

class ProgramChannel implements SessionChannel {
  readonly sessionId = "ui-session-program-test";
  #client: UUIClientMessage[] = [];
  #clientWaiters: Array<(message: UUIClientMessage) => void> = [];
  #server: UUIWorkerOutbound[] = [];
  #serverWaiters: Array<(message: UUIWorkerOutbound) => void> = [];
  #clientSequence = 0;

  send(message: UUIWorkerOutbound): void {
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
      const message = this.#server.shift() ?? await new Promise<
        UUIWorkerOutbound
      >((resolve) => this.#serverWaiters.push(resolve));
      if (message.type === "screen.show") return message;
    }
  }

  event(
    screen: WorkerScreenShow,
    action: string,
    changes: ScreenEventMessage["changes"] = [],
  ): void {
    const message: ScreenEventMessage = {
      type: "screen.event",
      protocol: 1,
      clientSequence: ++this.#clientSequence,
      sessionId: this.sessionId,
      screenId: screen.screen.id,
      screenRevision: screen.screen.revision,
      action,
      eventType: "action",
      changes,
    };
    const waiter = this.#clientWaiters.shift();
    if (waiter === undefined) this.#client.push(message);
    else waiter(message);
  }
}

Deno.test("form program mutates its model and returns through Back", async () => {
  const channel = new ProgramChannel();
  const unbind = bindSession(channel);
  try {
    const running = demoForm();
    const initial = await channel.screen();
    channel.event(initial, "save", [{
      bind: "email",
      value: "changed@example.com",
    }]);
    const saved = await channel.screen();
    const model = saved.screen.model as Record<string, unknown>;
    assertEquals(model.email, "changed@example.com");
    assertEquals(model.saveCount, 1);
    assertEquals(model.status, "Saved 1 time.");
    channel.event(saved, "back");
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
    channel.event(master, "open-form");

    const child = await channel.screen();
    assertEquals(child.screen.id, "demo-form");
    channel.event(child, "back");

    const resumed = await channel.screen();
    assertEquals(resumed.screen.id, "demo-master-detail");
    channel.event(resumed, "back");
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
        model,
        actions: [{ id: "back", label: "Back" }],
      });
      assertEquals(event.action, "back");
    }
  }
  const closureProgram = (): () => Promise<void> => {
    let visits = 0;
    return async () => {
      const model = { visits: ++visits };
      const event = await callScreen({
        id: "closure-program",
        schema: z.object({ visits: z.number() }),
        model,
        actions: [{ id: "back", label: "Back" }],
      });
      assertEquals(event.action, "back");
    };
  };

  const channel = new ProgramChannel();
  const unbind = bindSession(channel);
  try {
    const classRunning = new ClassProgram().run();
    const classScreen = await channel.screen();
    assertEquals(classScreen.screen.model, { visits: 1 });
    channel.event(classScreen, "back");
    await classRunning;

    const closureRunning = closureProgram()();
    const closureScreen = await channel.screen();
    assertEquals(closureScreen.screen.model, { visits: 1 });
    channel.event(closureScreen, "back");
    await closureRunning;
  } finally {
    unbind();
  }
});
