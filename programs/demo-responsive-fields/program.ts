import { BACK_EVENT, callScreen, field, Model, z } from "/p/the8020/uui/mod.ts";
import { demoFields } from "../../src/fields.ts";
import layout from "./layouts/main.json" with { type: "json" };

const ResponsiveFieldsScreen = z.object({
  honorific: field(demoFields.shape.honorific, {
    description: undefined,
    length: "short",
  }),
  firstName: field(demoFields.shape.firstName, { description: undefined }),
  lastName: demoFields.shape.lastName,
  employeeId: field(demoFields.shape.employeeId, {
    length: "short",
    readOnly: true,
  }),
  email: field(demoFields.shape.email, { length: "long" }),
  phone: demoFields.shape.phone,
  extension: field(demoFields.shape.extension, { length: "short" }),
  timeZone: demoFields.shape.timeZone,
  shortOne: field(demoFields.shape.sampleText, {
    label: "Short 1",
    description: undefined,
    length: "short",
  }),
  shortTwo: field(demoFields.shape.sampleText, {
    label: "Short 2",
    length: "short",
  }),
  shortThree: field(demoFields.shape.sampleText, {
    label: "Short 3",
    length: "short",
  }),
  shortFour: field(demoFields.shape.sampleText, {
    label: "Short 4",
    length: "short",
  }),
  mediumOne: field(demoFields.shape.sampleText, { label: "Medium 1" }),
  mediumTwo: field(demoFields.shape.sampleText, { label: "Medium 2" }),
  longOne: field(demoFields.shape.sampleText, {
    label: "Long 1",
    length: "long",
  }),
  longTwo: field(demoFields.shape.sampleText, {
    label: "Long 2",
    length: "long",
  }),
  username: field(demoFields.shape.username, {
    description:
      "This deliberately long hint proves that supporting field messages stay on one reserved line across neighboring cards.",
  }),
  role: field(demoFields.shape.roleDisplay, {
    description: undefined,
    length: "short",
  }),
  language: field(demoFields.shape.language, { description: undefined }),
  locale: field(demoFields.shape.locale, { length: "short" }),
  street: field(demoFields.shape.street, {
    description: undefined,
    length: "long",
  }),
  postalCode: field(demoFields.shape.postalCode, { length: "short" }),
  city: demoFields.shape.city,
  country: demoFields.shape.country,
  accent: field(demoFields.shape.accent, { length: "short" }),
  notifications: field(demoFields.shape.notifications, {
    length: "short",
  }),
  summary: field(demoFields.shape.summary, { length: "long" }),
  adaptiveOne: field(demoFields.shape.sampleText, {
    label: "Adaptive 1",
    description: undefined,
    length: "short",
  }),
  adaptiveTwo: field(demoFields.shape.sampleText, {
    label: "Adaptive 2",
    length: "short",
  }),
  adaptiveThree: field(demoFields.shape.sampleText, {
    label: "Adaptive 3",
    length: "short",
  }),
  adaptiveFour: field(demoFields.shape.sampleText, {
    label: "Adaptive 4",
    length: "short",
  }),
  adaptiveFive: field(demoFields.shape.sampleText, {
    label: "Adaptive 5",
    length: "short",
  }),
  adaptiveSix: field(demoFields.shape.sampleText, {
    label: "Adaptive 6",
    length: "short",
  }),
  adaptiveNote: field(demoFields.shape.sampleText, {
    label: "Following long field",
    length: "long",
  }),
  spanningNote: field(demoFields.shape.sampleText, {
    label: "Two-row note",
    control: "textarea",
    length: "long",
    rowSpan: 2,
    description:
      "The supporting-message slot participates in this field's two-row geometry.",
  }),
  spanningShortOne: field(demoFields.shape.sampleText, {
    label: "A deliberately long one-line short-field label",
    description: undefined,
    length: "short",
  }),
  spanningShortTwo: field(demoFields.shape.sampleText, {
    label: "Row 1 short B",
    length: "short",
  }),
  spanningLong: field(demoFields.shape.sampleText, {
    label: "Row 2 long field",
    length: "long",
  }),
});

const initial: z.infer<typeof ResponsiveFieldsScreen> = {
  honorific: "Mx",
  firstName: "Avery",
  lastName: "Morgan",
  employeeId: "EMP-1042",
  email: "avery.morgan@example.test",
  phone: "+1 555 0100",
  extension: "1042",
  timeZone: "UTC−05:00",
  shortOne: "One",
  shortTwo: "Two",
  shortThree: "Three",
  shortFour: "Four",
  mediumOne: "Medium one",
  mediumTwo: "Medium two",
  longOne: "A long field occupying half of a wide group",
  longTwo: "Another long field sharing the row",
  username: "avery.morgan",
  role: "Operator",
  language: "English",
  locale: "en-US",
  street: "200 Pareto Avenue",
  postalCode: "10101",
  city: "New York",
  country: "United States",
  accent: "Indigo",
  notifications: true,
  summary: "Four groups collapse from four columns to two and then one.",
  adaptiveOne: "One",
  adaptiveTwo: "Two",
  adaptiveThree: "Three",
  adaptiveFour: "Four",
  adaptiveFive: "Five",
  adaptiveSix: "Six",
  adaptiveNote:
    "The incomplete row distributes its unused width without layout-specific code.",
  spanningNote:
    "This textarea occupies the left half of two desktop grid rows.",
  spanningShortOne: "First",
  spanningShortTwo: "Second",
  spanningLong: "This field flows beside the textarea on its second row.",
};

export default async function responsiveFieldsDemo(): Promise<void> {
  const model = structuredClone(initial);
  const screenModel = new Model(model);
  while (true) {
    screenModel.data = model;
    const event = await callScreen({
      id: "demo-responsive-fields",
      title: "Responsive field layout demonstration",
      description:
        "Resize the screen to see semantic field lengths and field groups reflow without changing their order.",
      schema: ResponsiveFieldsScreen,
      model: screenModel,
      layout,
      header: {
        actions: [{
          id: "reset",
          label: "[[icon=refresh color=warning]] Reset",
        }],
      },
    });
    if (event.action === BACK_EVENT) return;
    if (event.action === "reset") {
      Object.assign(model, structuredClone(initial));
    }
  }
}
