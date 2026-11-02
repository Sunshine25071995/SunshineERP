import { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
} from 'firebase/firestore';
import { db } from '../firebaseClient';
import { JobCardParty } from '../types';

export const INITIAL_JOB_CARD_PARTIES: { code: string; name: string }[] = [
  { code: '001', name: 'Secure Polymers Pvt. Ltd.' },
  { code: '002', name: 'Kothari Packaging Industries' },
  { code: '003', name: 'Label Graphic' },
  { code: '004', name: 'Tirth PrintPack' },
  { code: '005', name: 'Rudra Printing And Packaging' },
  { code: '006', name: 'Supreme Packaging' },
  { code: '007', name: 'SHRI LAKSHMI PACKAGING' },
];

// In-memory cache for synchronous lookups
export const PARTIES: Record<string, string> = {
  '001': 'Secure Polymers Pvt. Ltd.',
  '002': 'Kothari Packaging Industries',
  '003': 'Label Graphic',
  '004': 'Tirth PrintPack',
  '005': 'Rudra Printing And Packaging',
  '006': 'Supreme Packaging',
  '007': 'SHRI LAKSHMI PACKAGING'
};

export const getPartyName = (code: string): string => {
  if (!code) return '';
  const cleanCode = code.trim();
  const paddedCode = cleanCode.padStart(3, '0');
  return PARTIES[paddedCode] || PARTIES[cleanCode] || cleanCode;
};

