import { assertEquals } from "@std/assert";
import { calculationCsv } from "./downloads.ts";

for (const rowCount of [100_000, 2_507]) {
  Deno.test(`calculation CSV streams ${rowCount} linked rows in batches of 1,000`, async () => {
    let row = 0;
    let batches = 0;
    let header = true;
    const decoder = new TextDecoder();
    for await (const chunk of calculationCsv(rowCount)) {
      const text = decoder.decode(chunk);
      if (header) {
        assertEquals(text, "row,previous_total,total\r\n");
        header = false;
        continue;
      }
      assertEquals(text.endsWith("\r\n"), true);
      const lines = text.slice(0, -2).split("\r\n");
      assertEquals(lines.length, Math.min(1_000, rowCount - row));
      for (const line of lines) {
        row++;
        // Closed-form sums verify the recurrence, including batch boundaries.
        assertEquals(
          line,
          `${row},${row * (row - 1) / 2},${row * (row + 1) / 2}`,
        );
      }
      batches++;
    }
    assertEquals(row, rowCount);
    assertEquals(batches, Math.ceil(rowCount / 1_000));
  });
}
