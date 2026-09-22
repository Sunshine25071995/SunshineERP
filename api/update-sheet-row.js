import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { jobCode, partyCode, micron, date, rollNo, coilSize, meter, grossWeight, coreWeight, netWeight } = req.body;
    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    if (!sheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle[jobCode];
    if (sheet) {
      const rows = await sheet.getRows();
      const rowToUpdate = rows.find(r => parseInt(r.get('Sr.No')) === parseInt(rollNo));
      if (rowToUpdate) {
        rowToUpdate.set('Date', date);
        rowToUpdate.set('Size', coilSize);
        rowToUpdate.set('Meter', meter ? Math.ceil(Number(meter) / 10) * 10 : 0);
        rowToUpdate.set('Micron', micron);
        rowToUpdate.set('Gross Wt.', Number(grossWeight || 0).toFixed(3));
        rowToUpdate.set('Core Wt.', Number(coreWeight || 0).toFixed(3));
        rowToUpdate.set('Net Wt.', Number(netWeight || 0).toFixed(3));
        rowToUpdate.set('Party Code', String(partyCode || '').padStart(3, '0'));
        await rowToUpdate.save();
      }
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating sheet row:', error);
    res.status(500).json({ error: error.message });
  }
}
