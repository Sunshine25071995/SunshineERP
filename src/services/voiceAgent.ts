import { GoogleGenAI } from '@google/genai';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { PARTIES, getPartyName } from '../utils/parties';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

export type VoiceAction =
  | { type: 'add_production_roll'; jobCardId: string; grossWeight: number; coreWeight: number; joints: number; date: string }
  | { type: 'add_wastage'; jobCardId: string; wastageWeight: number; date: string }
  | { type: 'add_payment'; partyName: string; amount: number; mode: string }
  | { type: 'whatsapp_report'; partyName?: string; reportType: 'ledger' | 'daily' | 'summary' }
  | { type: 'navigate'; destination: 'payments' | 'production' | 'slitting' | 'admin' | 'home' }
  | { type: 'unknown'; message: string }
  | { type: 'confirm'; message: string };

export interface VoiceContext {
  currentUser: { loginId: string; shift: string | null; department: string };
  selectedJobCardId?: string;
  selectedJobCardCode?: string;
  jobCards: Array<{ id: string; jobCode: string; partyCode: string; status: string }>;
  paymentParties: Array<{ id: string; party_name: string }>;
}

const SYSTEM_PROMPT = `You are a voice assistant for Sunshine ERP — a factory management app for a plastic film manufacturing company.

App data:
- Departments: production, slitting, chemical, admin, payments
- Party codes: ${Object.entries(PARTIES).map(([k, v]) => `${k}=${v}`).join(', ')}
- Roll weights are in kg with 3 decimal places (e.g. 67.500)
- "Core" is the cardboard center of a roll, typically ~5-6 kg

Your job: Parse user's voice command (in Hindi or English or mix) and return a STRICT JSON object representing the action.

RESPONSE FORMAT — always return ONLY JSON, no text outside JSON:
{
  "type": "<action_type>",
  ... action-specific fields
}

Action types:
1. add_production_roll: { "type": "add_production_roll", "grossWeight": 67.5, "coreWeight": 5.5, "joints": 0, "date": "YYYY-MM-DD" }
2. add_wastage: { "type": "add_wastage", "wastageWeight": 35.5, "date": "YYYY-MM-DD" }
3. add_payment: { "type": "add_payment", "partyName": "Label Graphic", "amount": 50000, "mode": "bank" }
4. whatsapp_report: { "type": "whatsapp_report", "partyName": "Label Graphic", "reportType": "ledger" }
5. navigate: { "type": "navigate", "destination": "payments" }
6. unknown: { "type": "unknown", "message": "Kya karna chahte hain? Clear batayein." }

RULES:
- If user says "67.500 ka roll" => grossWeight=67.5 (extract number)
- If user says "core 5.5" or "5.5 core" => coreWeight=5.5
- If user says "aaj" => use today's date
- If user doesn't mention coreWeight, default to 5.5
- If user doesn't mention joints, default to 0
- Partial party names like "label" or "rudra" should match the closest party
- Amount in "50000 aaye" or "50 hazaar" = 50000
- For payments, if mode not specified, default to "bank"
- reportType "ledger" = party-specific ledger, "daily" = today's production, "summary" = overall`;

