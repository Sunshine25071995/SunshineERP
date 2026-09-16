import express from 'express';
import cors from 'cors';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Google Auth
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

app.post('/api/save-to-sheet', async (req, res) => {
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

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo(); // loads document properties and worksheets

    // Look for a sheet with the title of the Job Code, or create it
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

    // Add row
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

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving to sheet:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bulk-save-to-sheet', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid items array' });
    }

    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.log('Google Sheets credentials missing in .env');
      return res.status(500).json({ error: 'Server misconfigured: missing Google Sheets credentials.' });
    }

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();

    // Group items by jobCode
    const groups = {};
    for (const item of items) {
      if (!groups[item.jobCode]) groups[item.jobCode] = [];
      groups[item.jobCode].push(item);
    }

    // Process each group
    for (const [jobCode, groupItems] of Object.entries(groups)) {
      let sheet = doc.sheetsByTitle[jobCode];
      if (!sheet) {
        sheet = await doc.addSheet({ title: jobCode });
        await sheet.setHeaderRow([
          'Date', 'Sr.No', 'Size', 'Meter', 'Micron', 'Gross Wt.', 'Core Wt.', 'Net Wt.', 'Party Code'
        ]);
      }
      
      const rows = groupItems.map(item => ({
        'Date': item.date,
        'Sr.No': item.rollNo,
        'Size': item.coilSize,
        'Meter': item.meter ? Math.ceil(Number(item.meter) / 10) * 10 : 0,
        'Micron': item.micron,
        'Gross Wt.': Number(item.grossWeight || 0).toFixed(3),
        'Core Wt.': Number(item.coreWeight || 0).toFixed(3),
        'Net Wt.': Number(item.netWeight || 0).toFixed(3),
        'Party Code': String(item.partyCode || '').padStart(3, '0')
      }));
      
      await sheet.addRows(rows);
    }

    res.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Error in bulk sync:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/update-sheet-row', async (req, res) => {
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
    if (!sheetId) return res.status(500).json({ error: 'Missing GOOGLE_SHEET_ID' });

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
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating sheet row:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/delete-sheet-row', async (req, res) => {
  try {
    const { jobCode, rollNo } = req.body;
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) return res.status(500).json({ error: 'Missing GOOGLE_SHEET_ID' });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle[jobCode];
    if (sheet) {
      const rows = await sheet.getRows();
      const rowToDelete = rows.find(r => parseInt(r.get('Sr.No')) === parseInt(rollNo));
      if (rowToDelete) {
        await rowToDelete.delete();
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting sheet row:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
