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
  query, 
  orderBy 
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
    const partiesCol = collection(db, 'jobCardParties');
    onSnapshot(partiesCol, async (snapshot) => {
      if (snapshot.empty && !isSeeding) {
        isSeeding = true;
        try {
          for (const item of INITIAL_JOB_CARD_PARTIES) {
            await setDoc(doc(db, 'jobCardParties', `seed_${item.code}`), {
              code: item.code,
              name: item.name,
              createdAt: serverTimestamp(),
            }, { merge: true });
          }
        } catch (seedErr) {
          console.error('Error auto-seeding jobCardParties:', seedErr);
        } finally {
          isSeeding = false;
        }
        return;
      }

      const list: JobCardParty[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          code: data.code || '',
          name: data.name || '',
          contactPerson: data.contactPerson || '',
          phone: data.phone || '',
          notes: data.notes || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

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
      // Clear out obsolete dynamic keys while preserving fallback
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
      console.error('Error listening to jobCardParties:', error);
    });
  } catch (err) {
    console.error('Failed to attach jobCardParties listener:', err);
  }
}

// Ensure listener is initiated immediately
initPartiesListener();

export function subscribeJobCardParties(callback: (parties: JobCardParty[]) => void): () => void {
  initPartiesListener();
  subscribers.add(callback);
  // Emit immediately with current cache
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

  const docData = {
    name: trimmedName,
    code,
    contactPerson: (data.contactPerson || '').trim(),
    phone: (data.phone || '').trim(),
    notes: (data.notes || '').trim(),
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'jobCardParties'), docData);
  const newParty: JobCardParty = {
    id: docRef.id,
    ...docData,
  };

  // Immediate local cache update
  PARTIES[code] = trimmedName;

  return newParty;
}

export async function updateJobCardParty(
  id: string,
  data: Partial<Omit<JobCardParty, 'id' | 'createdAt'>>
): Promise<void> {
  if (!id) throw new Error('Party ID is required for update.');

  const updatePayload: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error('Party name cannot be empty.');
    updatePayload.name = trimmed;
  }

  if (data.code !== undefined) {
    const trimmedCode = data.code.trim().padStart(3, '0');
    if (!trimmedCode) throw new Error('Party code cannot be empty.');
    // Check if another party already has this code
    const existing = cachedParties.find(p => p.id !== id && p.code.toLowerCase() === trimmedCode.toLowerCase());
    if (existing) {
      throw new Error(`Party Code "${trimmedCode}" is already used by "${existing.name}".`);
    }
    updatePayload.code = trimmedCode;
  }

  if (data.contactPerson !== undefined) updatePayload.contactPerson = data.contactPerson.trim();
  if (data.phone !== undefined) updatePayload.phone = data.phone.trim();
  if (data.notes !== undefined) updatePayload.notes = data.notes.trim();

  await updateDoc(doc(db, 'jobCardParties', id), updatePayload);
}

export async function deleteJobCardParty(id: string): Promise<void> {
  if (!id) throw new Error('Party ID is required.');
  await deleteDoc(doc(db, 'jobCardParties', id));
}
