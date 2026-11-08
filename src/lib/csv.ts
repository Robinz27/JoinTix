// Downloads for Excel / Google Sheets. Server only.

const cell = (value: string | number) => {
  const text = String(value);
  // Quoted, and a leading = + - @ made harmless so a spreadsheet doesn't run it as a formula
  return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
};

export function csvResponse(filename: string, header: string[], rows: (string | number)[][]) {
  const lines = [header, ...rows].map((row) => row.map(cell).join(","));
  // The BOM makes Excel read the Thai as UTF-8
  return new Response(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
