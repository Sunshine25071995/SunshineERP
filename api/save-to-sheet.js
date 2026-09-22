import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      jobCode,
      partyCode,
      micron,
      date,
      rollNo,
      coilSize,
      meter,
      grossWeight,
      coreWeight,
      netWeight,
    } = req.body;

    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    if (!sheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.log('Google Sheets credentials missing in .env');
      return res.status(500).json({ error: 'Server misconfigured: missing Google Sheets credentials.' });
    }

    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo(); 

    let sheet = doc.sheetsByTitle[jobCode];
    if (!sheet) {
      sheet = await doc.addSheet({ title: jobCode });
      await sheet.setHeaderRow([
        'Date',
        'Sr.No',
        'Size',
        'Meter',
        'Micron',
        'Gross Wt.',
        'Core Wt.',
        'Net Wt.',
        'Party Code'
      ]);
    }

    // Check for duplicate entry before adding to avoid duplicates!
    const rows = await sheet.getRows();
    const existing = rows.find(r => parseInt(r.get('Sr.No')) === parseInt(rollNo));
    if (existing) {
      return res.status(200).json({ success: true, message: 'Row already exists' });
    }

    await sheet.addRow({
      'Date': date,
      'Sr.No': rollNo,
      'Size': coilSize,
      'Meter': meter ? Math.ceil(Number(meter) / 10) * 10 : 0,
      'Micron': micron,
      'Gross Wt.': Number(grossWeight || 0).toFixed(3),
      'Core Wt.': Number(coreWeight || 0).toFixed(3),
      'Net Wt.': Number(netWeight || 0).toFixed(3),
      'Party Code': String(partyCode || '').padStart(3, '0')
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving to sheet:', error);
    res.status(500).json({ error: error.message });
  }
}
