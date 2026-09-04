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

/// What a column is for, worked out from what somebody called it.
///
/// A spreadsheet of a trip is not a list of places — it is a table where one
/// column happens to hold them. Taking the first column as the place is how
/// "August 3rd" becomes a street in Nevada and a header called "Date" becomes
/// a town in Hokkaido. Both of those really happened.
type Role = "what" | "where" | "day" | "time" | "category" | "note";

/// Matched on a prefix rather than exactly, which covers the plurals and the
/// typos — "Catagory" is a column name somebody actually used.
const COLUMN_ROLES: [string, Role][] = [
  ["agenda", "what"],
  ["activit", "what"],
  ["plan", "what"],
  ["place", "what"],
  ["name", "what"],
  ["restaurant", "what"],
  ["what", "what"],
  ["title", "what"],
  ["item", "what"],
  ["stop", "what"],
  ["event", "what"],

  ["location", "where"],
  ["where", "where"],
  ["city", "where"],
  ["town", "where"],
  ["address", "where"],
  ["area", "where"],
  ["country", "where"],
  ["region", "where"],

  ["date", "day"],
  ["day", "day"],

  ["time", "time"],
  ["start", "time"],
  ["when", "time"],

  ["categ", "category"],
  ["catag", "category"],
  ["type", "category"],
  ["tag", "category"],

  ["note", "note"],
  ["comment", "note"],
  ["detail", "note"],
  ["descri", "note"],
  ["info", "note"],
];

function roleOf(header: string): Role | null {
  const h = header.trim().toLowerCase();
  if (!h) return null;
  for (const [prefix, role] of COLUMN_ROLES) {
    if (h.startsWith(prefix)) return role;
  }
  return null;
}

/// A header row is one where the cells name columns rather than hold data. Two
/// recognisable names is enough — a table with "Date" and "Notes" in its first
/// row is not a table whose first entry is a place called Date.
function headerRoles(cells: string[]): (Role | null)[] | null {
  const roles = cells.map(roleOf);
  return roles.filter(Boolean).length >= 2 ? roles : null;
}

/// One row becomes one line: the first cell is the place, the rest is what
/// somebody wrote about it. Used when the columns are not named.
function rowToLine(cells: string[]) {
  const filled = cells.map((c) => c.trim()).filter(Boolean);
  if (filled.length === 0) return "";
  const [name, ...rest] = filled;
  return rest.length > 0 ? `${name} — ${rest.join(", ")}` : name!;
}

/// A spreadsheet whose columns say what they hold, read properly.
///
/// The place comes from the column that holds places, the day from the column
/// that holds dates, and the rest becomes the note — which is the difference
/// between importing an itinerary and importing a column of dates.
function fromNamedColumns(rows: string[][], roles: (Role | null)[]): string {
  const cell = (row: string[], role: Role) => {
    const at = roles.indexOf(role);
    return at === -1 ? "" : (row[at] ?? "").trim();
  };

  const lines: string[] = [];
  let day = 0;
  let lastDate: string | null = null;

  for (const row of rows) {
    if (!row.some((c) => c.trim())) continue;

    // A new date starts a new day, which is what makes an itinerary an
    // itinerary rather than a list.
    const date = cell(row, "day");
    if (date && date !== lastDate) {
      lastDate = date;
      day += 1;
      // Bare, with the date left off on purpose. "Day 1: Zürich" means the day
      // is in Zürich and the parser reads that label as a place — so "Day 1:
      // August 3rd" would make the 3rd of August a place, which is how a date
      // column ends up geocoded to a street called August.
      lines.push(`Day ${day}`);
    }

    const what = cell(row, "what");
    const where = cell(row, "where");
    // Without a column of places there is nothing to look up, so a row with no
    // "what" is skipped rather than guessed at.
    if (!what) continue;

    // The location joins the name so the geocoder gets "Lion Monument,
    // Lucerne" rather than "Lion Monument" and a note nobody reads.
    const title = where && !what.toLowerCase().includes(where.toLowerCase())
      ? `${what}, ${where}`
      : what;

    const notes = [cell(row, "category"), cell(row, "note")].filter(Boolean).join(", ");
    const time = cell(row, "time");

    lines.push(
      [time ? `${time} ` : "", title, notes ? ` — ${notes}` : ""].join(""),
    );
  }

  return lines.join("\n");
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
  if (usable.length === 0) return "";

  const roles = usable.length > 1 ? headerRoles(usable[0]!) : null;
  if (roles) return fromNamedColumns(usable.slice(1), roles);

  return usable.map(rowToLine).filter(Boolean).join("\n");
}

/// A spreadsheet cell as somebody would read it.
///
/// Times are the reason this exists. Excel keeps a time as a fraction of a day
/// counted from the 30th of December 1899, so a cell holding half past ten
/// comes back as a date in 1899 — and pasted into an itinerary it reads as
/// "Sat Dec 30 1899 10:35:00 GMT+0000", which is not a time anybody wrote.
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    const epochish = value.getUTCFullYear() <= 1900;
    const hh = String(value.getUTCHours()).padStart(2, "0");
    const mm = String(value.getUTCMinutes()).padStart(2, "0");

    // Sitting on Excel's epoch means the cell holds a time and nothing else.
    if (epochish) return `${hh}:${mm}`;

    const date = value.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    return hh === "00" && mm === "00" ? date : `${date} ${hh}:${mm}`;
  }

  if (typeof value === "object") {
    // Formulas, hyperlinks and rich text arrive as objects carrying the thing
    // somebody actually sees.
    const v = value as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    return "";
  }

  return String(value);
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
        cells.push(cellText(cell.value));
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
