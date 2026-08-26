import type {
  ControlDescriptor,
  LayoutDocument,
  LayoutNode,
  ScreenAction,
  ScreenChange,
  ScreenSnapshot,
} from "@platform/uui";
import { getPath, setPath } from "./model.ts";

export interface RenderCallbacks {
  changed(bind: string, value: unknown, control: ControlDescriptor): void;
  action(
    action: string,
    eventType?: "action" | "select",
    value?: unknown,
  ): void;
}

export function renderScreen(
  root: HTMLElement,
  snapshot: ScreenSnapshot,
  model: Record<string, unknown>,
  callbacks: RenderCallbacks,
): void {
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
  const controls = new Map(
    snapshot.controls.map((control) => [control.id, control]),
  );
  const byBind = new Map<string, ControlDescriptor[]>();
  for (const control of snapshot.controls) {
    const values = byBind.get(control.bind) ?? [];
    values.push(control);
    byBind.set(control.bind, values);
  }
  if (isLayout(snapshot.layout)) {
    article.append(
      renderLayout(
        snapshot.layout.root,
        controls,
        byBind,
        snapshot.actions,
        model,
        callbacks,
      ),
    );
  } else {
    const stack = element("div", "layout-stack");
    for (const control of snapshot.controls) {
      const rendered = renderControl(control, model, callbacks);
      if (rendered !== undefined) stack.append(rendered);
    }
    article.append(stack);
  }
  if (
    snapshot.actions.length > 0 &&
    (!isLayout(snapshot.layout) ||
      !containsNodeType(snapshot.layout.root, "actions"))
  ) {
    article.append(renderActions(snapshot.actions, callbacks));
  }
  root.append(article);
}

export function changesForBindings(
  model: unknown,
  bindings: Iterable<string>,
): ScreenChange[] {
  return [...new Set(bindings)].map((bind) => ({
    bind,
    value: structuredClone(getPath(model, bind)),
  }));
}

