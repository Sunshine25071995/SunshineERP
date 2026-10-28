import React, { useState, useEffect, useMemo } from 'react';
import { JobCard, User, ProductionPlan } from '../types';
import { PARTIES, getPartyName } from '../utils/parties';
import { formatWeight } from '../utils/formatters';
import { db } from '../firebaseClient';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy
} from 'firebase/firestore';
import {
  Calendar, Clock, Factory, Zap, Copy, Printer, Plus, Trash2,
  CheckCircle2, AlertTriangle, Sparkles, RefreshCw, Layers, ShieldCheck,
  ChevronRight, CalendarDays, ArrowRight, Share2, Timer
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ProductionPlannerProps {
  jobCards: JobCard[];
  currentUser: User;
}

export interface CompletionResult {
  completionDate: Date;
  completionFormatted: string;
  totalProductionHours: number;
  totalDaysHoursFormatted: string;
  sundaysSkipped: number;
  hourlyRate: number;
  dailyCapacityKg: number;
}

export function calculateProductionCompletion({
  startDateTime,
  quantityKg,
  plantCount,
  shiftMode,
  ratePer24Hr = 850,
  dayShiftStartHour = 8,
  dayShiftEndHour = 20,
}: {
  startDateTime: Date | string;
  quantityKg: number;
  plantCount: 1 | 2;
  shiftMode: '12hr' | '24hr';
  ratePer24Hr?: number;
  dayShiftStartHour?: number;
  dayShiftEndHour?: number;
}): CompletionResult | null {
  if (!quantityKg || quantityKg <= 0) return null;

  const hourlyRate = (ratePer24Hr * plantCount) / 24;
  const totalProductionHours = quantityKg / hourlyRate;
  let remainingMinutes = Math.round(totalProductionHours * 60);

  let current = new Date(startDateTime);
  if (isNaN(current.getTime())) current = new Date();

  let sundaysSkipped = 0;
  let iterations = 0;
  const maxIterations = 50000;

  while (remainingMinutes > 0 && iterations < maxIterations) {
    iterations++;

    // Sunday Check (0 = Sunday in JavaScript Date)
    if (current.getDay() === 0) {
      sundaysSkipped++;
      // Skip entire Sunday: move to Monday
      current.setDate(current.getDate() + 1);
      current.setHours(shiftMode === '12hr' ? dayShiftStartHour : 0, 0, 0, 0);
      continue;
    }

    if (shiftMode === '12hr') {
      const currentHour = current.getHours();
      const currentMin = current.getMinutes();

      // Before shift start (e.g. before 08:00)
      if (currentHour < dayShiftStartHour) {
        current.setHours(dayShiftStartHour, 0, 0, 0);
        continue;
      }

      // After shift end (e.g. after 20:00)
      if (currentHour >= dayShiftEndHour) {
        current.setDate(current.getDate() + 1);
        current.setHours(dayShiftStartHour, 0, 0, 0);
        continue;
      }

      // Inside working shift [dayShiftStartHour, dayShiftEndHour]
      const minutesLeftInShift = (dayShiftEndHour * 60) - (currentHour * 60 + currentMin);
      const minutesToWork = Math.min(remainingMinutes, minutesLeftInShift);

      current.setMinutes(current.getMinutes() + minutesToWork);
      remainingMinutes -= minutesToWork;

      if (remainingMinutes > 0) {
        // Shift over for today, advance to next day at shift start
        current.setDate(current.getDate() + 1);
        current.setHours(dayShiftStartHour, 0, 0, 0);
      }
    } else {
      // 24hr mode: continuous day & night, except Sunday
      const currentHour = current.getHours();
      const currentMin = current.getMinutes();
      const minutesLeftInDay = (24 * 60) - (currentHour * 60 + currentMin);
      const minutesToWork = Math.min(remainingMinutes, minutesLeftInDay);

      current.setMinutes(current.getMinutes() + minutesToWork);
      remainingMinutes -= minutesToWork;
      // If remainingMinutes > 0, current is now at 00:00 of next day
    }
  }

  // Format nice human-friendly date string
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName = daysOfWeek[current.getDay()];
  const dateNum = current.getDate();
  const monthName = months[current.getMonth()];
  const year = current.getFullYear();

  let hours = current.getHours();
  const minutes = current.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  const timeFormatted = `${hours}:${minutesStr} ${ampm}`;

  const completionFormatted = `${dayName}, ${dateNum} ${monthName} ${year} at ${timeFormatted}`;

  // Breakdown of days and hours
  const totalDays = Math.floor(totalProductionHours / (shiftMode === '12hr' ? 12 : 24));
  const remainingHours = Math.floor(totalProductionHours % (shiftMode === '12hr' ? 12 : 24));
  const remainingMins = Math.round((totalProductionHours * 60) % 60);

  let totalDaysHoursFormatted = '';
  if (totalDays > 0) totalDaysHoursFormatted += `${totalDays} Day${totalDays > 1 ? 's' : ''} `;
  if (remainingHours > 0 || totalDays === 0) totalDaysHoursFormatted += `${remainingHours} Hr${remainingHours !== 1 ? 's' : ''} `;
  if (remainingMins > 0) totalDaysHoursFormatted += `${remainingMins} Min${remainingMins !== 1 ? 's' : ''}`;

  return {
    completionDate: current,
    completionFormatted,
    totalProductionHours,
    totalDaysHoursFormatted: totalDaysHoursFormatted.trim(),
    sundaysSkipped,
    hourlyRate,
    dailyCapacityKg: hourlyRate * (shiftMode === '12hr' ? 12 : 24),
  };
}

export const ProductionPlanner: React.FC<ProductionPlannerProps> = ({ jobCards, currentUser }) => {
  // Form State
  const [size, setSize] = useState('190 mm');
  const [quantityKg, setQuantityKg] = useState<number | ''>(5000);
  const [partyName, setPartyName] = useState('');
  const [plantCount, setPlantCount] = useState<1 | 2>(2);
  const [shiftMode, setShiftMode] = useState<'12hr' | '24hr'>('24hr');
  const [ratePer24Hr, setRatePer24Hr] = useState<number>(850);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Default start date: current local datetime formatted for <input type="datetime-local" />
  const getInitialLocalDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };
  const [startDateTime, setStartDateTime] = useState<string>(getInitialLocalDateTime);

  // Saved Plans from Firestore
  const [savedPlans, setSavedPlans] = useState<ProductionPlan[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedJobCardId, setSelectedJobCardId] = useState<string>('');

  // Realtime subscription to productionPlans collection
  useEffect(() => {
    const q = query(collection(db, 'productionPlans'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const plans: ProductionPlan[] = [];
        snapshot.forEach((doc) => {
          plans.push({ id: doc.id, ...doc.data() } as ProductionPlan);
        });
        setSavedPlans(plans);
      },
      (error) => {
        console.error('Error fetching production plans:', error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Quick preset dates
  const setStartNow = () => {
    setStartDateTime(getInitialLocalDateTime());
  };

  const setStartTomorrowMorning = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setStartDateTime(d.toISOString().slice(0, 16));
  };

  const setStartNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const daysUntilMonday = ((1 - day + 7) % 7) || 7;
    d.setDate(d.getDate() + daysUntilMonday);
    d.setHours(8, 0, 0, 0);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setStartDateTime(d.toISOString().slice(0, 16));
  };

  // When admin selects a Job Card from dropdown, auto-fill Size, Quantity & Party
  const handleSelectJobCard = (jcId: string) => {
    setSelectedJobCardId(jcId);
    if (!jcId) return;
    const jc = jobCards.find((j) => j.id === jcId);
    if (jc) {
      if (jc.size) setSize(jc.size);
      if (jc.totalQuantity) setQuantityKg(Number(jc.totalQuantity));
      if (jc.partyCode) setPartyName(getPartyName(jc.partyCode));
      toast.success(`Loaded details from Job Card ${jc.jobCode}!`);
    }
  };

  // Main Active Calculation
  const result = useMemo(() => {
    if (!quantityKg || Number(quantityKg) <= 0) return null;
    return calculateProductionCompletion({
      startDateTime,
      quantityKg: Number(quantityKg),
      plantCount,
      shiftMode,
      ratePer24Hr,
    });
  }, [startDateTime, quantityKg, plantCount, shiftMode, ratePer24Hr]);

  // All 4 Scenarios Comparison
  const scenarios = useMemo(() => {
    if (!quantityKg || Number(quantityKg) <= 0) return [];
    const combos: { plantCount: 1 | 2; shiftMode: '12hr' | '24hr'; label: string; badge: string }[] = [
      { plantCount: 1, shiftMode: '12hr', label: '1 Plant (12 Hours)', badge: 'Standard Economy' },
      { plantCount: 1, shiftMode: '24hr', label: '1 Plant (24 Hours)', badge: 'Continuous Day & Night' },
      { plantCount: 2, shiftMode: '12hr', label: '2 Plants (12 Hours)', badge: 'Double Plant Day Shift' },
      { plantCount: 2, shiftMode: '24hr', label: '2 Plants (24 Hours)', badge: 'Maximum Speed ⚡' },
    ];

    return combos.map((c) => {
      const res = calculateProductionCompletion({
        startDateTime,
        quantityKg: Number(quantityKg),
        plantCount: c.plantCount,
        shiftMode: c.shiftMode,
        ratePer24Hr,
      });
      return {
        ...c,
        res,
        isSelected: plantCount === c.plantCount && shiftMode === c.shiftMode,
      };
    });
  }, [startDateTime, quantityKg, plantCount, shiftMode, ratePer24Hr]);

  // Save Plan to Firestore
  const handleSavePlan = async () => {
    if (!result || !quantityKg) {
      toast.error('Please enter a valid quantity');
      return;
    }
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'productionPlans'), {
        partyName: partyName.trim() || 'General Production',
        size: size.trim() || 'N/A',
        quantityKg: Number(quantityKg),
        plantCount,
        shiftMode,
        ratePer24Hr,
        startDateTime,
        completionDateTime: result.completionDate.toISOString(),
        totalProductionHours: result.totalProductionHours,
        sundaysSkipped: result.sundaysSkipped,
        status: 'planned',
        jobCardId: selectedJobCardId || null,
        createdAt: serverTimestamp(),
        createdBy: currentUser.name || currentUser.loginId || 'Admin',
      });
      toast.success('Production Plan saved successfully!');
    } catch (err: any) {
      console.error('Error saving plan:', err);
      toast.error('Failed to save plan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Copy Plan Summary for WhatsApp
  const handleCopyWhatsApp = () => {
    if (!result) return;
    const msg = `🏭 *SUNSHINE POLYFILM - PRODUCTION PLAN*
━━━━━━━━━━━━━━━━━━━━
📋 *Order:* ${partyName ? partyName + ' - ' : ''}${size}
⚖️ *Total Quantity:* ${formatWeight(Number(quantityKg))} KG
⚙️ *Extruder Capacity:* ${plantCount} Plant${plantCount > 1 ? 's' : ''} (${plantCount === 2 ? 'Both Machines' : 'Single Machine'})
⏰ *Shift Mode:* ${shiftMode === '24hr' ? '24 Hours (Day + Night)' : '12 Hours (Day Shift Only)'}
📦 *Daily Output:* ${formatWeight(result.dailyCapacityKg)} KG/Day
⏱️ *Production Time:* ${result.totalDaysHoursFormatted} (${result.totalProductionHours.toFixed(1)} hrs)
🚫 *Sunday Shutdown:* ${result.sundaysSkipped > 0 ? `${result.sundaysSkipped} Sunday (Factory Paused)` : 'None'}
━━━━━━━━━━━━━━━━━━━━
🏁 *ESTIMATED COMPLETION:*
👉 *${result.completionFormatted}*
━━━━━━━━━━━━━━━━━━━━
_Generated via Sunshine ERP System_`;

    navigator.clipboard.writeText(msg).then(() => {
      toast.success('Plan summary copied to clipboard! Ready to send on WhatsApp.');
    }).catch(() => {
      toast.error('Could not copy to clipboard.');
    });
  };

  // Print Plan Sheet
  const handlePrintPlan = () => {
    if (!result) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sunshine Polyfilm - Production Plan Sheet</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 30px; color: #0f172a; }
            .header { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 15px; margin-bottom: 25px; }
            .title { font-size: 24px; font-weight: 800; color: #4f46e5; text-transform: uppercase; margin: 0; }
            .subtitle { font-size: 14px; color: #64748b; margin-top: 5px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
            .label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px; }
            .val { font-size: 18px; font-weight: 800; color: #0f172a; }
            .hero { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 16px; padding: 22px; text-align: center; margin-bottom: 25px; }
            .hero-title { font-size: 13px; text-transform: uppercase; font-weight: 800; color: #166534; margin-bottom: 6px; }
            .hero-date { font-size: 26px; font-weight: 900; color: #15803d; }
            .notes { border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">Sunshine Polyfilm Industries</h1>
            <div class="subtitle">Official Extruder Production Docket & Completion Plan</div>
          </div>

          <div class="hero">
            <div class="hero-title">🏁 Target Estimated Completion Date & Time</div>
            <div class="hero-date">${result.completionFormatted}</div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="label">Product / Film Size</div>
              <div class="val">${size}</div>
            </div>
            <div class="card">
              <div class="label">Order Quantity</div>
              <div class="val">${formatWeight(Number(quantityKg))} KG</div>
            </div>
            <div class="card">
              <div class="label">Party / Customer</div>
              <div class="val">${partyName || 'In-House Production'}</div>
            </div>
            <div class="card">
              <div class="label">Start Date & Time</div>
              <div class="val">${new Date(startDateTime).toLocaleString('en-IN')}</div>
            </div>
            <div class="card">
              <div class="label">Extruder Plants Allocated</div>
              <div class="val">${plantCount} Plant${plantCount > 1 ? 's' : ''} (${plantCount === 2 ? 'Both Machines Running' : 'Single Machine'})</div>
            </div>
            <div class="card">
              <div class="label">Daily Shift Mode</div>
              <div class="val">${shiftMode === '24hr' ? '24 Hours (Day + Night Continuous)' : '12 Hours (Day Shift 8 AM - 8 PM)'}</div>
            </div>
            <div class="card">
              <div class="label">Daily Production Capacity</div>
              <div class="val">${formatWeight(result.dailyCapacityKg)} KG / Day</div>
            </div>
            <div class="card">
              <div class="label">Total Production Time</div>
              <div class="val">${result.totalDaysHoursFormatted} (${result.totalProductionHours.toFixed(1)} hrs)</div>
            </div>
          </div>

          <div class="notes">
            <strong>Factory Sunday Policy:</strong> Both Extruder machines are completely shut down on Sundays (Day and Night). 
            ${result.sundaysSkipped > 0 ? `*Note: ${result.sundaysSkipped} Sunday was skipped in this schedule.*` : 'No Sunday downtime encountered.'}
          </div>

          <script>
            setTimeout(() => { window.print(); }, 400);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Delete saved plan
  const handleDeletePlan = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this production plan?')) return;
    try {
      await deleteDoc(doc(db, 'productionPlans', id));
      toast.success('Plan removed');
    } catch (err: any) {
      toast.error('Error deleting plan: ' + err.message);
    }
  };

  // Update saved plan status
  const handleUpdatePlanStatus = async (id: string, newStatus: 'planned' | 'in_progress' | 'completed') => {
    try {
      await updateDoc(doc(db, 'productionPlans', id), { status: newStatus });
      toast.success(`Plan marked as ${newStatus.replace('_', ' ')}`);
    } catch (err: any) {
      toast.error('Error updating plan: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* ── HEADER BANNER ─────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-xs font-black uppercase tracking-wider text-indigo-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin-slow" />
              <span>Smart Extruder Scheduler</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              <CalendarDays className="w-8 h-8 text-indigo-200" />
              <span>Production Planner (उत्पादन योजना)</span>
            </h1>
            <p className="text-sm sm:text-base text-indigo-100/90 max-w-2xl font-medium">
              Calculate exact order completion date & time based on 2 Extruder Machines, 12hr/24hr shifts, and automatic Sunday factory shutdown logic.
            </p>
          </div>

          {/* Quick Stats Banner */}
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/15 p-3 rounded-2xl self-start md:self-auto">
            <div className="p-3 bg-indigo-500/40 rounded-xl">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Factory Extruders</div>
              <div className="text-lg font-black">2 Plants Available</div>
              <div className="text-[11px] text-indigo-100">Standard: 850 KG / 24 Hr per machine (425 KG / 12 Hr shift)</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN PLANNER INTERACTIVE CARD ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Inputs (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">1</div>
                <h3 className="text-base font-black text-slate-900">Order & Film Parameters</h3>
              </div>
              {/* Optional Job Card Loader */}
              {jobCards.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Or Link Job Card:</span>
                  <select
                    value={selectedJobCardId}
                    onChange={(e) => handleSelectJobCard(e.target.value)}
                    className="text-xs font-bold bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select Pending Job Card --</option>
                    {jobCards
                      .filter((j) => j.status !== 'completed' && j.status !== 'dispatched')
                      .map((jc) => (
                        <option key={jc.id} value={jc.id}>
                          {jc.jobCode} ({jc.size || 'No Size'} - {jc.totalQuantity}kg)
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Film Size (mm)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="e.g. 190 mm, 230 mm"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                  <div className="flex gap-1.5 mt-2">
                    {['190 mm', '230 mm', '250 mm', '300 mm'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        className={`text-[11px] px-2 py-0.5 rounded-lg border font-semibold transition-colors ${
                          size === s
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Order Quantity (KG) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantityKg}
                    onChange={(e) => setQuantityKg(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 5000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-base font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                  <span className="absolute right-4 top-3 text-sm font-bold text-slate-400">KG</span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[1000, 3000, 5000, 10000].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuantityKg(q)}
                      className={`text-[11px] px-2 py-0.5 rounded-lg border font-semibold transition-colors ${
                        quantityKg === q
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {q.toLocaleString()} kg
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Party / Customer Name (Optional)
                </label>
                <input
                  type="text"
                  list="parties-list"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="e.g. Balaji Industries, Shree Polyfilm, etc."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <datalist id="parties-list">
                  {Object.entries(PARTIES).map(([code, name]) => (
                    <option key={code} value={name}>
                      {code} - {name}
                    </option>
                  ))}
                </datalist>
              </div>

              {/* Start Date & Time */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Production Start Date & Time
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={setStartNow}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                    >
                      Now
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={setStartTomorrowMorning}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                    >
                      Tomorrow 8 AM
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={setStartNextMonday}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                    >
                      Monday 8 AM
                    </button>
                  </div>
                </div>
                <input
                  type="datetime-local"
                  value={startDateTime}
                  onChange={(e) => setStartDateTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                />
              </div>
            </div>

            {/* Step 2: Machines & Shift Selectors */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">2</div>
                <h3 className="text-base font-black text-slate-900">Extruder Plants & Shift Selection</h3>
              </div>

              {/* 1 Plant vs 2 Plants */}
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Select Machine Allocation:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPlantCount(1)}
                    className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all ${
                      plantCount === 1
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                        plantCount === 1 ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {plantCount === 1 && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                        <span>1 Plant (Single Machine)</span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">
                        Capacity: 850 KG / 24 Hours (~35.4 kg/hr | 425 kg / 12hr)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlantCount(2)}
                    className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all ${
                      plantCount === 2
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                        plantCount === 2 ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {plantCount === 2 && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                        <span>2 Plants (Both Machines)</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                          2X Speed ⚡
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">
                        Capacity: 1,700 KG / 24 Hours (~70.8 kg/hr | 850 kg / 12hr)
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 12 Hour vs 24 Hour */}
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Select Daily Running Shifts:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShiftMode('12hr')}
                    className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all ${
                      shiftMode === '12hr'
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                        shiftMode === '12hr' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {shiftMode === '12hr' && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">12 Hours / Day</div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">
                        Day Shift (8:00 AM to 8:00 PM) • 425 kg/day (1 Plant) | 850 kg/day (2 Plants)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShiftMode('24hr')}
                    className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all ${
                      shiftMode === '24hr'
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                        shiftMode === '24hr' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {shiftMode === '24hr' && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                        <span>24 Hours / Day</span>
                        <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded-full">
                          24/7 Day & Night
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">
                        Day & Night 24/7 • 850 kg/day (1 Plant) | 1,700 kg/day (2 Plants)
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Sunday Shutdown Rule Highlight */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-black">Sunday Factory Holiday Rule:</span> Machines remain completely closed all day & night on Sundays (24 Hours Off). Any production that reaches Sunday will automatically pause and resume Monday morning.
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  <span>{showAdvanced ? '− Hide Machine Output Settings' : '+ Custom Machine Output (Default: 850 KG / 24 Hr)'}</span>
                </button>
                {showAdvanced && (
                  <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Machine Capacity per 24-Hour Day (KG)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={ratePer24Hr}
                        onChange={(e) => setRatePer24Hr(Number(e.target.value) || 850)}
                        className="w-36 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900"
                      />
                      <span className="text-xs text-slate-500">KG / 24 Hr per machine (Default: 850 kg | 425 kg per 12hr)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Hero Result & Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Hero Result Card */}
          <div className="bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl shadow-emerald-600/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-emerald-400/20 rounded-full blur-2xl"></div>

            <div className="relative z-10 space-y-5">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Calculated Completion</span>
                </span>
                <span className="text-xs font-bold text-emerald-200 bg-emerald-900/60 px-2.5 py-1 rounded-lg">
                  {plantCount} Machine{plantCount > 1 ? 's' : ''} • {shiftMode}
                </span>
              </div>

              {result ? (
                <>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-200/90 block mb-1">
                      Expected Order Finish Date & Time:
                    </span>
                    <div className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                      {result.completionFormatted}
                    </div>
                  </div>

                  {/* Highlight Metrics */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                      <div className="text-[11px] font-bold text-emerald-200 uppercase">Total Production</div>
                      <div className="text-lg font-black text-white mt-0.5">{result.totalDaysHoursFormatted}</div>
                      <div className="text-[10px] text-emerald-100/70">({result.totalProductionHours.toFixed(1)} hrs)</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                      <div className="text-[11px] font-bold text-emerald-200 uppercase">Daily Output</div>
                      <div className="text-lg font-black text-white mt-0.5">{formatWeight(result.dailyCapacityKg)} KG</div>
                      <div className="text-[10px] text-emerald-100/70">per {shiftMode} day</div>
                    </div>
                  </div>

                  {/* Sunday Downtime Info */}
                  <div className="bg-black/20 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs border border-white/10">
                    <span className="text-emerald-100">Sundays Skipped (Factory Off):</span>
                    <span className={`font-black px-2 py-0.5 rounded-full ${result.sundaysSkipped > 0 ? 'bg-amber-400 text-slate-900' : 'bg-white/20 text-white'}`}>
                      {result.sundaysSkipped} Sunday{result.sundaysSkipped !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2.5 pt-2">
                    <button
                      type="button"
                      onClick={handleSavePlan}
                      disabled={isSaving}
                      className="w-full py-3.5 px-4 rounded-2xl bg-white text-slate-900 hover:bg-emerald-50 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                      <Plus className="w-4 h-4 text-emerald-600" />
                      <span>{isSaving ? 'Saving Plan...' : 'Save to Production Schedule'}</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleCopyWhatsApp}
                        className="py-2.5 px-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copy WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePrintPlan}
                        className="py-2.5 px-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Print Plan</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-emerald-200">
                  <Timer className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">Enter order quantity to see estimated completion date</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Summary Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Summary Breakdown</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Target Size & Qty:</span>
                <span className="font-extrabold text-slate-800">{size || 'N/A'} • {formatWeight(Number(quantityKg) || 0)} KG</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Allocated Extruders:</span>
                <span className="font-extrabold text-slate-800">{plantCount} Plant{plantCount > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Shift Configuration:</span>
                <span className="font-extrabold text-slate-800">{shiftMode === '24hr' ? '24 Hours (Day & Night)' : '12 Hours (Day Shift)'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Machine Production Rate:</span>
                <span className="font-extrabold text-slate-800">{ratePer24Hr} KG / 24 Hr per machine ({(ratePer24Hr / 2).toFixed(0)} KG / 12 Hr)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Total Speed:</span>
                <span className="font-extrabold text-emerald-600">
                  {((ratePer24Hr * plantCount) / 24).toFixed(1)} KG / Hour
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ALL 4 SCENARIOS COMPARISON MATRIX ─────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>What-If Analysis: Compare All 4 Options Side-by-Side</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Instantly compare timeline across 1 plant vs 2 plants and 12hr vs 24hr shifts for this order.
            </p>
          </div>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full self-start">
            Click any card to apply
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {scenarios.map((sc, idx) => (
            <div
              key={idx}
              onClick={() => {
                setPlantCount(sc.plantCount);
                setShiftMode(sc.shiftMode);
              }}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                sc.isSelected
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-md scale-[1.02]'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-800">{sc.label}</span>
                  {sc.isSelected && (
                    <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{sc.badge}</div>
                {sc.res ? (
                  <div className="space-y-1.5 my-3">
                    <div className="text-xs text-slate-500">Estimated Finish:</div>
                    <div className="text-sm font-black text-slate-900 leading-tight">
                      {sc.res.completionFormatted}
                    </div>
                    <div className="text-xs font-bold text-emerald-600 mt-1">
                      ⏱️ {sc.res.totalDaysHoursFormatted}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-4">Enter quantity</div>
                )}
              </div>

              {sc.res && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Output: {formatWeight(sc.res.dailyCapacityKg)} kg/day</span>
                  {sc.res.sundaysSkipped > 0 && (
                    <span className="text-amber-600 font-bold">1 Sun Off</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── SAVED PRODUCTION SCHEDULE QUEUE ──────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Saved Production Plans & Schedule</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Active and planned extrusion orders saved by Admin.</p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            {savedPlans.length} Total Plans
          </span>
        </div>

        {savedPlans.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">No saved production plans yet.</p>
            <p className="text-xs mt-1">Fill out the planner above and click "Save to Production Schedule".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedPlans.map((plan) => {
              const compDate = new Date(plan.completionDateTime);
              const formattedDate = compDate.toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              });

              return (
                <div
                  key={plan.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800">
                          {plan.size}
                        </span>
                        <h4 className="text-base font-black text-slate-900 mt-1">{plan.partyName || 'General'}</h4>
                      </div>
                      <select
                        value={plan.status}
                        onChange={(e) => handleUpdatePlanStatus(plan.id, e.target.value as any)}
                        className={`text-[11px] font-black uppercase rounded-lg px-2 py-1 border shadow-xs cursor-pointer ${
                          plan.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : plan.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-blue-100 text-blue-800 border-blue-300'
                        }`}
                      >
                        <option value="planned">⏳ Planned</option>
                        <option value="in_progress">🔥 Running</option>
                        <option value="completed">✅ Done</option>
                      </select>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 pt-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Quantity:</span>
                        <span className="font-extrabold text-slate-900">{formatWeight(plan.quantityKg)} KG</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Extruders:</span>
                        <span className="font-semibold text-slate-700">{plan.plantCount} Plant • {plan.shiftMode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Hours:</span>
                        <span className="font-semibold text-slate-700">{plan.totalProductionHours.toFixed(1)} hrs</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 mt-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Target Completion:</div>
                      <div className="text-sm font-black text-emerald-700 mt-0.5">{formattedDate}</div>
                      {plan.sundaysSkipped > 0 && (
                        <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                          ⚠️ {plan.sundaysSkipped} Sunday Holiday Included
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-[10px] text-slate-400">By {plan.createdBy || 'Admin'}</span>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(plan.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold p-1"
                      title="Delete plan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
