import { assertEquals, assertRejects } from "@std/assert";
import {
  discoverPrograms,
  invokeProgram,
  ProgramExecutionError,
  readProgramManifest,
  validProgramID,
} from "@platform/uui";

Deno.test("home discovers canonical visible program manifests", async () => {
  const root = new URL("../../../", import.meta.url).pathname;
  const programs = await discoverPrograms(root);
  assertEquals(
    programs.some((item) => item.id === "example/core-ui/demo-form"),
    true,
  );
  assertEquals(
    programs.some((item) => item.id === "example/core-ui/demo-master-detail"),
    true,
  );
  assertEquals(programs.some((item) => item.id === "core/uui/home"), false);
  assertEquals(
    programs.some((item) => item.id === "core/uui/program-terminated"),
    false,
  );
  const manifest = await readProgramManifest(
    new URL("../../../core/uui/programs/home/program.toml", import.meta.url)
      .pathname,
  );
  assertEquals(manifest.entrypoint, "program.ts");
  assertEquals(manifest.discoverable, false);
  assertEquals(validProgramID("example/core-ui/demo-form"), true);
  assertEquals(validProgramID("../core-ui/demo-form"), false);
  await assertRejects(
    () =>
      readProgramManifest(
        new URL("demo-form/layouts/main.json", import.meta.url).pathname,
      ),
    TypeError,
    "invalid program manifest",
  );
});

Deno.test("dynamic invocation validates identity, containment, and default export", async () => {
  const root = await Deno.makeTempDir({ prefix: "platform-program-test-" });
  try {
    const programRoot = `${root}/example/testing/programs`;
    await Deno.mkdir(`${programRoot}/working`, { recursive: true });
    await Deno.writeTextFile(
      `${programRoot}/working/program.toml`,
      'schema = 1\ndescription = "Working"\nentrypoint = "program.ts"\n',
    );
    await Deno.writeTextFile(
      `${programRoot}/working/program.ts`,
      "export default async function(input: unknown) { " +
        "(globalThis as Record<string, unknown>).programTestInput = input; return 'done'; }\n",
    );
    assertEquals(
      await invokeProgram("example/testing/working", { answer: 42 }, root),
      "done",
    );
    assertEquals(
      (globalThis as Record<string, unknown>).programTestInput,
      { answer: 42 },
    );

    await Deno.mkdir(`${programRoot}/missing-default`, { recursive: true });
    await Deno.writeTextFile(
      `${programRoot}/missing-default/program.toml`,
      'schema = 1\ndescription = "Missing"\nentrypoint = "program.ts"\n',
    );
    await Deno.writeTextFile(
      `${programRoot}/missing-default/program.ts`,
      "export const value = 1;\n",
    );
    await assertRejects(
      () => invokeProgram("example/testing/missing-default", undefined, root),
      ProgramExecutionError,
      "default-export a function",
    );

    await Deno.mkdir(`${programRoot}/escape`, { recursive: true });
    await Deno.writeTextFile(
      `${programRoot}/escape/program.toml`,
      'schema = 1\ndescription = "Escape"\nentrypoint = "../outside.ts"\n',
    );
    await assertRejects(
      () => invokeProgram("example/testing/escape", undefined, root),
      TypeError,
      "invalid program manifest",
    );
    await assertRejects(
      () => invokeProgram("../testing/working", undefined, root),
      TypeError,
      "namespace/repository/program",
    );
  } finally {
    await Deno.remove(root, { recursive: true });
    delete (globalThis as Record<string, unknown>).programTestInput;
  }
});
