import type { ScreenSnapshot, UUIServerMessage } from "@platform/uui";
import {
  DirtyBindings,
  reconnectDelay,
  shouldAcceptServerMessage,
  synchronizeClientSequence,
} from "./model.ts";
import { changesForBindings, renderScreen } from "./renderer.ts";

interface BootData {
  websocketUrl: string;
  protocol: number;
  heartbeatInterval?: number;
  reconnectInitialDelay?: number;
  reconnectMaximumDelay?: number;
  buildVersion?: string;
}

const app = requiredElement<HTMLElement>("app");
const connectionState = requiredElement<HTMLElement>("connection-state");
const notice = requiredElement<HTMLElement>("notice");
const boot = JSON.parse(
  requiredElement<HTMLScriptElement>("platform-boot").textContent ?? "",
) as BootData;
const resumeKey = `platform.uui.resume:${boot.websocketUrl}`;
let resumeToken = sessionStorage.getItem(resumeKey);
let lastServerSequence = 0;
let clientSequence = 0;
let socket: WebSocket | undefined;
let reconnectAttempt = 0;
let ended = false;
let currentSessionID = "";
let screen: ScreenSnapshot | undefined;
let model: Record<string, unknown> = {};
const dirty = new DirtyBindings();
const pending = new Map<
  number,
  { encoded: string; dirty: ReadonlyMap<string, number> }
>();

connect();

function connect(): void {
  if (ended) return;
  connectionState.textContent = "Connecting…";
  const protocols = ["platform.uui.v1"];
  if (resumeToken !== null) {
    protocols.push(`platform.resume.${base64URL(resumeToken)}`);
  }
  socket = new WebSocket(boot.websocketUrl, protocols);
  socket.addEventListener("open", () => {
    reconnectAttempt = 0;
    connectionState.textContent = "Connected";
    send({
      type: "session.connect",
      protocol: boot.protocol,
      resumeToken,
      lastServerSequence,
    });
    for (const item of pending.values()) socket?.send(item.encoded);
  });
  socket.addEventListener("message", (event) => receive(event.data));
  socket.addEventListener("close", () => {
    if (ended) return;
    connectionState.textContent = "Reconnecting…";
    const delay = reconnectDelay(
      reconnectAttempt++,
      boot.reconnectInitialDelay ?? 250,
      boot.reconnectMaximumDelay ?? 10_000,
    );
    setTimeout(connect, delay);
  });
  socket.addEventListener("error", () => socket?.close());
}

function receive(raw: unknown): void {
  if (typeof raw !== "string") return;
  let message: UUIServerMessage;
  try {
    message = JSON.parse(raw) as UUIServerMessage;
  } catch {
    showNotice("The server sent an invalid message.");
    return;
  }
  if (typeof message.sessionId === "string") {
    currentSessionID = message.sessionId;
  }
  if (
    message.protocol !== boot.protocol ||
    !shouldAcceptServerMessage(
      message.type,
      message.serverSequence,
      lastServerSequence,
    )
  ) return;
  lastServerSequence = Math.max(lastServerSequence, message.serverSequence);
  switch (message.type) {
    case "session.ready":
      resumeToken = message.resumeToken;
      sessionStorage.setItem(resumeKey, message.resumeToken);
      break;
    case "session.resumed":
      clientSequence = synchronizeClientSequence(
        clientSequence,
        message.lastClientSequence,
      );
      connectionState.textContent = "Connected";
      break;
    case "session.resync_required":
      showResync(
        message.message ?? "This session needs a fresh screen snapshot.",
      );
      break;
    case "session.ping":
      sendClient({ type: "session.pong" });
      break;
    case "screen.show":
      notice.hidden = true;
      screen = message.screen;
      model = structuredClone(message.screen.model) as Record<string, unknown>;
      dirty.clear();
      pending.clear();
      renderCurrentScreen();
      break;
    case "screen.close":
      if (screen?.id === message.screenId) app.replaceChildren();
      break;
    case "notification.show":
      showNotice(message.message);
      break;
    case "clipboard.write":
      void writeClipboard(message.text);
      break;
    case "server.ack":
      if (message.clientSequence !== undefined) {
        for (const sequence of pending.keys()) {
          if (sequence <= message.clientSequence) {
            const item = pending.get(sequence);
            if (item !== undefined) dirty.acknowledge(item.dirty);
            pending.delete(sequence);
          }
        }
      }
      break;
    case "session.error":
      showNotice(message.message ?? message.code ?? "Session error");
      break;
    case "session.end":
      ended = true;
      sessionStorage.removeItem(resumeKey);
      socket?.close(1000, "session ended");
      if (message.redirectUrl) location.assign(message.redirectUrl);
      else showNotice(message.message ?? "The session ended.");
      break;
  }
}

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    try {
      if (!document.execCommand("copy")) {
        showNotice("The browser did not allow copying the short dump.");
      }
    } finally {
      textarea.remove();
    }
  }
}

function renderCurrentScreen(): void {
  if (screen === undefined) return;
  renderScreen(app, screen, model, {
    changed(bind, _value, control) {
      dirty.mark(bind);
      if (control.reactive) dispatch("change", "change", undefined, bind);
    },
    action(action, eventType = "action", value) {
      dispatch(action, eventType, value);
    },
  });
}

function dispatch(
  action: string,
  eventType: "action" | "change" | "select",
  value?: unknown,
  bind?: string,
): void {
  if (screen === undefined) return;
  sendClient({
    type: "screen.event",
    screenId: screen.id,
    screenRevision: screen.revision,
    action,
    eventType,
    value,
    bind,
    changes: changesForBindings(model, dirty.bindings()),
  }, true);
}

function sendClient(payload: Record<string, unknown>, remember = false): void {
  if (resumeToken === null) return;
  const message = {
    ...payload,
    protocol: boot.protocol,
    clientSequence: ++clientSequence,
    sessionId: currentSessionID,
    ...(screen === undefined ? {} : {
      screenId: screen.id,
      screenRevision: screen.revision,
    }),
  };
  const encoded = JSON.stringify(message);
  if (remember) {
    pending.set(message.clientSequence, {
      encoded,
      dirty: dirty.capture(),
    });
  }
  if (socket?.readyState === WebSocket.OPEN) socket.send(encoded);
}

function send(value: unknown): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}

function showNotice(message: string): void {
  notice.textContent = message;
  notice.hidden = false;
}

function showResync(message: string): void {
  notice.replaceChildren(document.createTextNode(`${message} `));
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Reload current screen";
  button.addEventListener("click", () => {
    notice.hidden = true;
    sendClient({ type: "client.ack", resync: true });
  });
  notice.append(button);
  notice.hidden = false;
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (value === null) throw new Error(`missing #${id}`);
  return value as T;
}

function base64URL(value: string): string {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(
    /=+$/,
    "",
  );
}
