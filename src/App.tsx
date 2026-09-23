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
import { LoginModal } from './components/LoginModal';
import { AdminModule } from './components/AdminModule';
import { ChemicalModule } from './components/ChemicalModule';
import { ProductionModule } from './components/ProductionModule';
import { SlittingModule } from './components/SlittingModule';
import { PaymentTrackerModule } from './payment-tracker/PaymentTrackerModule';
import { getUserPermissions } from './utils/permissions';
import { Toaster } from 'react-hot-toast';
import { LayoutDashboard, Wallet, Factory, Scissors, FlaskConical, LogOut } from 'lucide-react';

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
      const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const list: User[] = [];
        snapshot.forEach((doc) => { list.push({ id: doc.id, ...doc.data() } as User); });
        setUsers(list);
        setIsLive(true);
      });
      unsubs.push(unsubUsers);

      const unsubJc = onSnapshot(collection(db, 'jobCards'), (snapshot) => {
        const list: JobCard[] = [];
        snapshot.forEach((doc) => { list.push({ id: doc.id, ...doc.data() } as JobCard); });
        setJobCards(list);
      });
      unsubs.push(unsubJc);

      const unsubChem = onSnapshot(collection(db, 'chemicals'), (snapshot) => {
        const list: Chemical[] = [];
        snapshot.forEach((doc) => { list.push({ id: doc.id, ...doc.data() } as Chemical); });
        setChemicals(list);
      });
      unsubs.push(unsubChem);

      const unsubPurch = onSnapshot(collection(db, 'chemicalPurchases'), (snapshot) => {
        const list: ChemicalPurchase[] = [];
        snapshot.forEach((doc) => { list.push({ id: doc.id, ...doc.data() } as ChemicalPurchase); });
        setPurchases(list);
      });
      unsubs.push(unsubPurch);

      const unsubUsage = onSnapshot(collection(db, 'chemicalUsage'), (snapshot) => {
        const list: ChemicalUsage[] = [];
        snapshot.forEach((doc) => { list.push({ id: doc.id, ...doc.data() } as ChemicalUsage); });
        setUsages(list);
      });
      unsubs.push(unsubUsage);

      const unsubProd = onSnapshot(collection(db, 'productionRolls'), (snapshot) => {
        const list: ProductionRoll[] = [];
        snapshot.forEach((doc) => { list.push({ id: doc.id, ...doc.data() } as ProductionRoll); });
        list.sort((a, b) => (a.rollNo || 0) - (b.rollNo || 0));
        setProdRolls(list);
      });
      unsubs.push(unsubProd);

      const unsubSlit = onSnapshot(collection(db, 'slittingRolls'), (snapshot) => {
        const list: SlittingRoll[] = [];
        snapshot.forEach((doc) => { list.push({ id: doc.id, ...doc.data() } as SlittingRoll); });
        list.sort((a, b) => (a.rollNo || 0) - (b.rollNo || 0));
        setSlitRolls(list);
      });
      unsubs.push(unsubSlit);

      const unsubWastage = onSnapshot(collection(db, 'productionWastage'), (snapshot) => {
        const list: ProductionWastage[] = [];
        snapshot.forEach((doc) => { list.push({ id: doc.id, ...doc.data() } as ProductionWastage); });
        setProdWastages(list);
      });
      unsubs.push(unsubWastage);
    } catch (err) {
      console.error('Error attaching realtime listeners:', err);
    }

    return () => { unsubs.forEach((unsub) => unsub()); };
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
  }, [users, currentUser]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('sunshine_app_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sunshine_app_user');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
      <Toaster position="top-right" />
      
      {/* MD3 Top App Bar */}
      <header className="bg-slate-50 sticky top-0 z-40 px-4 h-16 flex items-center justify-between border-b border-slate-200" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Sunshine</span>
          {isLive && (
            <div className="ml-1 px-2 py-0.5 bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1.5 hidden sm:flex">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></div>
              <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Live</span>
            </div>
          )}
        </div>
        {currentUser && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 uppercase tracking-wider">
                {currentUser.department || 'USER'}
              </span>
              <span className="text-sm font-semibold text-slate-800">{currentUser.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Log Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto md:py-4 pb-[80px] md:pb-6">
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
  if (perms.admin.view) availableTabs.push({ id: 'admin', label: 'Admin', icon: <LayoutDashboard className="w-6 h-6" /> });
  if (perms.payments.view) availableTabs.push({ id: 'payments', label: 'Payments', icon: <Wallet className="w-6 h-6" /> });
  if (perms.production.view) availableTabs.push({ id: 'production', label: 'Production', icon: <Factory className="w-6 h-6" /> });
  if (perms.slitting.view) availableTabs.push({ id: 'slitting', label: 'Slitting', icon: <Scissors className="w-6 h-6" /> });
  if (perms.chemical.view) availableTabs.push({ id: 'chemical', label: 'Chemical', icon: <FlaskConical className="w-6 h-6" /> });

  const [activeTab, setActiveTab] = useState(availableTabs.length > 0 ? availableTabs[0].id : '');

  if (availableTabs.length === 0) {
    return <div className="text-center p-8 text-slate-500">You do not have permission to view any modules. Please contact an administrator.</div>;
  }

  return (
    <>
      {/* Desktop Top Tabs (MD3 style) */}
      {availableTabs.length > 1 && (
        <div className="hidden md:flex overflow-x-auto gap-2 px-4 py-2 bg-slate-50 mb-4 rounded-xl">
          {availableTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-transparent text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Module Content */}
      <div className={activeTab === 'payments' ? "md:px-0" : "px-3 sm:px-4 md:px-0"}>
        {activeTab === 'admin' && <AdminModule {...props} />}
        {activeTab === 'chemical' && <ChemicalModule {...props} />}
        {activeTab === 'production' && <ProductionModule {...props} />}
        {activeTab === 'slitting' && <SlittingModule {...props} />}
        {activeTab === 'payments' && (
          <div className="md:p-4">
            <PaymentTrackerModule />
          </div>
        )}
      </div>

      {/* MD3 Bottom Navigation Bar for Mobile */}
      {availableTabs.length > 1 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-50 border-t border-slate-200 flex justify-around items-center h-[80px] pb-safe z-50">
          {availableTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <div className={`px-4 py-1 rounded-full transition-all ${isActive ? 'bg-indigo-100' : ''}`}>
                  {tab.icon}
                </div>
                <span className={`text-[11px] font-medium ${isActive ? 'font-bold' : ''}`}>{tab.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </>
  );
}
