/** Escapes a value for RFC 4180 CSV. */
function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printTable(title: string, subtitle: string, headers: string[], rows: string[][]) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow pop-ups to print this report.");
    return;
  }
  const escHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8" />
<title>${escHtml(title)}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; color:#111; margin:32px; }
  h1 { font-size:18px; margin:0 0 4px; }
  p.sub { color:#555; font-size:12px; margin:0 0 20px; }
  table { border-collapse: collapse; width:100%; font-size:12px; }
  th { text-align:left; background:#f4f4f5; padding:8px 10px; border-bottom:2px solid #ddd; }
  td { padding:7px 10px; border-bottom:1px solid #eee; }
</style></head><body>
<h1>${escHtml(title)}</h1><p class="sub">${escHtml(subtitle)}</p>
<table><thead><tr>${headers.map((h) => `<th>${escHtml(h)}</th>`).join("")}</tr></thead>
<tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>
<script>window.onload = function(){ window.focus(); window.print(); };</script>
</body></html>`);
  w.document.close();
}
