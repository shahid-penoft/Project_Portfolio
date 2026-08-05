/**
 * buildLetterHtmlTemplate(letter)
 * Returns a complete <!DOCTYPE html> string that pixel-matches LetterPreview.jsx.
 *
 * Rules:
 *  - All CSS is inline (email clients strip <style> blocks)
 *  - All multi-column layouts use <table> (Gmail/Outlook strip flexbox)
 */

const MONTHS = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const buildLetterHtmlTemplate = (letter, templateConfig = null) => {
  const t = templateConfig || {
    mlaName: "MLA Shibu Theckumpuram",
    mlaTitle: "MLA Office",
    constituency: "Kothamangalam Constituency",
    addressLine1: "MLA Office, Near Town Hall, Kothamangalam,",
    addressLine2: "Ernakulam District, Kerala – 686 691",
    phone: "+91 484 000 0000",
    email: "office@kothamangalammla.com",
    showSeal: true,
    showPhoto: true,
    sealUrl: null,
    photoUrl: null,
  };

  const now      = letter.prepared_on ? new Date(letter.prepared_on) : new Date();
  const dateStr  = `${String(now.getDate()).padStart(2,'0')} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const dayStr   = DAYS[now.getDay()];
  const refNo    = letter.letter_id || 'KTML/----/----';

  // Body paragraphs — split on double newline or single newline
  const bodyParagraphs = letter.body
    ? letter.body.split(/\n\n|\n/).map(line =>
        `<p style="font-family:Georgia,'Palatino Linotype','Book Antiqua',serif;font-size:14px;color:#374151;margin:0 0 10px;line-height:1.9;text-align:justify;">${line || '&nbsp;'}</p>`
      ).join('')
    : '<p style="font-family:Georgia,serif;font-size:14px;color:#9ca3af;font-style:italic;">Letter content will appear here...</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${refNo} — ${letter.subject || 'Letter'}</title>
</head>
<body style="margin:0;padding:20px 0;background:#f3f4f6;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
    <tr>
      <td align="center">
        <table width="780" cellpadding="0" cellspacing="0" border="0"
               style="max-width:780px;background:#ffffff;border:1px solid #e0e0e0;font-family:Georgia,'Palatino Linotype','Book Antiqua',serif;">

          <!-- HEADER SECTION -->
          <tr>
            <td style="padding:36px 56px 28px;background:#743fd5;background:linear-gradient(135deg, #743fd5 0%, #5528b0 100%);">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Photo cell -->
                  ${t.showPhoto ? `<td valign="top" width="100"
                      style="width:100px;height:126px;border:1.5px solid #d4d4d4;border-radius:3px;background:linear-gradient(160deg,#f5f5f5 0%,#e8e8e8 100%);text-align:center;vertical-align:middle;overflow:hidden;">
                    ${t.photoUrl ? `<img src="${t.photoUrl}" width="100" height="126" style="width:100px;height:126px;object-fit:cover;display:block;" alt="MLA Photo"/>` : `<div style="width:54px;height:54px;border-radius:50%;background:#cccccc;margin:0 auto 6px;line-height:54px;font-size:28px;text-align:center;">&#128100;</div><span style="font-family:'Segoe UI',Arial,sans-serif;font-size:8px;color:#aaaaaa;letter-spacing:0.5px;">MLA Photo</span>`}
                  </td>
                  <td width="16"></td>` : ''}
                  <!-- Info cell -->
                  <td valign="top" style="padding-top:4px;">
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:22px;font-weight:800;color:#ffffff;margin:0 0 2px;letter-spacing:0.2px;line-height:1.15;">${t.mlaName}</p>
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:700;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 10px;">${t.mlaTitle}</p>
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;color:rgba(255,255,255,0.85);margin:0 0 2px;font-weight:600;">${t.constituency}</p>
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:11.5px;color:rgba(255,255,255,0.7);margin:0 0 1px;">${t.addressLine1}</p>
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:11.5px;color:rgba(255,255,255,0.7);margin:0;">${t.addressLine2}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Ref / Date / Day row -->
          <tr>
            <td style="padding:0 56px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="padding-top:14px;padding-bottom:14px;border-bottom:1px solid #e5e7eb;">
                <tr>
                  <td style="padding-right:28px;white-space:nowrap;">
                    <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">Ref No: </span>
                    <span style="font-family:'Courier New',Courier,monospace;font-size:12.5px;color:#101828;font-weight:700;letter-spacing:0.8px;">${refNo}</span>
                  </td>
                  <td style="padding-right:28px;white-space:nowrap;">
                    <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">Date: </span>
                    <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;color:#101828;font-weight:600;">${dateStr}</span>
                  </td>
                  <td style="white-space:nowrap;">
                    <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">Day: </span>
                    <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;color:#101828;font-weight:600;">${dayStr}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:30px 56px 42px;">

              <!-- To block -->
              <p style="font-family:Georgia,serif;font-size:14px;color:#101828;margin:0 0 3px;font-weight:700;">To,</p>
              <p style="font-family:Georgia,serif;font-size:14px;color:#101828;margin:0 0 2px;">${letter.recipient_name || 'Recipient Name'}</p>
              ${letter.recipient_designation ? `<p style="font-family:Georgia,serif;font-size:14px;color:#101828;margin:0 0 2px;">${letter.recipient_designation}</p>` : ''}
              ${letter.recipient_org ? `<p style="font-family:Georgia,serif;font-size:14px;color:#101828;margin:0 0 2px;">${letter.recipient_org}</p>` : ''}
              ${letter.recipient_address ? `<p style="font-family:Georgia,serif;font-size:13.5px;color:#6b7282;margin:2px 0 0;line-height:1.6;">${letter.recipient_address.replace(/\n/g,'<br/>')}</p>` : ''}

              <!-- Subject -->
              <p style="font-family:Georgia,serif;font-size:14px;color:#101828;margin:22px 0 24px;line-height:1.5;">
                <u><strong>Subject</strong></u>: <strong>${letter.subject || 'Letter Subject'}</strong>
              </p>

              <!-- Salutation -->
              <p style="font-family:Georgia,serif;font-size:14px;color:#101828;margin:0 0 18px;">${letter.salutation || 'Respected Sir,'}</p>

              <!-- Body -->
              <div style="margin-bottom:32px;">${bodyParagraphs}</div>

              <!-- Closing -->
              <p style="font-family:Georgia,serif;font-size:14px;color:#101828;margin:0 0 60px;">${letter.closing || 'Yours faithfully,'}</p>

              <!-- Signature block -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="bottom">
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:13.5px;font-weight:700;color:#101828;margin:0 0 1px;">${t.mlaName.replace('MLA ', '')}</p>
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;color:#374151;margin:0 0 1px;">Member of Legislative Assembly</p>
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;color:#035194;font-weight:600;margin:0;">${t.constituency}, Kerala</p>
                  </td>
                  ${t.showSeal ? `<td valign="bottom" align="right" width="80">
                    ${t.sealUrl ? `<div style="width:68px;height:68px;display:inline-block;text-align:center;line-height:68px;"><img src="${t.sealUrl}" style="max-width:68px;max-height:68px;vertical-align:middle;display:inline-block;" alt="Seal"/></div>` : `<div style="width:68px;height:68px;border-radius:50%;border:1.5px dashed #d1d5db;background:rgba(3,81,148,0.02);text-align:center;line-height:1;padding-top:14px;box-sizing:border-box;">
                      <div style="font-size:18px;color:#d1d5db;">&#128143;</div>
                      <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:6.5px;color:#d1d5db;text-transform:uppercase;letter-spacing:0.5px;margin-top:3px;">Official Seal</div>
                    </div>`}
                  </td>` : ''}
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:rgba(116, 63, 213, 0.03);border-top:1.5px solid rgba(116, 63, 213, 0.15);padding:13px 56px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Address -->
                  <td valign="middle">
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;color:#374151;font-weight:700;margin:0 0 2px;">${t.addressLine1}</p>
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;color:#6b7282;margin:0;">${t.addressLine2}</p>
                  </td>
                  <!-- Letter ID -->
                  <td valign="middle" align="center">
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:8.5px;color:#b0b0b0;margin:0 0 1px;font-style:italic;">
                      Letter ID: <span style="font-family:'Courier New',monospace;color:#9ca3af;">${refNo}</span>
                    </p>
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:8px;color:#c4c4c4;margin:0;">Issued via MLA Connect</p>
                  </td>
                  <!-- Contact -->
                  <td valign="middle" align="right">
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;color:#374151;font-weight:600;margin:0 0 2px;">${t.phone}</p>
                    <p style="font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#743fd5;margin:0;font-weight:600;">${t.email}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
};

export default buildLetterHtmlTemplate;
