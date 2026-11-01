import { msg } from "/p/the8020/demo/i18n/messages.ts";
import { choiceHelp, field, z } from "/p/the8020/db/fields.ts";
import { username } from "/p/the8020/users/types/user.ts";

export const demoFields = z.object({
  source: field(z.string(), {
    label: msg("fields.code"),
    description: msg("fields.edit_the_sample_typescript"),
  }),
  username: field(username.min(3), {
    label: msg("fields.username"),
    description: msg("fields.a_sample_username_for_this_demonstration_it"),
    open: undefined,
    valueHelp: undefined,
  }),
  email: field(z.string().email(), {
    label: msg("fields.email"),
    description: msg("fields.enter_an_email_address_such_as_avery"),
  }),
  biography: field(z.string().optional(), {
    label: msg("fields.biography"),
    description: msg("fields.an_optional_introduction_for_this_sample_profile"),
  }),
  enabled: field(z.boolean(), {
    label: msg("fields.enabled"),
    description: msg("fields.whether_this_sample_profile_is_enabled"),
  }),
  role: field(z.enum(["administrator", "operator", "viewer"]), {
    label: msg("fields.role"),
    description: msg("fields.the_role_assigned_to_this_sample_profile"),
  }),
  roleDisplay: field(z.enum(["Admin", "Operator", "Viewer"]), {
    label: msg("fields.role"),
    description: msg("fields.the_displayed_role_for_this_sample_profile"),
  }),
  saveCount: field(z.number().int().nonnegative(), {
    label: msg("fields.save_count"),
    description: msg("fields.the_number_of_times_save_has_been"),
  }),
  status: field(z.string(), {
    label: msg("fields.status"),
    description: msg("fields.the_result_of_the_most_recent_form"),
  }),
  downloadRows: field(
    z.number().int().min(1_000).max(1_000_000).multipleOf(1_000),
    {
      label: msg("fields.csv_rows"),
      description: msg("fields.each_row_adds_its_row_number_to"),
    },
  ),
  value: field(z.string(), {
    label: msg("fields.value"),
    description: msg("fields.edit_this_sample_value_then_open_and"),
  }),
  backgroundStatus: field(z.string(), {
    label: msg("fields.background_status"),
    description: msg("fields.whether_the_background_update_has_completed"),
    valueHelp: choiceHelp(z.string(), [
      "Ready",
      "Waiting for background redraw",
      "Background redraw completed",
    ]),
  }),
  honorific: field(z.enum(["Mx", "Ms", "Mr", "Dr"]), {
    label: msg("fields.title"),
    description: msg("fields.the_title_used_before_this_sample_contact"),
  }),
  firstName: field(z.string(), {
    label: msg("fields.first_name"),
    description: msg("fields.the_given_name_of_this_sample_contact"),
  }),
  lastName: field(z.string(), {
    label: msg("fields.last_name"),
    description: msg("fields.the_family_name_of_this_sample_contact"),
  }),
  employeeId: field(z.string(), {
    label: msg("fields.employee_id"),
    description: msg("fields.the_sample_employee_reference_for_this_contact"),
  }),
  phone: field(z.string(), {
    label: msg("fields.phone"),
    description: msg("fields.a_contact_telephone_number_including_the_country"),
  }),
  extension: field(z.string(), {
    label: msg("fields.extension"),
    description: msg(
      "fields.the_internal_telephone_extension_for_this_contact",
    ),
  }),
  timeZone: field(z.string(), {
    label: msg("fields.time_zone"),
    description: msg("fields.the_time_zone_or_utc_offset_used"),
    valueHelp: (request) =>
      choiceHelp(z.string(), ["UTC", ...Intl.supportedValuesOf("timeZone")])(
        request,
      ),
  }),
  language: field(z.enum(["English", "German", "Spanish"]), {
    label: msg("fields.language"),
    description: msg("fields.the_preferred_language_for_this_sample_contact"),
  }),
  locale: field(z.string(), {
    label: msg("fields.locale"),
    description: msg("fields.a_language_and_region_code_such_as"),
  }),
  street: field(z.string(), {
    label: msg("fields.street_address"),
    description: msg("fields.the_street_and_building_number_for_this"),
  }),
  postalCode: field(z.string(), {
    label: msg("fields.postal_code"),
    description: msg("fields.the_postal_or_zip_code_for_this"),
  }),
  city: field(z.string(), {
    label: msg("fields.city"),
    description: msg("fields.the_city_or_locality_for_this_sample"),
  }),
  country: field(z.string(), {
    label: msg("fields.country"),
    description: msg("fields.the_country_for_this_sample_address"),
  }),
  accent: field(z.string(), {
    label: msg("fields.accent"),
    description: msg("fields.the_preferred_accent_color_for_this_sample"),
  }),
  notifications: field(z.boolean(), {
    label: msg("fields.notifications"),
    description: msg(
      "fields.whether_this_sample_profile_requests_notifications",
    ),
  }),
  summary: field(z.string(), {
    label: msg("fields.summary"),
    description: msg("fields.a_short_summary_for_this_sample_profile"),
  }),
  sampleText: field(z.string(), {
    label: msg("fields.sample_text"),
    description: msg("fields.edit_this_sample_text_and_resize_the"),
  }),
});

export const customerFields = z.object({
  name: field(z.string(), {
    label: msg("fields.customer"),
    description: msg("fields.the_customer_s_name_or_organization"),
  }),
  email: demoFields.shape.email,
  enabled: field(z.boolean(), {
    label: msg("fields.enabled"),
    description: msg("fields.whether_this_customer_is_enabled"),
  }),
});

export const orderFields = z.object({
  id: field(z.string(), {
    label: msg("fields.order_id"),
    description: msg("fields.the_identifier_of_this_sample_order"),
  }),
  number: field(z.string(), {
    label: msg("fields.order_number"),
    description: msg("fields.the_reference_shown_when_identifying_this_sample"),
  }),
  customer: customerFields.shape.name,
  status: field(z.enum(["draft", "confirmed", "cancelled"]), {
    label: msg("fields.status"),
    description: msg("fields.draft_orders_are_being_prepared_confirmed_orders"),
  }),
});

export const orderSelection = orderFields.extend({
  status: field(orderFields.shape.status.extract(["draft", "confirmed"]), {
    label: msg("fields.status"),
    description: msg(
      "fields.draft_orders_are_being_prepared_confirmed_orders_2",
    ),
  }),
});
