import { assertEquals, assertThrows } from "@std/assert";
import {
  DirtyBindings,
  getPath,
  reconnectDelay,
  setPath,
  shouldAcceptServerMessage,
  shouldRenderMessage,
  synchronizeClientSequence,
} from "./model.ts";

Deno.test("frontend model binding and reconnect decisions are deterministic", () => {
  const model = { selected: { email: "old@example.com" } };
  assertEquals(getPath(model, "selected.email"), "old@example.com");
  setPath(model, "selected.email", "new@example.com");
  assertEquals(model.selected.email, "new@example.com");
  assertThrows(() => setPath(model, "missing.value", "x"), TypeError);
  assertEquals(shouldRenderMessage("session.resumed"), false);
  assertEquals(shouldRenderMessage("screen.show"), true);
  assertEquals(reconnectDelay(0, 250, 10_000), 250);
  assertEquals(reconnectDelay(10, 250, 10_000), 10_000);
  assertEquals(synchronizeClientSequence(0, 18), 18);
  assertEquals(synchronizeClientSequence(20, 18), 20);
  assertEquals(shouldAcceptServerMessage("screen.show", 5, 4), true);
  assertEquals(shouldAcceptServerMessage("screen.show", 4, 4), false);
  assertEquals(shouldAcceptServerMessage("session.end", 0, 42), true);
});

Deno.test("acknowledgements clear only edits included in the acknowledged event", () => {
  const dirty = new DirtyBindings();
  dirty.mark("email");
  const submitted = dirty.capture();
  dirty.mark("email");
  dirty.mark("biography");

  dirty.acknowledge(submitted);
  assertEquals(dirty.bindings(), ["email", "biography"]);

  dirty.acknowledge(dirty.capture());
  assertEquals(dirty.bindings(), []);
});
