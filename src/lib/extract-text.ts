/// Turning a file somebody already has into lines the importer can read.
///
/// The formats are the ones people actually keep lists in: a note, a Word
/// document, a spreadsheet. Google Docs and Sheets are not separate cases —
/// they download as .docx and .xlsx, and their paste is plain text.
///
/// Everything ends as lines, because that is what the itinerary parser reads
/// and what a person recognises when they see it in the box afterwards. The
/// point is not to be clever with structure: it is to get the words out
/// faithfully and let somebody confirm them.

export type Extracted = { text: string; note: string | null };

/// Headers, not places. A spreadsheet's first row usually names its columns,
/// and "Restaurant, City, Notes" is not a restaurant.
const HEADER_WORDS = new Set([
  "name",
  "place",
  "places",
  "restaurant",
  "restaurants",
  "city",
  "town",
  "country",
  "notes",
  "note",
  "day",
  "date",
  "category",
  "type",
  "address",
  "rating",
]);

function looksLikeHeaderRow(cells: string[]) {
  const words = cells.filter(Boolean).map((c) => c.trim().toLowerCase());
  if (words.length === 0) return false;
  const known = words.filter((w) => HEADER_WORDS.has(w)).length;
  return known >= Math.max(1, Math.ceil(words.length / 2));
}

/// One row becomes one line: the first cell is the place, the rest is what
/// somebody wrote about it.
function rowToLine(cells: string[]) {
  const filled = cells.map((c) => c.trim()).filter(Boolean);
  if (filled.length === 0) return "";
  const [name, ...rest] = filled;
  return rest.length > 0 ? `${name} — ${rest.join(", ")}` : name!;
}

/// Comma or tab separated, with quoted fields handled — a note or an address
/// with a comma in it is the normal case, not an edge one.
export function parseDelimited(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }

  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

function fromRows(rows: string[][]): string {
  const usable = rows.filter((r) => r.some((c) => c.trim()));
  const body = usable.length > 1 && looksLikeHeaderRow(usable[0]!) ? usable.slice(1) : usable;
  return body.map(rowToLine).filter(Boolean).join("\n");
}

export async function extractText(
  filename: string,
  bytes: Buffer,
): Promise<Extracted> {
  const name = filename.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".rtf")) {
    // RTF is not unpacked, only stripped of its control words — enough to read
    // a list out of, and it beats refusing the file.
    const raw = bytes.toString("utf8");
    const text = name.endsWith(".rtf")
      ? raw.replace(/\\[a-z]+-?\d* ?/gi, "").replace(/[{}]/g, "").trim()
      : raw;
    return { text, note: null };
  }

  if (name.endsWith(".csv") || name.endsWith(".tsv")) {
    const rows = parseDelimited(bytes.toString("utf8"), name.endsWith(".tsv") ? "\t" : ",");
    return { text: fromRows(rows), note: null };
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    return { text: value.trim(), note: null };
  }

  if (name.endsWith(".xlsx")) {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) return { text: "", note: "That spreadsheet has no sheets in it." };

    const rows: string[][] = [];
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push(cell.text ?? "");
      });
      rows.push(cells);
    });

    return {
      text: fromRows(rows),
      note:
        workbook.worksheets.length > 1
          ? `Read the first sheet, "${sheet.name}". The others were left alone.`
          : null,
    };
  }

  if (name.endsWith(".doc") || name.endsWith(".pages") || name.endsWith(".numbers")) {
    return {
      text: "",
      note:
        "That format cannot be read directly. Save it as .docx, .xlsx or .csv — or just paste the text in.",
    };
  }

  return {
    text: "",
    note: "That file type isn't supported. Try .docx, .xlsx, .csv, or paste the text in.",
  };
}
