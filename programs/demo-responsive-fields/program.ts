import { BACK_EVENT, callScreen, field, z } from "@packages/the8020/uui/mod.ts";
import layout from "./layouts/main.json" with { type: "json" };

const ResponsiveFieldsScreen = z.object({
  honorific: field(z.enum(["Mx", "Ms", "Mr", "Dr"]), {
    label: "Title",
    length: "short",
  }),
  firstName: field(z.string(), { label: "First name" }),
  lastName: field(z.string(), { label: "Last name" }),
  employeeId: field(z.string(), {
    label: "Employee ID",
    length: "short",
    readOnly: true,
  }),
  email: field(z.string().email(), { label: "Email", length: "long" }),
  phone: field(z.string(), { label: "Phone" }),
  extension: field(z.string(), { label: "Extension", length: "short" }),
  timeZone: field(z.string(), { label: "Time zone" }),
  shortOne: field(z.string(), { label: "Short 1", length: "short" }),
  shortTwo: field(z.string(), { label: "Short 2", length: "short" }),
  shortThree: field(z.string(), { label: "Short 3", length: "short" }),
  shortFour: field(z.string(), { label: "Short 4", length: "short" }),
  mediumOne: field(z.string(), { label: "Medium 1" }),
  mediumTwo: field(z.string(), { label: "Medium 2" }),
  longOne: field(z.string(), { label: "Long 1", length: "long" }),
  longTwo: field(z.string(), { label: "Long 2", length: "long" }),
  username: field(z.string(), { label: "Username" }),
  role: field(z.enum(["Admin", "Operator", "Viewer"]), {
    label: "Role",
    length: "short",
  }),
  language: field(z.enum(["English", "German", "Spanish"]), {
    label: "Language",
  }),
  locale: field(z.string(), { label: "Locale", length: "short" }),
  street: field(z.string(), { label: "Street address", length: "long" }),
  postalCode: field(z.string(), { label: "Postal code", length: "short" }),
  city: field(z.string(), { label: "City" }),
  country: field(z.string(), { label: "Country" }),
  accent: field(z.string(), { label: "Accent", length: "short" }),
  notifications: field(z.boolean(), {
    label: "Notifications",
    length: "short",
  }),
  summary: field(z.string(), { label: "Summary", length: "long" }),
  adaptiveOne: field(z.string(), { label: "Adaptive 1", length: "short" }),
  adaptiveTwo: field(z.string(), { label: "Adaptive 2", length: "short" }),
  adaptiveThree: field(z.string(), {
    label: "Adaptive 3",
    length: "short",
  }),
  adaptiveFour: field(z.string(), { label: "Adaptive 4", length: "short" }),
  adaptiveFive: field(z.string(), { label: "Adaptive 5", length: "short" }),
  adaptiveSix: field(z.string(), { label: "Adaptive 6", length: "short" }),
  adaptiveNote: field(z.string(), {
    label: "Following long field",
    length: "long",
  }),
  spanningNote: field(z.string(), {
    label: "Two-row note",
    control: "textarea",
    length: "long",
    rowSpan: 2,
  }),
  spanningShortOne: field(z.string(), {
    label: "Row 1 short A",
    length: "short",
  }),
  spanningShortTwo: field(z.string(), {
    label: "Row 1 short B",
    length: "short",
  }),
  spanningLong: field(z.string(), {
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
  while (true) {
    const event = await callScreen({
      id: "demo-responsive-fields",
      title: "Responsive field layout demonstration",
      description:
        "Resize the screen to see semantic field lengths and field groups reflow without changing their order.",
      schema: ResponsiveFieldsScreen,
      model,
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
