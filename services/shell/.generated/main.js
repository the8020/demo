// packages/example/core-ui/services/shell/frontend/model.ts
function getPath(model2, path) {
  let current = model2;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return void 0;
    current = current[segment];
  }
  return current;
}
function setPath(model2, path, value) {
  if (model2 === null || typeof model2 !== "object") {
    throw new TypeError("screen model must be an object");
  }
  const segments = path.split(".");
  let current = model2;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (next === null || typeof next !== "object") {
      throw new TypeError(`unknown binding ${path}`);
    }
    current = next;
  }
  current[segments.at(-1)] = value;
}
function shouldAcceptServerMessage(type, sequence, lastSequence) {
  return sequence > lastSequence || sequence === 0 && (type === "session.end" || type === "session.error");
}
function synchronizeClientSequence(current, processed) {
  return processed === void 0 ? current : Math.max(current, processed);
}
function reconnectDelay(attempt, initial, maximum) {
  return Math.min(maximum, initial * 2 ** Math.max(0, attempt));
}
var DirtyBindings = class {
  #sequence = 0;
  #versions = /* @__PURE__ */ new Map();
  mark(bind) {
    this.#versions.set(bind, ++this.#sequence);
  }
  bindings() {
    return [
      ...this.#versions.keys()
    ];
  }
  capture() {
    return new Map(this.#versions);
  }
  acknowledge(snapshot) {
    for (const [bind, version] of snapshot) {
      if (this.#versions.get(bind) === version) this.#versions.delete(bind);
    }
  }
  clear() {
    this.#versions.clear();
  }
};

// packages/example/core-ui/services/shell/frontend/renderer.ts
function renderScreen(root, snapshot, model2, callbacks) {
  root.replaceChildren();
  const article = element("article", "screen");
  const heading = element("h1", "screen-title");
  heading.textContent = snapshot.title ?? snapshot.id;
  article.append(heading);
  if (snapshot.description) {
    const description = element("p", "screen-description");
    description.textContent = snapshot.description;
    article.append(description);
  }
  const controls = new Map(snapshot.controls.map((control) => [
    control.id,
    control
  ]));
  const byBind = /* @__PURE__ */ new Map();
  for (const control of snapshot.controls) {
    const values = byBind.get(control.bind) ?? [];
    values.push(control);
    byBind.set(control.bind, values);
  }
  if (isLayout(snapshot.layout)) {
    article.append(renderLayout(snapshot.layout.root, controls, byBind, snapshot.actions, model2, callbacks));
  } else {
    const stack = element("div", "layout-stack");
    for (const control of snapshot.controls) {
      const rendered = renderControl(control, model2, callbacks);
      if (rendered !== void 0) stack.append(rendered);
    }
    article.append(stack);
  }
  if (snapshot.actions.length > 0 && (!isLayout(snapshot.layout) || !containsNodeType(snapshot.layout.root, "actions"))) {
    article.append(renderActions(snapshot.actions, callbacks));
  }
  root.append(article);
}
function changesForBindings(model2, bindings) {
  return [
    ...new Set(bindings)
  ].map((bind) => ({
    bind,
    value: structuredClone(getPath(model2, bind))
  }));
}
function renderLayout(node, controls, byBind, actions, model2, callbacks) {
  const region = element(node.type === "section" ? "section" : "div", `layout-${node.type}`);
  region.dataset.layoutId = node.id;
  if (node.responsive === "stack") region.dataset.responsive = "stack";
  if (node.primary) region.dataset.regionPriority = "primary";
  if (node.secondary) region.dataset.regionPriority = "secondary";
  if (node.collapsed) region.dataset.collapsed = "true";
  if (node.minimumRegionWidth !== void 0) {
    region.style.setProperty("--minimum-region-width", `${node.minimumRegionWidth}px`);
  }
  if (node.ratio !== void 0) {
    region.style.setProperty("--split-ratio", node.ratio.map((part) => `${part}fr`).join(" "));
  }
  if (node.columns !== void 0) {
    region.style.setProperty("--grid-columns", String(node.columns));
  }
  if (node.title) {
    const title = element("h2", "region-title");
    title.textContent = node.title;
    region.append(title);
  }
  if (node.type === "list" && node.bind) {
    region.append(renderList(node, model2, callbacks));
  }
  if (node.type === "actions") {
    const selected = node.actions === void 0 ? actions : node.actions.map((id) => actions.find((action) => action.id === id)).filter((action) => action !== void 0);
    region.append(renderActions(selected, callbacks));
  }
  for (const controlID of node.controls ?? []) {
    const candidates = controls.get(controlID) === void 0 ? byBind.get(controlID) ?? [] : [
      controls.get(controlID)
    ];
    for (const control of candidates) {
      const rendered = renderControl(control, model2, callbacks);
      if (rendered !== void 0) region.append(rendered);
    }
  }
  if (node.type === "tabs" && node.children !== void 0) {
    const tabs = element("div", "tabs");
    const tabList = element("div", "tab-list");
    tabList.setAttribute("role", "tablist");
    const panels = element("div", "tab-panels");
    const selectedIndex = Math.max(0, node.children.findIndex((child) => child.id === node.selectedTab));
    node.children.forEach((child, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.role = "tab";
      button.textContent = child.title ?? child.id;
      const panel = renderLayout(child, controls, byBind, actions, model2, callbacks);
      panel.hidden = index !== selectedIndex;
      button.setAttribute("aria-selected", String(index === selectedIndex));
      button.addEventListener("click", () => {
        for (const item of panels.children) {
          item.hidden = item !== panel;
        }
        for (const item of tabList.children) {
          item.setAttribute("aria-selected", String(item === button));
        }
      });
      tabList.append(button);
      panels.append(panel);
    });
    tabs.append(tabList, panels);
    region.append(tabs);
  } else {
    for (const child of node.children ?? []) {
      region.append(renderLayout(child, controls, byBind, actions, model2, callbacks));
    }
  }
  return region;
}
function renderActions(actions, callbacks) {
  const container = element("nav", "screen-actions");
  container.setAttribute("aria-label", "Screen actions");
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.className = `button button-${action.kind ?? "secondary"}`;
    button.addEventListener("click", () => callbacks.action(action.id));
    container.append(button);
  }
  return container;
}
function containsNodeType(node, type) {
  return node.type === type || (node.children ?? []).some((child) => containsNodeType(child, type));
}
function renderList(node, model2, callbacks) {
  const rows = getPath(model2, node.bind);
  const table = document.createElement("table");
  table.className = "data-list";
  if (!Array.isArray(rows) || rows.length === 0) {
    const empty = document.createElement("caption");
    empty.textContent = "No items";
    table.append(empty);
    return table;
  }
  const columns = node.display ?? Object.keys(rows[0]);
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const column of columns) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = column;
    headRow.append(cell);
  }
  head.append(headRow);
  const body = document.createElement("tbody");
  for (const item of rows) {
    const row = document.createElement("tr");
    row.tabIndex = 0;
    const value = node.key === void 0 ? item : getPath(item, node.key);
    const select = () => callbacks.action("select", "select", value);
    row.addEventListener("click", select);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") select();
    });
    for (const column of columns) {
      const cell = document.createElement("td");
      cell.textContent = displayValue(getPath(item, column));
      row.append(cell);
    }
    body.append(row);
  }
  table.append(head, body);
  return table;
}
function renderControl(control, model2, callbacks) {
  if (control.hidden) return void 0;
  if (control.control === "radio") {
    return renderRadioControl(control, model2, callbacks);
  }
  const wrapper = element("div", "field");
  wrapper.dataset.group = control.group ?? "";
  const label = document.createElement("label");
  label.htmlFor = `control-${control.id}`;
  label.textContent = control.label ?? control.id;
  const value = getPath(model2, control.bind);
  let input;
  if (control.control === "textarea") {
    input = document.createElement("textarea");
    input.value = value == null ? "" : String(value);
  } else if (control.control === "select") {
    input = document.createElement("select");
    for (const option of control.options ?? []) {
      const item = document.createElement("option");
      item.value = String(option.value);
      item.textContent = option.label;
      item.selected = option.value === value;
      input.append(item);
    }
  } else {
    input = document.createElement("input");
    input.type = inputType(control.control);
    if (control.control === "checkbox" || control.control === "switch") {
      input.checked = Boolean(value);
      if (control.control === "switch") input.setAttribute("role", "switch");
    } else if (control.control === "file") {
      input.disabled = true;
    } else {
      input.value = value == null ? "" : String(value);
    }
  }
  input.id = `control-${control.id}`;
  input.dataset.bind = control.bind;
  if ("placeholder" in input) input.placeholder = control.placeholder ?? "";
  input.required = control.required ?? false;
  input.disabled ||= control.readOnly ?? false;
  input.addEventListener("input", () => {
    const next = inputValue(input, control.control);
    setPath(model2, control.bind, next);
    synchronizeBinding(control.bind, next, input);
    callbacks.changed(control.bind, next, control);
  });
  wrapper.append(label, input);
  if (control.description) {
    const description = element("small", "field-description");
    description.textContent = control.description;
    wrapper.append(description);
  }
  return wrapper;
}
function renderRadioControl(control, model2, callbacks) {
  const group = element("fieldset", "field field-radio");
  group.dataset.group = control.group ?? "";
  const legend = document.createElement("legend");
  legend.textContent = control.label ?? control.id;
  group.append(legend);
  const current = getPath(model2, control.bind);
  for (const [index, option] of (control.options ?? []).entries()) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = `control-${control.id}`;
    input.id = `control-${control.id}-${index}`;
    input.dataset.bind = control.bind;
    input.value = String(option.value);
    input.checked = option.value === current;
    input.disabled = control.readOnly ?? false;
    input.required = control.required ?? false;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      setPath(model2, control.bind, option.value);
      synchronizeBinding(control.bind, option.value, input);
      callbacks.changed(control.bind, option.value, control);
    });
    label.htmlFor = input.id;
    label.append(input, document.createTextNode(option.label));
    group.append(label);
  }
  if (control.description) {
    const description = element("small", "field-description");
    description.textContent = control.description;
    group.append(description);
  }
  return group;
}
function synchronizeBinding(bind, value, source) {
  for (const candidate of document.querySelectorAll("[data-bind]")) {
    if (candidate === source || candidate.dataset.bind !== bind) continue;
    if (candidate instanceof HTMLInputElement && candidate.type === "radio") {
      candidate.checked = candidate.value === String(value);
    } else if (candidate instanceof HTMLInputElement && candidate.type === "checkbox") {
      candidate.checked = Boolean(value);
    } else candidate.value = value == null ? "" : String(value);
  }
}
function inputValue(input, kind) {
  if (input instanceof HTMLInputElement && (kind === "checkbox" || kind === "switch")) return input.checked;
  if (kind === "number") return input.value === "" ? 0 : Number(input.value);
  return input.value;
}
function inputType(kind) {
  switch (kind) {
    case "email":
      return "email";
    case "number":
      return "number";
    case "checkbox":
    case "switch":
      return "checkbox";
    case "date":
      return "date";
    case "datetime":
      return "datetime-local";
    case "file":
      return "file";
    default:
      return "text";
  }
}
function displayValue(value) {
  if (value === null || value === void 0) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function element(tag, className) {
  const value = document.createElement(tag);
  value.className = className;
  return value;
}
function isLayout(value) {
  return value !== null && typeof value === "object" && value.schema === 1 && value.root !== void 0;
}

// packages/example/core-ui/services/shell/frontend/main.ts
var app = requiredElement("app");
var connectionState = requiredElement("connection-state");
var notice = requiredElement("notice");
var boot = JSON.parse(requiredElement("platform-boot").textContent ?? "");
var resumeKey = `platform.uui.resume:${boot.websocketUrl}`;
var resumeToken = sessionStorage.getItem(resumeKey);
var lastServerSequence = 0;
var clientSequence = 0;
var socket;
var reconnectAttempt = 0;
var ended = false;
var currentSessionID = "";
var screen;
var model = {};
var dirty = new DirtyBindings();
var pending = /* @__PURE__ */ new Map();
connect();
function connect() {
  if (ended) return;
  connectionState.textContent = "Connecting\u2026";
  const protocols = [
    "platform.uui.v1"
  ];
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
      lastServerSequence
    });
    for (const item of pending.values()) socket?.send(item.encoded);
  });
  socket.addEventListener("message", (event) => receive(event.data));
  socket.addEventListener("close", () => {
    if (ended) return;
    connectionState.textContent = "Reconnecting\u2026";
    const delay = reconnectDelay(reconnectAttempt++, boot.reconnectInitialDelay ?? 250, boot.reconnectMaximumDelay ?? 1e4);
    setTimeout(connect, delay);
  });
  socket.addEventListener("error", () => socket?.close());
}
function receive(raw) {
  if (typeof raw !== "string") return;
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    showNotice("The server sent an invalid message.");
    return;
  }
  if (typeof message.sessionId === "string") {
    currentSessionID = message.sessionId;
  }
  if (message.protocol !== boot.protocol || !shouldAcceptServerMessage(message.type, message.serverSequence, lastServerSequence)) return;
  lastServerSequence = Math.max(lastServerSequence, message.serverSequence);
  switch (message.type) {
    case "session.ready":
      resumeToken = message.resumeToken;
      sessionStorage.setItem(resumeKey, message.resumeToken);
      break;
    case "session.resumed":
      clientSequence = synchronizeClientSequence(clientSequence, message.lastClientSequence);
      connectionState.textContent = "Connected";
      break;
    case "session.resync_required":
      showResync(message.message ?? "This session needs a fresh screen snapshot.");
      break;
    case "session.ping":
      sendClient({
        type: "session.pong"
      });
      break;
    case "screen.show":
      notice.hidden = true;
      screen = message.screen;
      model = structuredClone(message.screen.model);
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
      if (message.clientSequence !== void 0) {
        for (const sequence of pending.keys()) {
          if (sequence <= message.clientSequence) {
            const item = pending.get(sequence);
            if (item !== void 0) dirty.acknowledge(item.dirty);
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
      socket?.close(1e3, "session ended");
      if (message.redirectUrl) location.assign(message.redirectUrl);
      else showNotice(message.message ?? "The session ended.");
      break;
  }
}
async function writeClipboard(text) {
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
function renderCurrentScreen() {
  if (screen === void 0) return;
  renderScreen(app, screen, model, {
    changed(bind, _value, control) {
      dirty.mark(bind);
      if (control.reactive) dispatch("change", "change", void 0, bind);
    },
    action(action, eventType = "action", value) {
      dispatch(action, eventType, value);
    }
  });
}
function dispatch(action, eventType, value, bind) {
  if (screen === void 0) return;
  sendClient({
    type: "screen.event",
    screenId: screen.id,
    screenRevision: screen.revision,
    action,
    eventType,
    value,
    bind,
    changes: changesForBindings(model, dirty.bindings())
  }, true);
}
function sendClient(payload, remember = false) {
  if (resumeToken === null) return;
  const message = {
    ...payload,
    protocol: boot.protocol,
    clientSequence: ++clientSequence,
    sessionId: currentSessionID,
    ...screen === void 0 ? {} : {
      screenId: screen.id,
      screenRevision: screen.revision
    }
  };
  const encoded = JSON.stringify(message);
  if (remember) {
    pending.set(message.clientSequence, {
      encoded,
      dirty: dirty.capture()
    });
  }
  if (socket?.readyState === WebSocket.OPEN) socket.send(encoded);
}
function send(value) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}
function showNotice(message) {
  notice.textContent = message;
  notice.hidden = false;
}
function showResync(message) {
  notice.replaceChildren(document.createTextNode(`${message} `));
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Reload current screen";
  button.addEventListener("click", () => {
    notice.hidden = true;
    sendClient({
      type: "client.ack",
      resync: true
    });
  });
  notice.append(button);
  notice.hidden = false;
}
function requiredElement(id) {
  const value = document.getElementById(id);
  if (value === null) throw new Error(`missing #${id}`);
  return value;
}
function base64URL(value) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
