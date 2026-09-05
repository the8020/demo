import Customers from "../../tables/customers.ts";

interface ActivationContext {
  package_id: string;
  candidate_commit: string;
  activation_id: string;
}

export default async function postActivate(
  _state: Record<string, unknown>,
  context: Readonly<ActivationContext>,
) {
  if (
    context.package_id !== "the8020/demo" || context.candidate_commit === "" ||
    context.activation_id === ""
  ) {
    throw new Error("invalid demo activation context");
  }
  await Customers.insert({
    id: "activation-post",
    name: "Post-activation seed",
    email: "activation-post@example.test",
    profile: { tier: "standard", notes: "idempotent package seed" },
  }).onConflict((conflict) => conflict.column("id").doNothing()).execute();
}
