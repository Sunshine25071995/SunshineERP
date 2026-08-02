import { collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';
import { db } from '../firebaseClient';

export async function seedInitialUsersIfNeeded() {
  try {
    const usersRef = collection(db, 'users');
    const adminQuery = query(usersRef, where('loginId', '==', '090909'));
    const adminSnapshot = await getDocs(adminQuery);

    if (adminSnapshot.empty) {
      // Seed Admin and default department users
      const initialUsers = [
        { loginId: '090909', name: 'Admin', department: 'admin', shift: null, active: true },
        { loginId: '100100', name: 'Chemical Department', department: 'chemical', shift: null, active: true },
        { loginId: '200100', name: 'Production Shift A', department: 'production', shift: 'A', active: true },
        { loginId: '200200', name: 'Production Shift B', department: 'production', shift: 'B', active: true },
        { loginId: '300100', name: 'Slitting Shift A', department: 'slitting', shift: 'A', active: true },
        { loginId: '300200', name: 'Slitting Shift B', department: 'slitting', shift: 'B', active: true },
      ];

      for (const u of initialUsers) {
        const docRef = doc(usersRef, u.loginId);
        await setDoc(docRef, u, { merge: true });
      }

      console.log('Successfully seeded initial users.');
    }
  } catch (err) {
    console.error('Error seeding initial users:', err);
  }
}
