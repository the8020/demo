import {
  BACK_EVENT,
  callScreen,
  Channel,
  field,
  Model,
  packageAssetURL,
  ScreenChannel,
  z,
} from "/p/the8020/uui/mod.ts";
import { controlStream } from "./controller.ts";
import { defaults } from "./state.ts";
import layout from "./layouts/main.json" with { type: "json" };

export const SettingsSchema = z.object({
  ballSpeed: field(z.number().min(100).max(600), {
    label: "Ball speed",
    length: "short",
  }),
  paddleWidth: field(z.number().min(50).max(160), {
    label: "Paddle width",
    length: "short",
  }),
  paddleSpeed: field(z.number().min(100).max(700), {
    label: "Paddle speed",
    length: "short",
  }),
  deadZone: field(z.number().min(0).max(30), {
    label: "Aim dead zone",
    length: "short",
  }),
});

export default async function arkanoidDemo(
  screen = new ScreenChannel(),
): Promise<void> {
  const model = new Model({ ...defaults });
  while (true) {
    const channel = new Channel();
    const run = crypto.randomUUID();
    const settings = SettingsSchema.parse(model.data);
    let active: AbortController | undefined;
    const subscription = channel.subscribe(
      "state",
      async (_id, data, context) => {
        if (!(data instanceof ReadableStream)) {
          throw new Error("Expected game state stream");
        }
        const output = channel.capture();
        active?.abort();
        const owner = active = new AbortController();
        try {
          await controlStream(
            data,
            output,
            AbortSignal.any([owner.signal, context.signal, output.signal]),
            settings,
            run,
          );
        } finally {
          if (active === owner) active = undefined;
        }
      },
    );
    try {
      const event = await callScreen({
        id: "demo-arkanoid",
        title: "Arkanoid · Watch the controller play",
        description:
          "Adjust the settings, then Reset game to start a new match.",
        schema: SettingsSchema,
        channel: screen,
        model,
        layout,
        actions: [{ id: "reset", label: "[[icon=refresh]] Reset game" }],
        customElements: [{
          id: "arkanoid",
          channel,
          preserve: true,
          module: packageAssetURL("the8020/demo", "arkanoid.js"),
          styles: [packageAssetURL("the8020/demo", "arkanoid.css")],
          config: { run, settings },
        }],
      });
      if (event.action === BACK_EVENT) return;
    } finally {
      active?.abort();
      subscription.unsubscribe();
    }
  }
}
