import { choiceHelp, field, z } from "/p/the8020/db/fields.ts";
import { username } from "/p/the8020/users/types/user.ts";

export const demoFields = z.object({
  source: field(z.string(), {
    label: "Code",
    description: "Edit the sample TypeScript.",
  }),
  username: field(username.min(3), {
    label: "Username",
    description:
      "A sample username for this demonstration; it does not change a real account.",
    open: undefined,
    valueHelp: undefined,
  }),
  email: field(z.string().email(), {
    label: "Email",
    description: "Enter an email address, such as `avery@example.com`.",
  }),
  biography: field(z.string().optional(), {
    label: "Biography",
    description: "An optional introduction for this sample profile.",
  }),
  enabled: field(z.boolean(), {
    label: "Enabled",
    description: "Whether this sample profile is enabled.",
  }),
  role: field(z.enum(["administrator", "operator", "viewer"]), {
    label: "Role",
    description:
      "The role assigned to this sample profile. It does not grant system permissions.",
  }),
  roleDisplay: field(z.enum(["Admin", "Operator", "Viewer"]), {
    label: "Role",
    description:
      "The displayed role for this sample profile. It does not grant system permissions.",
  }),
  saveCount: field(z.number().int().nonnegative(), {
    label: "Save count",
    description:
      "The number of times Save has been used since opening or resetting this form.",
  }),
  status: field(z.string(), {
    label: "Status",
    description: "The result of the most recent form action.",
  }),
  downloadRows: field(
    z.number().int().min(1_000).max(1_000_000).multipleOf(1_000),
    {
      label: "CSV rows",
      description: "Each row adds its row number to the previous total.",
    },
  ),
  value: field(z.string(), {
    label: "Value",
    description:
      "Edit this sample value, then open and close the related pages or modals.",
  }),
  backgroundStatus: field(z.string(), {
    label: "Background status",
    description: "Whether the background update has completed.",
    valueHelp: choiceHelp(z.string(), [
      "Ready",
      "Waiting for background redraw",
      "Background redraw completed",
    ]),
  }),
  honorific: field(z.enum(["Mx", "Ms", "Mr", "Dr"]), {
    label: "Title",
    description: "The title used before this sample contact’s name.",
  }),
  firstName: field(z.string(), {
    label: "First name",
    description: "The given name of this sample contact.",
  }),
  lastName: field(z.string(), {
    label: "Last name",
    description: "The family name of this sample contact.",
  }),
  employeeId: field(z.string(), {
    label: "Employee ID",
    description: "The sample employee reference for this contact.",
  }),
  phone: field(z.string(), {
    label: "Phone",
    description:
      "A contact telephone number, including the country code when needed.",
  }),
  extension: field(z.string(), {
    label: "Extension",
    description: "The internal telephone extension for this contact.",
  }),
  timeZone: field(z.string(), {
    label: "Time zone",
    description: "The time zone or UTC offset used by this sample contact.",
    valueHelp: (request) =>
      choiceHelp(z.string(), ["UTC", ...Intl.supportedValuesOf("timeZone")])(
        request,
      ),
  }),
  language: field(z.enum(["English", "German", "Spanish"]), {
    label: "Language",
    description: "The preferred language for this sample contact.",
  }),
  locale: field(z.string(), {
    label: "Locale",
    description: "A language and region code, such as `en-US`.",
  }),
  street: field(z.string(), {
    label: "Street address",
    description: "The street and building number for this sample address.",
  }),
  postalCode: field(z.string(), {
    label: "Postal code",
    description: "The postal or ZIP code for this sample address.",
  }),
  city: field(z.string(), {
    label: "City",
    description: "The city or locality for this sample address.",
  }),
  country: field(z.string(), {
    label: "Country",
    description: "The country for this sample address.",
  }),
  accent: field(z.string(), {
    label: "Accent",
    description: "The preferred accent color for this sample profile.",
  }),
  notifications: field(z.boolean(), {
    label: "Notifications",
    description: "Whether this sample profile requests notifications.",
  }),
  summary: field(z.string(), {
    label: "Summary",
    description: "A short summary for this sample profile.",
  }),
  sampleText: field(z.string(), {
    label: "Sample text",
    description:
      "Edit this sample text and resize the window to compare the field layouts.",
  }),
});

export const customerFields = z.object({
  name: field(z.string(), {
    label: "Customer",
    description: "The customer’s name or organization.",
  }),
  email: demoFields.shape.email,
  enabled: field(z.boolean(), {
    label: "Enabled",
    description: "Whether this customer is enabled.",
  }),
});

export const orderFields = z.object({
  id: field(z.string(), {
    label: "Order ID",
    description: "The identifier of this sample order.",
  }),
  number: field(z.string(), {
    label: "Order number",
    description: "The reference shown when identifying this sample order.",
  }),
  customer: customerFields.shape.name,
  status: field(z.enum(["draft", "confirmed", "cancelled"]), {
    label: "Status",
    description:
      "Draft orders are being prepared; confirmed orders are accepted; cancelled orders are no longer active.",
  }),
});

export const orderSelection = orderFields.extend({
  status: field(orderFields.shape.status.extract(["draft", "confirmed"]), {
    label: "Status",
    description:
      "Draft orders are being prepared; confirmed orders are accepted. Use Change status to switch this sample order.",
  }),
});
