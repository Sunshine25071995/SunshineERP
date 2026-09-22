import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid items array' });
    }

    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ error: 'Server misconfigured: missing Google Sheets credentials.' });
    }

    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();

    const groups = {};
    for (const item of items) {
      if (!groups[item.jobCode]) groups[item.jobCode] = [];
      groups[item.jobCode].push(item);
    }

    for (const [jobCode, groupItems] of Object.entries(groups)) {
      let sheet = doc.sheetsByTitle[jobCode];
      if (!sheet) {
        sheet = await doc.addSheet({ title: jobCode });
        await sheet.setHeaderRow([
          'Date', 'Sr.No', 'Size', 'Meter', 'Micron', 'Gross Wt.', 'Core Wt.', 'Net Wt.', 'Party Code'
        ]);
      }
      
      const existingRows = await sheet.getRows();
      const existingIds = new Set(existingRows.map(r => parseInt(r.get('Sr.No'))));
      
      const newRows = [];
      for (const item of groupItems) {
        if (!existingIds.has(parseInt(item.rollNo))) {
          newRows.push({
            'Date': item.date,
            'Sr.No': item.rollNo,
            'Size': item.coilSize,
            'Meter': item.meter ? Math.ceil(Number(item.meter) / 10) * 10 : 0,
            'Micron': item.micron,
            'Gross Wt.': Number(item.grossWeight || 0).toFixed(3),
            'Core Wt.': Number(item.coreWeight || 0).toFixed(3),
            'Net Wt.': Number(item.netWeight || 0).toFixed(3),
            'Party Code': String(item.partyCode || '').padStart(3, '0')
          });
        }
      }
      
      if (newRows.length > 0) {
        await sheet.addRows(newRows);
      }
    }

    res.status(200).json({ success: true, count: items.length });
  } catch (error) {
    console.error('Error in bulk sync:', error);
    res.status(500).json({ error: error.message });
  }
}