export async function parseVoiceCommandAudio(
  base64Audio: string,
  mimeType: string,
  context: VoiceContext
): Promise<{ action: VoiceAction, transcript: string }> {
  const today = new Date().toISOString().split('T')[0];
  const contextStr = `
Current user: ${context.currentUser.loginId} | Shift: ${context.currentUser.shift || 'A'} | Dept: ${context.currentUser.department}
Active Job Card: ${context.selectedJobCardCode || 'none selected'}
Today's date: ${today}
Payment Parties: ${context.paymentParties.slice(0, 10).map(p => p.party_name).join(', ')}
Job Cards (active): ${context.jobCards.filter(j => j.status !== 'dispatched').slice(0, 5).map(j => `${j.jobCode}(${j.partyCode})`).join(', ')}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64Audio } },
            { text: `${SYSTEM_PROMPT}\n\nCONTEXT:\n${contextStr}\n\nListen to the audio. First output the user's transcript in Hindi/English, then a newline, then Return JSON:` }
          ]
        }
      ],
      config: { temperature: 0.1, maxOutputTokens: 512 }
    });

    const raw = response.text?.trim() || '';
    
    // The response should have text then JSON.
    const jsonStart = raw.indexOf('{');
    if (jsonStart === -1) throw new Error("No JSON found");
    
    const transcript = raw.substring(0, jsonStart).trim();
    const jsonStr = raw.substring(jsonStart).replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    
    if (parsed.date === undefined && (parsed.type === 'add_production_roll' || parsed.type === 'add_wastage')) {
      parsed.date = today;
    }
    return { action: parsed as VoiceAction, transcript: transcript || 'Audio understood.' };
  } catch (err) {
    console.error('Voice audio parse error', err);
    return { action: { type: 'unknown', message: 'Samajh nahi aaya. Dobara bolein.' }, transcript: 'Error parsing audio.' };
  }
}

export async function parseVoiceCommand(
  transcript: string,
  context: VoiceContext
): Promise<VoiceAction> {
  const today = new Date().toISOString().split('T')[0];
  const contextStr = `
Current user: ${context.currentUser.loginId} | Shift: ${context.currentUser.shift || 'A'} | Dept: ${context.currentUser.department}
Active Job Card: ${context.selectedJobCardCode || 'none selected'}
Today's date: ${today}
Payment Parties: ${context.paymentParties.slice(0, 10).map(p => p.party_name).join(', ')}
Job Cards (active): ${context.jobCards.filter(j => j.status !== 'dispatched').slice(0, 5).map(j => `${j.jobCode}(${j.partyCode})`).join(', ')}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT}\n\nCONTEXT:\n${contextStr}\n\nUSER SAID: "${transcript}"\n\nReturn JSON:` }]
        }
      ],
      config: { temperature: 0.1, maxOutputTokens: 256 }
    });

    const raw = response.text?.trim() || '';
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    // Inject today's date if missing
    if (parsed.date === undefined && (parsed.type === 'add_production_roll' || parsed.type === 'add_wastage')) {
      parsed.date = today;
    }
    return parsed as VoiceAction;
  } catch (err) {
    console.error('Voice parse error', err);
    return { type: 'unknown', message: 'Samajh nahi aaya. Dobara bolein.' };
  }
}

