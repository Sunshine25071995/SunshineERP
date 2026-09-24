import { collection, addDoc, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../firebaseClient';

export async function logActivity(action: string, details: string, userId: string, userName: string) {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      action: action || 'Activity',
      details: details || '',
      userId: userId || 'system',
      userName: userName || 'User',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export async function ensureInitialActivityLog() {
  try {
    const q = query(collection(db, 'activityLogs'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      await logActivity('System Started', 'Sunshine ERP active & ready', 'system', 'System Admin');
    }
  } catch (err) {
    console.error('Error checking initial activity log:', err);
  }
}