export function getNextPartyCode(parties: { code: string }[]): string {
  let maxNum = 0;
  for (const p of parties) {
    const num = parseInt(p.code, 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }
  const nextNum = maxNum + 1;
  return String(nextNum).padStart(3, '0');
}

// Global cached state and subscriber list for instant updates across components
let cachedParties: JobCardParty[] = INITIAL_JOB_CARD_PARTIES.map(p => ({
  id: `seed_${p.code}`,
  code: p.code,
  name: p.name,
}));
let isSeeding = false;
let listenerAttached = false;
const subscribers = new Set<(parties: JobCardParty[]) => void>();

function initPartiesListener() {
  if (listenerAttached) return;
  listenerAttached = true;

  try {
    // We use the 'parties' collection which already has read/write permissions in Firebase Firestore rules
    const partiesCol = collection(db, 'parties');
    onSnapshot(partiesCol, async (snapshot) => {
      const list: JobCardParty[] = [];
      const usedCodes = new Set<string>();

      snapshot.forEach((d) => {
        const data = d.data();
        const partyName = (data.party_name || data.name || '').trim();
        if (!partyName) return;

        let code = (data.code || '').trim();
        if (code) {
          code = code.padStart(3, '0');
          usedCodes.add(code);
        }

        list.push({
          id: d.id,
          code,
          name: partyName,
          contactPerson: data.contactPerson || '',
          phone: data.mobile || data.phone || '',
          notes: data.notes || '',
          createdAt: data.created_at || data.createdAt,
          updatedAt: data.updated_at || data.updatedAt,
        });
      });

      // For any party without code, derive code
      let nextCodeNum = 8;
      for (const p of list) {
        if (!p.code) {
          const matchInitial = INITIAL_JOB_CARD_PARTIES.find(
            init => init.name.toLowerCase() === p.name.toLowerCase()
          );
          if (matchInitial) {
            p.code = matchInitial.code;
          } else {
            while (usedCodes.has(String(nextCodeNum).padStart(3, '0'))) {
              nextCodeNum++;
            }
            p.code = String(nextCodeNum).padStart(3, '0');
            nextCodeNum++;
          }
          usedCodes.add(p.code);
        }
      }

      // Check if collection is empty, auto-seed the initial 7 parties
      if (snapshot.empty && !isSeeding) {
        isSeeding = true;
        try {
          for (const item of INITIAL_JOB_CARD_PARTIES) {
            await setDoc(doc(db, 'parties', `seed_${item.code}`), {
              code: item.code,
              name: item.name,
              party_name: item.name,
              opening_balance: 0,
              advance_balance: 0,
              created_at: Date.now(),
            }, { merge: true });
          }
        } catch (seedErr) {
          console.warn('Auto-seed parties notice:', seedErr);
        } finally {
          isSeeding = false;
        }
      }

      // Ensure all 7 initial parties exist in the returned list
      for (const init of INITIAL_JOB_CARD_PARTIES) {
        if (!list.some(p => p.code === init.code)) {
          list.push({
            id: `seed_${init.code}`,
            code: init.code,
            name: init.name,
          });
        }
      }

      // Sort by code: numeric comparison first, fallback to alphabetical
      list.sort((a, b) => {
        const numA = parseInt(a.code, 10);
        const numB = parseInt(b.code, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.code.localeCompare(b.code);
      });

      cachedParties = list;

      // Update in-memory PARTIES lookup
      for (const k of Object.keys(PARTIES)) {
        delete PARTIES[k];
      }
      for (const p of list) {
        if (p.code) {
          PARTIES[p.code] = p.name;
          PARTIES[p.code.padStart(3, '0')] = p.name;
        }
      }

      // Notify all subscribers
      subscribers.forEach(cb => {
        try { cb(list); } catch (e) { console.error(e); }
      });
    }, (error) => {
      console.error('Error listening to parties:', error);
    });
  } catch (err) {
    console.error('Failed to attach parties listener:', err);
  }
}

// Ensure listener is initiated immediately
initPartiesListener();

export function subscribeJobCardParties(callback: (parties: JobCardParty[]) => void): () => void {
  initPartiesListener();
  subscribers.add(callback);
  callback(cachedParties);
  return () => {
    subscribers.delete(callback);
  };
}

export function useJobCardParties() {
  const [parties, setParties] = useState<JobCardParty[]>(cachedParties);
  const [loading, setLoading] = useState(cachedParties.length === 0);

  useEffect(() => {
    const unsubscribe = subscribeJobCardParties((updatedParties) => {
      setParties(updatedParties);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { parties, loading };
}

export async function addJobCardParty(data: {
  name: string;
  code?: string;
  contactPerson?: string;
  phone?: string;
  notes?: string;
}): Promise<JobCardParty> {
  const trimmedName = data.name.trim();
  if (!trimmedName) throw new Error('Party name is required.');

  let code = (data.code || '').trim();
  if (!code) {
    code = getNextPartyCode(cachedParties);
  } else {
    code = code.padStart(3, '0');
  }

  // Check duplicate code
  const existingWithCode = cachedParties.find(p => p.code.toLowerCase() === code.toLowerCase());
  if (existingWithCode) {
    throw new Error(`Party Code "${code}" already exists for "${existingWithCode.name}". Please use a different code.`);
  }

  const phone = (data.phone || '').trim();
  const contactPerson = (data.contactPerson || '').trim();
  const notes = (data.notes || '').trim();

  // Save to 'parties' collection with fields compatible with both Payment Tracker & Job Cards
  const docData = {
    party_name: trimmedName,
    name: trimmedName,
    code,
    mobile: phone,
    phone,
    contactPerson,
    notes,
    opening_balance: 0,
    advance_balance: 0,
    created_at: Date.now(),
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'parties'), docData);
  const newParty: JobCardParty = {
    id: docRef.id,
    code,
    name: trimmedName,
    contactPerson,
    phone,
    notes,
  };

  // Immediate local cache update
  PARTIES[code] = trimmedName;
  cachedParties = [...cachedParties, newParty];
  subscribers.forEach(cb => {
    try { cb(cachedParties); } catch (e) { console.error(e); }
  });

  return newParty;
}

export async function updateJobCardParty(
  id: string,
  data: Partial<Omit<JobCardParty, 'id' | 'createdAt'>>
): Promise<void> {
  if (!id) throw new Error('Party ID is required for update.');

  const updatePayload: Record<string, any> = {
    updated_at: Date.now(),
    updatedAt: serverTimestamp(),
  };

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error('Party name cannot be empty.');
    updatePayload.name = trimmed;
    updatePayload.party_name = trimmed;
  }

  if (data.code !== undefined) {
    const trimmedCode = data.code.trim().padStart(3, '0');
    if (!trimmedCode) throw new Error('Party code cannot be empty.');
    const existing = cachedParties.find(p => p.id !== id && p.code.toLowerCase() === trimmedCode.toLowerCase());
    if (existing) {
      throw new Error(`Party Code "${trimmedCode}" is already used by "${existing.name}".`);
    }
    updatePayload.code = trimmedCode;
  }

  if (data.contactPerson !== undefined) updatePayload.contactPerson = data.contactPerson.trim();
  if (data.phone !== undefined) {
    updatePayload.phone = data.phone.trim();
    updatePayload.mobile = data.phone.trim();
  }
  if (data.notes !== undefined) updatePayload.notes = data.notes.trim();

  await updateDoc(doc(db, 'parties', id), updatePayload);
}

export async function deleteJobCardParty(id: string): Promise<void> {
  if (!id) throw new Error('Party ID is required.');
  await deleteDoc(doc(db, 'parties', id));
}
