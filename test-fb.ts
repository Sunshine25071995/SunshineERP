import { collection, addDoc } from 'firebase/firestore';
import { db } from './src/firebaseClient';

async function test() {
  try {
    const docRef = await addDoc(collection(db, 'parties'), { name: 'Test' });
    console.log('Success, ID:', docRef.id);
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();