function renderLayout(
  node: LayoutNode,
  controls: Map<string, ControlDescriptor>,
  byBind: Map<string, ControlDescriptor[]>,
  actions: ScreenAction[],
  model: Record<string, unknown>,
  callbacks: RenderCallbacks,
): HTMLElement {
  const region = element(
    node.type === "section" ? "section" : "div",
    `layout-${node.type}`,
  );
  region.dataset.layoutId = node.id;
  if (node.responsive === "stack") region.dataset.responsive = "stack";
  if (node.primary) region.dataset.regionPriority = "primary";
  if (node.secondary) region.dataset.regionPriority = "secondary";
  if (node.collapsed) region.dataset.collapsed = "true";
  if (node.minimumRegionWidth !== undefined) {
    region.style.setProperty(
      "--minimum-region-width",
      `${node.minimumRegionWidth}px`,
    );
  }
  if (node.ratio !== undefined) {
    region.style.setProperty(
      "--split-ratio",
      node.ratio.map((part) => `${part}fr`).join(" "),
    );
  }
  if (node.columns !== undefined) {
    region.style.setProperty("--grid-columns", String(node.columns));
  }
  if (node.title) {
    const title = element("h2", "region-title");
    title.textContent = node.title;
    region.append(title);
  }
  if (node.type === "list" && node.bind) {
    region.append(renderList(node, model, callbacks));
  }
  if (node.type === "actions") {
    const selected = node.actions === undefined
      ? actions
      : node.actions.map((id) => actions.find((action) => action.id === id)!)
        .filter((action) => action !== undefined);
    region.append(renderActions(selected, callbacks));
  }
  for (const controlID of node.controls ?? []) {
    const candidates = controls.get(controlID) === undefined
      ? byBind.get(controlID) ?? []
      : [controls.get(controlID)!];
    for (const control of candidates) {
      const rendered = renderControl(control, model, callbacks);
      if (rendered !== undefined) region.append(rendered);
    }
  }
  if (node.type === "tabs" && node.children !== undefined) {
    const tabs = element("div", "tabs");
    const tabList = element("div", "tab-list");
    tabList.setAttribute("role", "tablist");
    const panels = element("div", "tab-panels");
    const selectedIndex = Math.max(
      0,
      node.children.findIndex((child) => child.id === node.selectedTab),
    );
    node.children.forEach((child, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.role = "tab";
      button.textContent = child.title ?? child.id;
      const panel = renderLayout(
        child,
        controls,
        byBind,
        actions,
        model,
        callbacks,
      );
      panel.hidden = index !== selectedIndex;
      button.setAttribute("aria-selected", String(index === selectedIndex));
      button.addEventListener("click", () => {
        for (const item of panels.children) {
          (item as HTMLElement).hidden = item !== panel;
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
      region.append(
        renderLayout(child, controls, byBind, actions, model, callbacks),
      );
    }
  }
  return region;
}

function renderActions(
  actions: ScreenAction[],
  callbacks: RenderCallbacks,
): HTMLElement {
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

function containsNodeType(node: LayoutNode, type: LayoutNode["type"]): boolean {
  return node.type === type ||
    (node.children ?? []).some((child) => containsNodeType(child, type));
}

function renderList(
  node: LayoutNode,
  model: unknown,
  callbacks: RenderCallbacks,
): HTMLElement {
  const rows = getPath(model, node.bind!) as unknown;
  const table = document.createElement("table");
  table.className = "data-list";
  if (!Array.isArray(rows) || rows.length === 0) {
    const empty = document.createElement("caption");
    empty.textContent = "No items";
    table.append(empty);
    return table;
  }
  const columns = node.display ??
    Object.keys(rows[0] as Record<string, unknown>);
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
    const value = node.key === undefined ? item : getPath(item, node.key);
    const select = (): void => callbacks.action("select", "select", value);
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

function renderControl(
  control: ControlDescriptor,
  model: Record<string, unknown>,
  callbacks: RenderCallbacks,
): HTMLElement | undefined {
  if (control.hidden) return undefined;
  if (control.control === "radio") {
    return renderRadioControl(control, model, callbacks);
  }
  const wrapper = element("div", "field");
  wrapper.dataset.group = control.group ?? "";
  const label = document.createElement("label");
  label.htmlFor = `control-${control.id}`;
  label.textContent = control.label ?? control.id;
  const value = getPath(model, control.bind);
  let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
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
    setPath(model, control.bind, next);
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

function renderRadioControl(
  control: ControlDescriptor,
  model: Record<string, unknown>,
  callbacks: RenderCallbacks,
): HTMLElement {
  const group = element("fieldset", "field field-radio");
  group.dataset.group = control.group ?? "";
  const legend = document.createElement("legend");
  legend.textContent = control.label ?? control.id;
  group.append(legend);
  const current = getPath(model, control.bind);
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
      setPath(model, control.bind, option.value);
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

function synchronizeBinding(
  bind: string,
  value: unknown,
  source: Element,
): void {
  for (
    const candidate of document.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("[data-bind]")
  ) {
    if (candidate === source || candidate.dataset.bind !== bind) continue;
    if (candidate instanceof HTMLInputElement && candidate.type === "radio") {
      candidate.checked = candidate.value === String(value);
    } else if (
      candidate instanceof HTMLInputElement && candidate.type === "checkbox"
    ) {
      candidate.checked = Boolean(value);
    } else candidate.value = value == null ? "" : String(value);
  }
}

function inputValue(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  kind: ControlDescriptor["control"],
): unknown {
  if (
    input instanceof HTMLInputElement &&
    (kind === "checkbox" || kind === "switch")
  ) return input.checked;
  if (kind === "number") return input.value === "" ? 0 : Number(input.value);
  return input.value;
}

function inputType(kind: ControlDescriptor["control"]): string {
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

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag);
  value.className = className;
  return value;
}

function isLayout(value: unknown): value is LayoutDocument {
  return value !== null && typeof value === "object" &&
    (value as { schema?: unknown }).schema === 1 &&
    (value as { root?: unknown }).root !== undefined;
}
