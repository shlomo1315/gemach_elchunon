// תבנית מייל HTML ממותגת ל"זכרון אהרן" — RTL, אמרלד + זהב.
// משמשת את נקודת הקצה /api/notify. תואמת לקוחות מייל (Gmail/Outlook) — טבלאות + inline styles.

export type EmailRow = [label: string, value: string];

const ACCENTS = {
  green: { c: "#107a5e", bg: "#e3f6ec" },
  red: { c: "#d64545", bg: "#fdeaea" },
  gold: { c: "#a07a26", bg: "#f6edd5" },
  blue: { c: "#2563eb", bg: "#e8f0fe" },
} as const;

export function buildEmail(opts: {
  heading: string;
  intro?: string;
  rows: EmailRow[];
  amount?: string;
  accent?: keyof typeof ACCENTS;
  footnote?: string;
}): string {
  const accent = ACCENTS[opts.accent || "green"];
  const rowsHtml = opts.rows
    .filter(([, v]) => v != null && v !== "")
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:9px 0;color:#6b7688;font-size:14px;white-space:nowrap;vertical-align:top;width:38%;">${esc(label)}</td>
          <td style="padding:9px 0;color:#14203a;font-size:14px;font-weight:700;text-align:left;">${esc(value)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(16,30,54,.10);">

        <!-- פס זהב עליון -->
        <tr><td style="height:5px;background:linear-gradient(90deg,#a07a26,#e2c069,#a07a26);font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- כותרת ממותגת -->
        <tr><td style="background:linear-gradient(135deg,#15795f 0%,#0c5642 60%,#073d2e 100%);padding:26px 28px;" dir="rtl">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
              <div style="width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#e2c069,#c79a3e);text-align:center;line-height:46px;font-size:24px;color:#0c5642;border:1.5px solid rgba(255,255,255,.35);">&#9829;</div>
            </td>
            <td style="vertical-align:middle;padding-right:13px;">
              <div style="color:#ffffff;font-size:19px;font-weight:800;">גמ&quot;ח זכרון אהרן</div>
              <div style="color:#bfe3d5;font-size:12px;margin-top:2px;">מערכת ניהול</div>
            </td>
          </tr></table>
        </td></tr>

        <!-- גוף -->
        <tr><td style="padding:28px;" dir="rtl">
          <div style="display:inline-block;background:${accent.bg};color:${accent.c};font-size:13px;font-weight:700;padding:5px 13px;border-radius:999px;margin-bottom:14px;">${esc(opts.heading)}</div>
          ${opts.intro ? `<p style="margin:0 0 18px;color:#14203a;font-size:15px;line-height:1.6;">${esc(opts.intro)}</p>` : ""}

          ${opts.amount ? `
          <div style="background:${accent.bg};border-radius:14px;padding:16px 20px;margin-bottom:18px;text-align:center;">
            <div style="color:${accent.c};font-size:28px;font-weight:800;direction:ltr;">${esc(opts.amount)}</div>
          </div>` : ""}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eef2f7;">
            ${rowsHtml}
          </table>

          ${opts.footnote ? `<p style="margin:18px 0 0;color:#6b7688;font-size:13px;line-height:1.6;background:#f7f9fb;border-radius:10px;padding:12px 14px;">${esc(opts.footnote)}</p>` : ""}
        </td></tr>

        <!-- כותרת תחתונה -->
        <tr><td style="padding:18px 28px;border-top:1px solid #eef2f7;background:#fafbfc;" dir="rtl">
          <div style="color:#9aa5b5;font-size:12px;line-height:1.6;">הודעה אוטומטית ממערכת הניהול של גמ&quot;ח זכרון אהרן.<br>אין להשיב למייל זה.</div>
        </td></tr>

      </table>
      <div style="color:#b0bac7;font-size:11px;margin-top:14px;">גמ&quot;ח זכרון אהרן &middot; מערכת ניהול</div>
    </td></tr>
  </table>
</body>
</html>`;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
