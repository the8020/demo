import { text as localizedText } from "/p/the8020/i18n/mod.ts";
import { msg } from "/p/the8020/demo/i18n/messages.ts";
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
    label: msg("program.short_1"),
    description: undefined,
    length: "short",
  }),
  shortTwo: field(demoFields.shape.sampleText, {
    label: msg("program.short_2"),
    length: "short",
  }),
  shortThree: field(demoFields.shape.sampleText, {
    label: msg("program.short_3"),
    length: "short",
  }),
  shortFour: field(demoFields.shape.sampleText, {
    label: msg("program.short_4"),
    length: "short",
  }),
  mediumOne: field(demoFields.shape.sampleText, {
    label: msg("program.medium_1"),
  }),
  mediumTwo: field(demoFields.shape.sampleText, {
    label: msg("program.medium_2"),
  }),
  longOne: field(demoFields.shape.sampleText, {
    label: msg("program.long_1"),
    length: "long",
  }),
  longTwo: field(demoFields.shape.sampleText, {
    label: msg("program.long_2"),
    length: "long",
  }),
  username: field(demoFields.shape.username, {
    description: msg(
      "program.this_deliberately_long_hint_proves_that_supporting",
    ),
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
    label: msg("program.adaptive_1"),
    description: undefined,
    length: "short",
  }),
  adaptiveTwo: field(demoFields.shape.sampleText, {
    label: msg("program.adaptive_2"),
    length: "short",
  }),
  adaptiveThree: field(demoFields.shape.sampleText, {
    label: msg("program.adaptive_3"),
    length: "short",
  }),
  adaptiveFour: field(demoFields.shape.sampleText, {
    label: msg("program.adaptive_4"),
    length: "short",
  }),
  adaptiveFive: field(demoFields.shape.sampleText, {
    label: msg("program.adaptive_5"),
    length: "short",
  }),
  adaptiveSix: field(demoFields.shape.sampleText, {
    label: msg("program.adaptive_6"),
    length: "short",
  }),
  adaptiveNote: field(demoFields.shape.sampleText, {
    label: msg("program.following_long_field"),
    length: "long",
  }),
  spanningNote: field(demoFields.shape.sampleText, {
    label: msg("program.two_row_note"),
    control: "textarea",
    length: "long",
    rowSpan: 2,
    description: msg(
      "program.the_supporting_message_slot_participates_in_this",
    ),
  }),
  spanningShortOne: field(demoFields.shape.sampleText, {
    label: msg("program.a_deliberately_long_one_line_short_field"),
    description: undefined,
    length: "short",
  }),
  spanningShortTwo: field(demoFields.shape.sampleText, {
    label: msg("program.row_1_short_b"),
    length: "short",
  }),
  spanningLong: field(demoFields.shape.sampleText, {
    label: msg("program.row_2_long_field"),
    length: "long",
  }),
});

function initial(): z.infer<typeof ResponsiveFieldsScreen> {
  return {
    honorific: "Mx",
    firstName: localizedText(msg("program.avery")),
    lastName: localizedText(msg("program.morgan")),
    employeeId: "EMP-1042",
    email: "avery.morgan@example.test",
    phone: "+1 555 0100",
    extension: "1042",
    timeZone: "UTC−05:00",
    shortOne: localizedText(msg("program.one")),
    shortTwo: localizedText(msg("program.two")),
    shortThree: localizedText(msg("program.three")),
    shortFour: localizedText(msg("program.four")),
    mediumOne: localizedText(msg("program.medium_one")),
    mediumTwo: localizedText(msg("program.medium_two")),
    longOne: "A long field occupying half of a wide group",
    longTwo: localizedText(msg("program.another_long_field_sharing_the_row")),
    username: "avery.morgan",
    role: "Operator",
    language: "English",
    locale: "en-US",
    street: "200 Pareto Avenue",
    postalCode: "10101",
    city: "New York",
    country: "United States",
    accent: localizedText(msg("program.indigo")),
    notifications: true,
    summary: localizedText(
      msg("program.four_groups_collapse_from_four_columns_to"),
    ),
    adaptiveOne: localizedText(msg("program.one")),
    adaptiveTwo: localizedText(msg("program.two")),
    adaptiveThree: localizedText(msg("program.three")),
    adaptiveFour: localizedText(msg("program.four")),
    adaptiveFive: localizedText(msg("program.five")),
    adaptiveSix: localizedText(msg("program.six")),
    adaptiveNote: localizedText(
      msg("program.the_incomplete_row_distributes_its_unused_width"),
    ),
    spanningNote: localizedText(
      msg("program.this_textarea_occupies_the_left_half_of"),
    ),
    spanningShortOne: localizedText(msg("program.first")),
    spanningShortTwo: localizedText(msg("program.second")),
    spanningLong: localizedText(
      msg("program.this_field_flows_beside_the_textarea_on"),
    ),
  };
}

export default async function responsiveFieldsDemo(): Promise<void> {
  const model = initial();
  const screenModel = new Model(model);
  while (true) {
    screenModel.data = model;
    const event = await callScreen({
      id: "demo-responsive-fields",
      title: msg("program.responsive_field_layout_demonstration"),
      description: msg("program.resize_the_screen_to_see_semantic_field"),
      schema: ResponsiveFieldsScreen,
      model: screenModel,
      layout,
      header: {
        actions: [{
          id: "reset",
          label: msg("program.reset_2"),
        }],
      },
    });
    if (event.action === BACK_EVENT) return;
    if (event.action === "reset") {
      Object.assign(model, initial());
    }
  }
}
