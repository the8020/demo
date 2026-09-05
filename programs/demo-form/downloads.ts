/** Each yield contains at most 1,000 calculated rows, independent of export size. */
export async function* calculationCsv(
  rowCount: number,
): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  yield encoder.encode("row,previous_total,total\r\n");
  let total = 0;
  for (let first = 1; first <= rowCount; first += 1_000) {
    const lines: string[] = [];
    const end = Math.min(first + 1_000, rowCount + 1);
    for (let row = first; row < end; row++) {
      const previous = total;
      total += row;
      lines.push(`${row},${previous},${total}\r\n`);
    }
    yield encoder.encode(lines.join(""));
  }
}
