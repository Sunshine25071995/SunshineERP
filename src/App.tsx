import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, getDocFromServer } from 'firebase/firestore';
import { db } from './firebaseClient';
import { seedInitialUsersIfNeeded } from './services/seedService';
import {
  User,
  JobCard,
  Chemical,
  ChemicalPurchase,
  ChemicalUsage,
  ProductionRoll,
  SlittingRoll,
  ProductionWastage,
} from './types';
import { Navbar } from './components/Navbar';
import { LoginModal } from './components/LoginModal';
import { AdminModule } from './components/AdminModule';
import { ChemicalModule } from './components/ChemicalModule';
import { ProductionModule } from './components/ProductionModule';
import { SlittingModule } from './components/SlittingModule';
import { PaymentTrackerModule } from './payment-tracker/PaymentTrackerModule';
import { getUserPermissions } from './utils/permissions';

export default function App() {
  const [isLive, setIsLive] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('sunshine_app_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Firestore Realtime Collections State
  const [users, setUsers] = useState<User[]>([]);
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [purchases, setPurchases] = useState<ChemicalPurchase[]>([]);
  const [usages, setUsages] = useState<ChemicalUsage[]>([]);
  const [prodRolls, setProdRolls] = useState<ProductionRoll[]>([]);
  const [slitRolls, setSlitRolls] = useState<SlittingRoll[]>([]);
  const [prodWastages, setProdWastages] = useState<ProductionWastage[]>([]);

  // Validate connection to Firestore on initial boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'users', '090909'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
    seedInitialUsersIfNeeded();
  }, []);

  // Set up Realtime Listeners (onSnapshot) for Firestore live updates
  useEffect(() => {
    let unsubs: (() => void)[] = [];

    try {
      // 1. Users
      const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const list: User[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as User);
        });
        setUsers(list);
        setIsLive(true);
      });
      unsubs.push(unsubUsers);

      // 2. Job Cards
      const unsubJc = onSnapshot(collection(db, 'jobCards'), (snapshot) => {
        const list: JobCard[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as JobCard);
        });
        setJobCards(list);
      });
      unsubs.push(unsubJc);

      // 3. Chemicals
      const unsubChem = onSnapshot(collection(db, 'chemicals'), (snapshot) => {
        const list: Chemical[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Chemical);
        });
        setChemicals(list);
      });
      unsubs.push(unsubChem);

      // 4. Chemical Purchases
      const unsubPurch = onSnapshot(collection(db, 'chemicalPurchases'), (snapshot) => {
        const list: ChemicalPurchase[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as ChemicalPurchase);
        });
        setPurchases(list);
      });
      unsubs.push(unsubPurch);

      // 5. Chemical Usages
      const unsubUsage = onSnapshot(collection(db, 'chemicalUsage'), (snapshot) => {
        const list: ChemicalUsage[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as ChemicalUsage);
        });
        setUsages(list);
      });
      unsubs.push(unsubUsage);

      // 6. Production Rolls
      const unsubProd = onSnapshot(collection(db, 'productionRolls'), (snapshot) => {
        const list: ProductionRoll[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as ProductionRoll);
        });
        list.sort((a, b) => (a.rollNo || 0) - (b.rollNo || 0));
        setProdRolls(list);
      });
      unsubs.push(unsubProd);

      // 7. Slitting Rolls
      const unsubSlit = onSnapshot(collection(db, 'slittingRolls'), (snapshot) => {
        const list: SlittingRoll[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as SlittingRoll);
        });
        list.sort((a, b) => (a.rollNo || 0) - (b.rollNo || 0));
        setSlitRolls(list);
      });
      unsubs.push(unsubSlit);

      // 8. Production Wastage
      const unsubWastage = onSnapshot(collection(db, 'productionWastage'), (snapshot) => {
        const list: ProductionWastage[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as ProductionWastage);
        });
        setProdWastages(list);
      });
      unsubs.push(unsubWastage);
    } catch (err) {
      console.error('Error attaching realtime listeners:', err);
    }

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, []);

  // Update currentUser if users list changes in realtime
  useEffect(() => {
    if (currentUser) {
      const updated = users.find((u) => u.loginId === currentUser.loginId);
      if (updated) {
        setCurrentUser(updated);
        localStorage.setItem('sunshine_app_user', JSON.stringify(updated));
      }
    }
  }, [users]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('sunshine_app_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sunshine_app_user');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans antialiased">
      {/* Top Header Navbar */}
      <Navbar currentUser={currentUser} onLogout={handleLogout} isLive={isLive} />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-safe">
        {!currentUser ? (
          <LoginModal users={users} onLogin={handleLogin} />
        ) : (
          <AppContainer
            currentUser={currentUser}
            users={users}
            jobCards={jobCards}
            chemicals={chemicals}
            purchases={purchases}
            usages={usages}
            prodRolls={prodRolls}
            slitRolls={slitRolls}
            prodWastages={prodWastages}
          />
        )}
      </main>
    </div>
  );
}

function AppContainer(props: any) {
  const { currentUser } = props;
  const perms = getUserPermissions(currentUser);
  
  const availableTabs = [];
  if (perms.admin.view) availableTabs.push({ id: 'admin', label: 'Dashboard' });
  if (perms.payments.view) availableTabs.push({ id: 'payments', label: 'Payments' });
  if (perms.production.view) availableTabs.push({ id: 'production', label: 'Production' });
  if (perms.slitting.view) availableTabs.push({ id: 'slitting', label: 'Slitting' });
  if (perms.chemical.view) availableTabs.push({ id: 'chemical', label: 'Chemicals' });
  
  const [activeTab, setActiveTab] = useState(availableTabs.length > 0 ? availableTabs[0].id : '');

  if (availableTabs.length === 0) {
    return <div className="text-center p-8 text-gray-500">You do not have permission to view any modules. Please contact an administrator.</div>;
  }

  return (
    <div className="space-y-4">
      {availableTabs.length > 1 && (
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
          {availableTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'admin' && <AdminModule {...props} />}
      {activeTab === 'chemical' && <ChemicalModule {...props} />}
      {activeTab === 'production' && <ProductionModule {...props} />}
      {activeTab === 'slitting' && <SlittingModule {...props} />}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 min-h-[500px]">
          <PaymentTrackerModule />
        </div>
      )}
    </div>
  );
}
