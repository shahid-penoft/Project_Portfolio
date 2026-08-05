import PDFDocument from 'pdfkit';
import sharp from 'sharp';

const PRIMARY   = '#743fd5';
const DARK      = '#101828';
const GREY      = '#374151';
const LIGHTGREY = '#6b7282';

const SANS      = 'Helvetica';
const SANS_BOLD = 'Helvetica-Bold';
const SERIF     = 'Times-Roman';
const SERIF_BOLD= 'Times-Bold';
const MONO      = 'Courier';
const MONO_BOLD = 'Courier-Bold';

const MONTHS = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const PAGE_W   = 595.28;
const MARGIN_X = 72;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const fetchImageAsBuffer = async (url) => {
  try {
    if (!url) return null;
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      // It's a local dev URL, which fetch might struggle with or we don't care enough for PDF generation inside container.
      // We will skip local URLs for PDF template if needed, or handle it via actual fs if it was on disk.
      // But for now let's just attempt fetch.
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);
    const convertedBuffer = await sharp(originalBuffer).png().toBuffer();
    return convertedBuffer;
  } catch(e) {
    console.error('Failed to fetch/convert image:', e);
    return null;
  }
};

const generateCMFundsPdf = async (request, templateConfig = null) => {
  const t = templateConfig || {
    mlaName: 'MLA Shibu Theckumpuram',
    mlaTitle: 'MLA Office',
    constituency: 'Kothamangalam Constituency',
    addressLine1: 'MLA Office, Near Town Hall, Kothamangalam,',
    addressLine2: 'Ernakulam District, Kerala \u2013 686 691',
    phone: '+91 484 000 0000',
    email: 'office@kothamangalammla.com',
    showSeal: true,
    showPhoto: true,
    sealUrl: null,
    photoUrl: null,
  };

  let photoBuffer = null;
  if (t.showPhoto && t.photoUrl) {
      photoBuffer = await fetchImageAsBuffer(t.photoUrl);
  }

  let sealBuffer = null;
  if (t.showSeal && t.sealUrl) {
      sealBuffer = await fetchImageAsBuffer(t.sealUrl);
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end',  ()      => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const now     = request.created_at ? new Date(request.created_at) : new Date();
      const dateStr = `${String(now.getDate()).padStart(2,'0')} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
      const dayStr  = DAYS[now.getDay()];
      const refNo   = request.id || '';

      let y = 0;

      // ── HEADER AREA
      y += 36;

      const photoX = MARGIN_X;
      const photoW = 75;
      const photoH = 95;
      if (t.showPhoto) {
        if (photoBuffer) {
          doc.image(photoBuffer, photoX, y, { width: photoW, height: photoH, fit: [photoW, photoH], align: 'center', valign: 'center' });
        } else {
          doc.rect(photoX, y, photoW, photoH).fill('#e8e8e8').stroke('#d4d4d4');
          doc.font(SANS).fontSize(7).fillColor('#aaaaaa')
             .text('MLA Photo', photoX, y + photoH / 2 - 4, { width: photoW, align: 'center' });
        }
      }

      const infoX = t.showPhoto ? photoX + photoW + 18 : photoX;
      const infoW = PAGE_W - infoX - MARGIN_X;
      doc.font(SANS_BOLD).fontSize(18).fillColor(DARK)
         .text(t.mlaName, infoX, y + 4, { width: infoW });
      doc.font(SANS_BOLD).fontSize(9).fillColor(PRIMARY)
         .text(t.mlaTitle.toUpperCase(), infoX, y + 26, { width: infoW, characterSpacing: 1.2 });
      doc.font(SANS_BOLD).fontSize(9).fillColor(GREY)
         .text(t.constituency, infoX, y + 44, { width: infoW });
      doc.font(SANS).fontSize(8.5).fillColor(LIGHTGREY)
         .text(t.addressLine1, infoX, y + 58, { width: infoW });
      doc.font(SANS).fontSize(8.5).fillColor(LIGHTGREY)
         .text(t.addressLine2, infoX, y + 70, { width: infoW });

      y += photoH + 14;

      // ── Ref / Date / Day row
      doc.moveTo(MARGIN_X, y).lineTo(PAGE_W - MARGIN_X, y).stroke('#ececec');
      y += 10;

      doc.font(SANS_BOLD).fontSize(7.5).fillColor('#9ca3af')
         .text('APPLICATION NO: ', MARGIN_X, y, { continued: true })
         .font(MONO_BOLD).fontSize(8.5).fillColor(DARK)
         .text(refNo, { continued: false });

      doc.font(SANS_BOLD).fontSize(7.5).fillColor('#9ca3af')
         .text('APPLIED ON: ', MARGIN_X + 220, y, { continued: true })
         .font(SANS_BOLD).fontSize(8.5).fillColor(DARK)
         .text(dateStr, { continued: false });

      y += 18;
      doc.moveTo(MARGIN_X, y).lineTo(PAGE_W - MARGIN_X, y).lineWidth(1.5).stroke(PRIMARY);
      y += 20;

      // ── CONTENT ──
      doc.font(SERIF_BOLD).fontSize(14).fillColor(DARK)
         .text("Chief Minister's Distress Relief Fund (CMDRF)", MARGIN_X, y, { width: CONTENT_W, align: 'center' });
      y += 25;
      
      const drawField = (label, val, xOffset, yOffset, boldLabel=true) => {
         doc.font(boldLabel ? SANS_BOLD : SANS).fontSize(9).fillColor(LIGHTGREY).text(label, xOffset, yOffset);
         doc.font(SANS_BOLD).fontSize(10).fillColor(DARK).text(val || '-', xOffset, yOffset + 14, { width: (CONTENT_W/2)-20 });
      };

      // ROW 1
      drawField('Applicant Name', request.applicant_name, MARGIN_X, y);
      drawField('Phone Number', request.applicant_phone, MARGIN_X + (CONTENT_W/2), y);
      y += 35;

      // ROW 2
      drawField('Category', request.category_name, MARGIN_X, y);
      let amtStr = `Rs. ${request.amount_requested}`;
      if (request.status === 'Approved' || request.status === 'Disbursed') {
        amtStr += ` (Approved: Rs. ${request.approved_amount || 0})`;
      }
      drawField('Request Amount', amtStr, MARGIN_X + (CONTENT_W/2), y);
      y += 35;

      // ROW 3
      drawField('Aadhaar Number', request.aadhaar_number, MARGIN_X, y);
      drawField('Ration Card', request.ration_card_number, MARGIN_X + (CONTENT_W/2), y);
      y += 35;
      
      // ADDRESS
      doc.font(SANS_BOLD).fontSize(9).fillColor(LIGHTGREY).text('Address', MARGIN_X, y);
      const addr = [request.address_line1, request.address_line2, request.city, request.district, `${request.state} ${request.pincode}`].filter(Boolean).join(', ');
      doc.font(SANS_BOLD).fontSize(10).fillColor(DARK).text(addr, MARGIN_X, y + 14, { width: CONTENT_W });
      y += 35;

      // DETAILS
      doc.font(SANS_BOLD).fontSize(9).fillColor(LIGHTGREY).text('Description / Reason', MARGIN_X, y);
      y += 14;
      const descH = doc.heightOfString(request.description || '-', { width: CONTENT_W, fontSize: 10 });
      doc.font(SANS).fontSize(10).fillColor(DARK).text(request.description || '-', MARGIN_X, y, { width: CONTENT_W, align: 'justify' });
      y += descH + 15;

      // BANK DETAILS
      doc.moveTo(MARGIN_X, y).lineTo(PAGE_W - MARGIN_X, y).lineWidth(0.5).stroke('#ececec');
      y += 15;
      doc.font(SANS_BOLD).fontSize(11).fillColor(PRIMARY).text('Bank Account Details', MARGIN_X, y);
      y += 20;

      drawField('Bank Name', request.bank_name, MARGIN_X, y);
      drawField('Branch', request.branch, MARGIN_X + (CONTENT_W/2), y);
      y += 35;

      drawField('Account Holder', request.account_holder_name, MARGIN_X, y);
      drawField('Account Number', request.account_number, MARGIN_X + (CONTENT_W/2), y);
      y += 35;
      
      drawField('IFSC Code', request.ifsc_code, MARGIN_X, y);
      y += 45;

      // SIGNATURE
      doc.font(SANS_BOLD).fontSize(10.5).fillColor(DARK).text(t.mlaName.replace('MLA ', ''), MARGIN_X, y);
      y += 14;
      doc.font(SANS).fontSize(9.5).fillColor(GREY).text('Member of Legislative Assembly', MARGIN_X, y);
      y += 13;
      doc.font(SANS_BOLD).fontSize(9.5).fillColor(PRIMARY).text(`${t.constituency}, Kerala`, MARGIN_X, y);

      if (t.showSeal) {
        const sealX = PAGE_W - MARGIN_X - 50;
        const sealY = y - 30;
        if (sealBuffer) {
          doc.image(sealBuffer, sealX - 25, sealY, { width: 50, height: 50, fit: [50, 50], align: 'center', valign: 'center' });
        } else {
          doc.circle(sealX, sealY + 25, 28).lineWidth(1.5).dash(3, { space: 3 }).stroke('#d1d5db');
          doc.font(SANS).fontSize(5).fillColor('#d1d5db')
             .text('OFFICIAL SEAL', sealX - 18, sealY + 20, { width: 36, align: 'center', characterSpacing: 0.5 });
          doc.undash();
        }
      }

      y += 40;

      // ── FOOTER
      const footerY = 780;
      doc.rect(0, footerY, PAGE_W, 60).fill('#f7f7f8');
      doc.moveTo(0, footerY).lineTo(PAGE_W, footerY).lineWidth(1).stroke('#e5e7eb');

      doc.font(SANS_BOLD).fontSize(7.5).fillColor(GREY).text(t.addressLine1, MARGIN_X, footerY + 10);
      doc.font(SANS).fontSize(7).fillColor(LIGHTGREY).text(t.addressLine2, MARGIN_X, footerY + 21);

      doc.font(SANS).fontSize(6.5).fillColor('#b0b0b0')
         .text(`APP ID: ${refNo}`, PAGE_W / 2 - 40, footerY + 12, { width: 80, align: 'center', oblique: true });
      doc.font(SANS).fontSize(6).fillColor('#c4c4c4')
         .text('Issued via MLA Connect', PAGE_W / 2 - 40, footerY + 23, { width: 80, align: 'center' });

      doc.font(SANS_BOLD).fontSize(7.5).fillColor(GREY)
         .text(t.phone, PAGE_W - MARGIN_X - 90, footerY + 10, { width: 90, align: 'right' });
      doc.font(SANS).fontSize(7).fillColor(PRIMARY)
         .text(t.email, PAGE_W - MARGIN_X - 90, footerY + 23, { width: 90, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

export default generateCMFundsPdf;
