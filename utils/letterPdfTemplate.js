/**
 * generateLetterPdf(letter) → Buffer
 * Generates a PDF using pdfkit that mirrors the official letterhead layout.
 * Returns a Buffer so the caller can pipe it or attach it.
 */
import PDFDocument from 'pdfkit';

// ─── Colours (match LetterPreview.jsx) ────────────────────────
const PURPLE    = '#743fd5';
const DARK      = '#101828';
const GREY      = '#374151';
const LIGHTGREY = '#6b7282';
const SAFFRON   = '#ff9933';
const GREEN_IN  = '#138808';

// ─── Fonts (pdfkit ships with Helvetica, Times-Roman, Courier) ─
const SANS      = 'Helvetica';
const SANS_BOLD = 'Helvetica-Bold';
const SERIF     = 'Times-Roman';
const SERIF_BOLD= 'Times-Bold';
const MONO      = 'Courier';
const MONO_BOLD = 'Courier-Bold';

const MONTHS = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const PAGE_W   = 595.28;   // A4 width pts
const MARGIN_X = 72;       // ~1 inch
const CONTENT_W = PAGE_W - MARGIN_X * 2;

/**
 * @param {object} letter - letter row from DB
 * @returns {Promise<Buffer>}
 */
const generateLetterPdf = (letter) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end',  ()      => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const now     = letter.prepared_on ? new Date(letter.prepared_on) : new Date();
      const dateStr = `${String(now.getDate()).padStart(2,'0')} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
      const dayStr  = DAYS[now.getDay()];
      const refNo   = letter.letter_id || '';

      let y = 0;

      // ── TOP TRICOLOR BAR (7pt) ────────────────────────────────
      // Saffron section (10% of width)
      doc.rect(0, y, PAGE_W * 0.10, 7).fill(SAFFRON);
      // White section (60% of width)
      doc.rect(PAGE_W * 0.10, y, PAGE_W * 0.80, 7).fill('#ffffff');
      // Green section (10% of width)
      doc.rect(PAGE_W * 0.90, y, PAGE_W * 0.10, 7).fill(GREEN_IN);
      y += 7;

      // ── HEADER AREA ───────────────────────────────────────────
      const headerTop = y;
      y += 28;

      // Photo placeholder box
      const photoX = MARGIN_X;
      const photoW = 75;
      const photoH = 95;
      doc.rect(photoX, y, photoW, photoH).fill('#e8e8e8').stroke('#d4d4d4');
      doc.font(SANS).fontSize(7).fillColor('#aaaaaa')
         .text('MLA Photo', photoX, y + photoH / 2 - 4, { width: photoW, align: 'center' });

      // Header text
      const infoX = photoX + photoW + 18;
      const infoW = PAGE_W - infoX - MARGIN_X;
      doc.font(SANS_BOLD).fontSize(18).fillColor(DARK)
         .text('MLA Shibu Theckumpuram', infoX, y + 4, { width: infoW });
      doc.font(SANS_BOLD).fontSize(9).fillColor(PURPLE)
         .text('MLA OFFICE', infoX, y + 26, { width: infoW, characterSpacing: 1.2 });
      doc.font(SANS_BOLD).fontSize(9).fillColor(GREY)
         .text('Kothamangalam Constituency', infoX, y + 44, { width: infoW });
      doc.font(SANS).fontSize(8.5).fillColor(LIGHTGREY)
         .text('MLA Office, Near Town Hall, Kothamangalam,', infoX, y + 58, { width: infoW });
      doc.font(SANS).fontSize(8.5).fillColor(LIGHTGREY)
         .text('Ernakulam District, Kerala \u2013 686 691', infoX, y + 70, { width: infoW });

      y += photoH + 14;

      // ── Ref / Date / Day row ──────────────────────────────────
      doc.moveTo(MARGIN_X, y).lineTo(PAGE_W - MARGIN_X, y).stroke('#ececec');
      y += 10;

      doc.font(SANS_BOLD).fontSize(7.5).fillColor('#9ca3af')
         .text('REF NO: ', MARGIN_X, y, { continued: true })
         .font(MONO_BOLD).fontSize(8.5).fillColor(DARK)
         .text(refNo, { continued: false });

      doc.font(SANS_BOLD).fontSize(7.5).fillColor('#9ca3af')
         .text('DATE: ', MARGIN_X + 180, y, { continued: true })
         .font(SANS_BOLD).fontSize(8.5).fillColor(DARK)
         .text(dateStr, { continued: false });

      doc.font(SANS_BOLD).fontSize(7.5).fillColor('#9ca3af')
         .text('DAY: ', MARGIN_X + 360, y, { continued: true })
         .font(SANS_BOLD).fontSize(8.5).fillColor(DARK)
         .text(dayStr, { continued: false });

      y += 18;

      // ── Purple border under header ────────────────────────────
      doc.moveTo(MARGIN_X, y).lineTo(PAGE_W - MARGIN_X, y)
         .lineWidth(1.5).stroke(PURPLE);
      y += 20;

      // ── TO BLOCK ──────────────────────────────────────────────
      doc.font(SERIF_BOLD).fontSize(11).fillColor(DARK).text('To,', MARGIN_X, y);
      y += 16;
      doc.font(SERIF).fontSize(11).fillColor(DARK).text(letter.recipient_name || '', MARGIN_X, y, { width: CONTENT_W });
      y += 15;
      if (letter.recipient_designation) {
        doc.font(SERIF).fontSize(11).fillColor(DARK).text(letter.recipient_designation, MARGIN_X, y, { width: CONTENT_W });
        y += 15;
      }
      if (letter.recipient_org) {
        doc.font(SERIF).fontSize(11).fillColor(DARK).text(letter.recipient_org, MARGIN_X, y, { width: CONTENT_W });
        y += 15;
      }
      if (letter.recipient_address) {
        doc.font(SERIF).fontSize(10).fillColor(LIGHTGREY).text(letter.recipient_address, MARGIN_X, y, { width: CONTENT_W });
        y += doc.heightOfString(letter.recipient_address, { width: CONTENT_W, fontSize: 10 }) + 6;
      }
      y += 8;

      // ── SUBJECT ───────────────────────────────────────────────
      doc.font(SERIF_BOLD).fontSize(11).fillColor(DARK)
         .text('Subject: ', MARGIN_X, y, { continued: true, underline: true })
         .font(SERIF_BOLD).fontSize(11).fillColor(DARK)
         .text(letter.subject || '', { underline: false, continued: false });
      y += 22;

      // ── SALUTATION ────────────────────────────────────────────
      doc.font(SERIF).fontSize(11).fillColor(DARK).text(letter.salutation || 'Respected Sir,', MARGIN_X, y);
      y += 20;

      // ── BODY ─────────────────────────────────────────────────
      const bodyLines = (letter.body || '').split('\n');
      for (const line of bodyLines) {
        const text = line || '';
        const h = doc.heightOfString(text || ' ', { width: CONTENT_W, fontSize: 11, lineGap: 4 });
        // Page break guard
        if (y + h > 820) {
          doc.addPage({ size: 'A4', margin: 0 });
          y = 40;
        }
        doc.font(SERIF).fontSize(11).fillColor(GREY)
           .text(text || ' ', MARGIN_X, y, { width: CONTENT_W, align: 'justify', lineGap: 4 });
        y += h + 6;
      }
      y += 30;

      // ── CLOSING ───────────────────────────────────────────────
      doc.font(SERIF).fontSize(11).fillColor(DARK).text(letter.closing || 'Yours faithfully,', MARGIN_X, y);
      y += 55;

      // ── SIGNATURE ─────────────────────────────────────────────
      doc.font(SANS_BOLD).fontSize(10.5).fillColor(DARK).text('Shibu Theckumpuram', MARGIN_X, y);
      y += 14;
      doc.font(SANS).fontSize(9.5).fillColor(GREY).text('Member of Legislative Assembly', MARGIN_X, y);
      y += 13;
      doc.font(SANS_BOLD).fontSize(9.5).fillColor(PURPLE).text('Kothamangalam Constituency, Kerala', MARGIN_X, y);

      // Seal circle (right side)
      const sealX = PAGE_W - MARGIN_X - 50;
      const sealY = y - 30;
      doc.circle(sealX, sealY + 25, 28).lineWidth(1.5).dash(3, { space: 3 }).stroke('#d1d5db');
      doc.font(SANS).fontSize(5).fillColor('#d1d5db')
         .text('OFFICIAL SEAL', sealX - 18, sealY + 20, { width: 36, align: 'center', characterSpacing: 0.5 });
      doc.undash();

      y += 40;

      // ── FOOTER ────────────────────────────────────────────────
      const footerY = 780;
      doc.rect(0, footerY, PAGE_W, 60).fill('#f7f7f8');
      doc.moveTo(0, footerY).lineTo(PAGE_W, footerY).lineWidth(1).stroke('#e5e7eb');

      // Left: address
      doc.font(SANS_BOLD).fontSize(7.5).fillColor(GREY)
         .text('MLA Office, Kothamangalam Constituency', MARGIN_X, footerY + 10);
      doc.font(SANS).fontSize(7).fillColor(LIGHTGREY)
         .text('Near Town Hall, Kothamangalam, Ernakulam District', MARGIN_X, footerY + 21);
      doc.font(SANS).fontSize(7).fillColor(LIGHTGREY)
         .text('Kerala \u2013 686 691', MARGIN_X, footerY + 31);

      // Centre: Letter ID
      doc.font(SANS).fontSize(6.5).fillColor('#b0b0b0')
         .text(`Letter ID: ${refNo}`, PAGE_W / 2 - 40, footerY + 12, { width: 80, align: 'center', oblique: true });
      doc.font(SANS).fontSize(6).fillColor('#c4c4c4')
         .text('Issued via MLA Connect', PAGE_W / 2 - 40, footerY + 23, { width: 80, align: 'center' });

      // Right: phone + email
      doc.font(SANS_BOLD).fontSize(7.5).fillColor(GREY)
         .text('+91 484 000 0000', PAGE_W - MARGIN_X - 90, footerY + 10, { width: 90, align: 'right' });
      doc.font(SANS).fontSize(7).fillColor(PURPLE)
         .text('office@kothamangalammla.com', PAGE_W - MARGIN_X - 90, footerY + 23, { width: 90, align: 'right' });

      // ── BOTTOM TRICOLOR BAR ───────────────────────────────────
      doc.rect(0, 840 - 5, PAGE_W * 0.10, 5).fill(SAFFRON);
      doc.rect(PAGE_W * 0.10, 840 - 5, PAGE_W * 0.80, 5).fill('#ffffff');
      doc.rect(PAGE_W * 0.90, 840 - 5, PAGE_W * 0.10, 5).fill(GREEN_IN);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

export default generateLetterPdf;
