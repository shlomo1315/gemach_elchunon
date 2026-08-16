// תבנית מייל HTML ממותגת ל"זכרון אהרן" — RTL, אמרלד + זהב.
// משמשת את נקודת הקצה /api/notify. תואמת לקוחות מייל (Gmail/Outlook) — טבלאות + inline styles.

export type EmailRow = [label: string, value: string];

const ACCENTS = {
  green: { c: "#107a5e", bg: "#e3f6ec" },
  red: { c: "#d64545", bg: "#fdeaea" },
  gold: { c: "#a07a26", bg: "#f6edd5" },
  blue: { c: "#2563eb", bg: "#e8f0fe" },
} as const;

/** סיכום היתרה של החבר, מוצג בתחתית המייל כדי שתהיה לו תמונה מלאה. */
export type BalanceSummary = {
  balance: string;                 // היתרה בפועל, מפורמטת
  pendingChecks?: string | null;   // סכום שיקים שטרם נפדו
  pendingCount?: number;           // כמה שיקים ממתינים
  projected?: string | null;       // יתרה צפויה לאחר פדיונם
};

export function buildEmail(opts: {
  heading: string;
  intro?: string;
  paragraphs?: string[];
  rows: EmailRow[];
  amount?: string;
  accent?: keyof typeof ACCENTS;
  footnote?: string;
  balance?: BalanceSummary | null;
  portalUrl?: string | null;
  portalEmail?: string | null;
}): string {
  const accent = ACCENTS[opts.accent || "green"];
  const rowsHtml = opts.rows
    .filter(([, v]) => v != null && v !== "")
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:9px 0;color:#6b7688;font-size:14px;white-space:nowrap;vertical-align:top;width:27%;text-align:right;">${esc(label)}</td>
          <td style="padding:9px 0;color:#14203a;font-size:14px;font-weight:700;text-align:right;">${esc(value)}</td>
        </tr>`
    )
    .join("");

  // --- סיכום יתרה ---
  const b = opts.balance;
  const balanceHtml = b
    ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:#f7f9fb;border:1px solid #eef2f7;border-radius:14px;">
            <tr><td style="padding:16px 18px;" dir="rtl">
              <div style="color:#6b7688;font-size:12px;font-weight:700;margin-bottom:10px;">סיכום היתרה שלך</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#14203a;font-size:14px;padding:4px 0;text-align:right;">היתרה שלך בגמ&quot;ח</td>
                  <td style="color:#107a5e;font-size:19px;font-weight:800;padding:4px 0;text-align:left;direction:ltr;">${esc(b.balance)}</td>
                </tr>
                ${b.pendingChecks ? `
                <tr>
                  <td style="color:#6b7688;font-size:13px;padding:4px 0;text-align:right;">צפוי להיזקף${b.pendingCount ? ` (${b.pendingCount} שיקים שטרם נפדו)` : ""}</td>
                  <td style="color:#a07a26;font-size:15px;font-weight:700;padding:4px 0;text-align:left;direction:ltr;">${esc(b.pendingChecks)}</td>
                </tr>` : ""}
                ${b.projected ? `
                <tr>
                  <td style="color:#14203a;font-size:13px;font-weight:700;padding:8px 0 0;text-align:right;border-top:1px solid #e6ebf1;">יתרה צפויה לאחר פדיון השיקים</td>
                  <td style="color:#107a5e;font-size:16px;font-weight:800;padding:8px 0 0;text-align:left;direction:ltr;border-top:1px solid #e6ebf1;">${esc(b.projected)}</td>
                </tr>` : ""}
              </table>
            </td></tr>
          </table>`
    : "";

  // --- פרטי גישה למערכת ---
  const accessHtml = opts.portalUrl
    ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border:1px solid #e6ebf1;border-radius:14px;">
            <tr><td style="padding:16px 18px;" dir="rtl">
              <div style="color:#14203a;font-size:13px;font-weight:800;margin-bottom:8px;">פרטי הגישה למערכת</div>
              <div style="color:#6b7688;font-size:13px;line-height:1.7;">
                גמ&quot;ח זכרון אהרן — אזור אישי<br>
                ${opts.portalEmail ? `שם משתמש: <span style="color:#14203a;font-weight:700;direction:ltr;display:inline-block;">${esc(opts.portalEmail)}</span><br>` : ""}
              </div>
              <div style="margin-top:12px;">
                <a href="${esc(opts.portalUrl)}" style="display:inline-block;background:#107a5e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:11px 22px;border-radius:10px;">כניסה לאזור האישי</a>
              </div>
              <div style="color:#9aa5b5;font-size:12px;margin-top:10px;line-height:1.6;">
                שכחת את הסיסמה? בדף הכניסה יש &quot;שכחתי סיסמה&quot; — יישלח אליך קוד זמני למייל.
              </div>
            </td></tr>
          </table>`
    : "";

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
              <div style="width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#e2c069,#c79a3e);text-align:center;line-height:46px;font-size:21px;font-weight:800;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#0c5642;border:1.5px solid rgba(255,255,255,.35);">ז&quot;א</div>
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
          ${(opts.paragraphs ?? [])
            .map(p => `<p style="margin:0 0 14px;color:#14203a;font-size:15px;line-height:1.7;">${esc(p)}</p>`)
            .join("")}

          ${opts.amount ? `
          <div style="background:${accent.bg};border-radius:14px;padding:16px 20px;margin-bottom:18px;text-align:center;">
            <div style="color:${accent.c};font-size:28px;font-weight:800;direction:ltr;">${esc(opts.amount)}</div>
          </div>` : ""}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eef2f7;">
            ${rowsHtml}
          </table>

          ${balanceHtml}

          ${accessHtml}

          ${opts.footnote ? `<p style="margin:18px 0 0;color:#6b7688;font-size:13px;line-height:1.6;background:#f7f9fb;border-radius:10px;padding:12px 14px;">${esc(opts.footnote)}</p>` : ""}
        </td></tr>

        <!-- כותרת תחתונה -->
        <tr><td style="padding:18px 28px;border-top:1px solid #eef2f7;background:#fafbfc;" dir="rtl">
          <div style="color:#9aa5b5;font-size:12px;line-height:1.6;">הודעה אוטומטית ממערכת הניהול של גמ&quot;ח זכרון אהרן.<br>ניתן להשיב למייל זה לכל שאלה.</div>
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
