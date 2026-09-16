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
      'Meter': meter || 0,
      'Micron': micron,
      'Gross Wt.': grossWeight,
      'Core Wt.': coreWeight,
      'Net Wt.': netWeight,
      'Party Code': partyCode
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving to sheet:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
