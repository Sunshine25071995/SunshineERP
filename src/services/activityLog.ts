import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';

export async function logActivity(action: string, details: string, userId: string, userName: string) {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      action,
      details,
      userId,
      userName,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