export async function executeAction(
  action: VoiceAction,
  context: VoiceContext
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];

  switch (action.type) {
    case 'add_production_roll': {
      if (!context.selectedJobCardId) {
        return '❌ Pehle koi job card select karein.';
      }
      const gross = action.grossWeight;
      const core = action.coreWeight ?? 5.5;
      const net = Math.max(0, gross - core);
      // Get next roll number
      const { getDocs, query, where } = await import('firebase/firestore');
      const rollsSnap = await getDocs(query(collection(db, 'productionRolls'), where('jobCardId', '==', context.selectedJobCardId)));
      const maxNo = rollsSnap.docs.reduce((m, d) => Math.max(m, (d.data().rollNo || 0)), 0);
      await addDoc(collection(db, 'productionRolls'), {
        jobCardId: context.selectedJobCardId,
        rollNo: maxNo + 1,
        shift: context.currentUser.shift || 'A',
        date: action.date || today,
        grossWeight: gross,
        coreWeight: core,
        netWeight: net,
        joints: action.joints ?? 0,
        takenBySlitting: false,
        createdBy: context.currentUser.loginId,
        createdAt: serverTimestamp(),
        voiceAdded: true,
      });
      return `✅ Roll ${maxNo + 1} add ho gaya!\nGross: ${gross} kg | Core: ${core} kg | Net: ${net.toFixed(3)} kg`;
    }

    case 'add_wastage': {
      if (!context.selectedJobCardId) {
        return '❌ Pehle koi job card select karein.';
      }
      await addDoc(collection(db, 'productionWastage'), {
        jobCardId: context.selectedJobCardId,
        wastageWeight: action.wastageWeight,
        date: action.date || today,
        shift: context.currentUser.shift || 'A',
        createdBy: context.currentUser.loginId,
        createdAt: serverTimestamp(),
        voiceAdded: true,
      });
      return `✅ Wastage add ho gaya: ${action.wastageWeight} kg`;
    }

    case 'add_payment': {
      // Find matching party
      const normalizedInput = action.partyName.toLowerCase();
      const matchedParty = context.paymentParties.find(p =>
        p.party_name.toLowerCase().includes(normalizedInput) ||
        normalizedInput.includes(p.party_name.toLowerCase().split(' ')[0])
      );
      if (!matchedParty) {
        return `❌ Party "${action.partyName}" nahi mili. Parties: ${context.paymentParties.map(p => p.party_name).join(', ')}`;
      }
      // Dynamically import to avoid circular deps
      const { dbService } = await import('../payment-tracker/db');
      await dbService.addPayment({
        party_id: matchedParty.id,
        amount: action.amount,
        payment_date: Date.now(),
        payment_mode: action.mode === 'cash' ? 'Cash' : 'Bank Transfer',
        reference_number: '',
        notes: 'Voice entry',
        created_by: context.currentUser.loginId,
      });
      return `✅ ₹${action.amount.toLocaleString('en-IN')} payment add ho gaya!\nParty: ${matchedParty.party_name}`;
    }

    case 'whatsapp_report': {
      // Build a text report and open WhatsApp
      let msg = '';
      if (action.partyName) {
        const normalizedInput = action.partyName.toLowerCase();
        const matchedParty = context.paymentParties.find(p =>
          p.party_name.toLowerCase().includes(normalizedInput) ||
          normalizedInput.includes(p.party_name.toLowerCase().split(' ')[0])
        );
        if (matchedParty) {
          const { dbService } = await import('../payment-tracker/db');
          const bills = await dbService.getBills();
          const partyBills = bills.filter(b => b.party_id === matchedParty.id);
          const total = partyBills.reduce((s, b) => s + b.bill_amount, 0);
          const paid = partyBills.reduce((s, b) => s + b.paid_amount, 0);
          const outstanding = total - paid;
          msg = `🏭 *SUNSHINE POLYFILM INDUSTRIES*\n━━━━━━━━━━━━━━━━━━━━\n📋 *Party Ledger Report*\n👤 *Party:* ${matchedParty.party_name}\n📅 *Date:* ${new Date().toLocaleDateString('en-IN')}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total Bills:* ₹${total.toLocaleString('en-IN')}\n✅ *Received:* ₹${paid.toLocaleString('en-IN')}\n⚠️ *Outstanding:* ₹${outstanding.toLocaleString('en-IN')}\n━━━━━━━━━━━━━━━━━━━━`;
        }
      } else {
        msg = `🏭 *SUNSHINE POLYFILM INDUSTRIES*\nDaily Report — ${new Date().toLocaleDateString('en-IN')}`;
      }
      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
      return `📤 WhatsApp khul raha hai...`;
    }

    case 'navigate': {
      return `➡️ "${action.destination}" pe ja rahe hain...`;
    }

    default:
      return (action as any).message || 'Samajh nahi aaya. Dobara bolein.';
  }
}

export async function generateAudioResponse(text: string): Promise<string | null> {
  try {
    const cleanText = text.replace(/[*✅❌📤➡️]/gu, '').trim();
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: cleanText,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Aoede'
            }
          }
        }
      }
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (audioPart) {
      return audioPart.inlineData.data; // Base64 string
    }
  } catch (err) {
    console.error('Audio generation error', err);
  }
  return null;
}
