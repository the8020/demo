import { currentLocalization } from "/p/the8020/i18n/mod.ts";
import { msg } from "/p/the8020/demo/i18n/messages.ts";
import {
  BACK_EVENT,
  callScreen,
  Channel,
  field,
  Model,
  packageAssetURL,
  z,
} from "/p/the8020/uui/mod.ts";
import { controlStream } from "./controller.ts";
import { defaults } from "./state.ts";
import layout from "./layouts/main.json" with { type: "json" };

export const SettingsSchema = z.object({
  ballSpeed: field(z.number().min(100).max(600), {
    label: msg("program.ball_speed"),
    length: "short",
  }),
  paddleWidth: field(z.number().min(50).max(160), {
    label: msg("program.paddle_width"),
    length: "short",
  }),
  paddleSpeed: field(z.number().min(100).max(700), {
    label: msg("program.paddle_speed"),
    length: "short",
  }),
  deadZone: field(z.number().min(0).max(30), {
    label: msg("program.aim_dead_zone"),
    length: "short",
  }),
});

export default async function arkanoidDemo(): Promise<void> {
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
        title: msg("program.arkanoid_watch_the_controller_play"),
        description: msg("program.adjust_the_settings_then_reset_game_to"),
        schema: SettingsSchema,
        model,
        layout,
        actions: [{ id: "reset", label: msg("program.reset_game") }],
        customElements: [{
          id: "arkanoid",
          channel,
          preserve: true,
          module: packageAssetURL("the8020/demo", "arkanoid.js"),
          styles: [packageAssetURL("the8020/demo", "arkanoid.css")],
          config: {
            texts: Object.fromEntries(
              Object.entries(
                (await currentLocalization()?.bundle("the8020/demo"))?.texts ??
                  {},
              ).filter(([key]) =>
                key.startsWith("frontend.") || key.startsWith("console.")
              ),
            ),
            run,
            settings,
          },
        }],
      });
      if (event.action === BACK_EVENT) return;
    } finally {
      active?.abort();
      subscription.unsubscribe();
      channel.dispose();
    }
  }
}
