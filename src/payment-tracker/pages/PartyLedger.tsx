import React, { useEffect, useState, useRef } from 'react';

import { dbService } from '../db';
import { Party, Bill, Payment } from '../types';
import { formatCurrency, formatDate, calculateDueDays, cn } from '../utils';
import { ArrowLeft, Printer, Share2, ReceiptText, Banknote, UserRound, Clock, CheckCircle2, FileText, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type LedgerEntry = {
  id: string;
  date: number;
  type: 'bill' | 'payment';
  ref: string;
  billAmount: number;
  receivedAmount: number;
  balance: number;
  dueDays?: number;
  isCleared?: boolean;
};

export function PartyLedger({ id, onNavigate }: { id?: string, onNavigate: (view: string) => void }) {
  
  const [party, setParty] = useState<Party | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      setLoading(true);
      try {
        const [allParties, allBills, allPayments] = await Promise.all([
          dbService.getParties(),
          dbService.getBills(),
          dbService.getPayments()
        ]);

        const currentParty = allParties.find(p => p.id === id);
        if (currentParty) {
          setParty(currentParty);
          
          const partyBills = allBills.filter(b => b.party_id === id);
          const partyPayments = allPayments.filter(p => p.party_id === id);

          setBills(partyBills.sort((a, b) => a.bill_date - b.bill_date));
          setPayments(partyPayments.sort((a, b) => a.payment_date - b.payment_date));

          // Combine to chronological ledger
          const combined = [
            ...partyBills.map(b => ({
              id: b.id,
              date: b.bill_date,
              type: 'bill' as const,
              ref: b.bill_number,
              billAmount: b.bill_amount,
              receivedAmount: 0,
              dueDays: calculateDueDays(b.bill_date, b.fully_paid_date),
              isCleared: b.outstanding_amount <= 0
            })),
            ...partyPayments.map(p => ({
              id: p.id,
              date: p.payment_date,
              type: 'payment' as const,
              ref: p.reference_number ? `Receipt: ${p.payment_mode} - ${p.reference_number}` : `Receipt: ${p.payment_mode}`,
              billAmount: 0,
              receivedAmount: p.amount,
            }))
          ].sort((a, b) => a.date - b.date);

          let runningBalance = 0;
          const entriesWithBalance = combined.map(entry => {
            runningBalance += entry.billAmount;
            runningBalance -= entry.receivedAmount;
            return { ...entry, balance: runningBalance };
          });

          setLedgerEntries(entriesWithBalance);
        }
      } catch (error) {
        console.error("Failed to load ledger data", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }
  if (!party) return <div className="p-8 text-lg font-medium text-center text-red-500">Party not found</div>;

  const totalBillsAmount = bills.reduce((sum, b) => sum + b.bill_amount, 0);
  const totalReceivedAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPendingAmount = bills.reduce((sum, b) => sum + b.outstanding_amount, 0);

  const handleWhatsApp = () => {
    let msg = `📄 *LEDGER STATEMENT* 📄\n`;
    msg += `👤 *Party:* ${party.party_name}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `🧾 *Total Bills:* ₹${totalBillsAmount.toLocaleString('en-IN')}\n`;
    msg += `💸 *Total Received:* ₹${totalReceivedAmount.toLocaleString('en-IN')}\n`;
    msg += `🚨 *Total Pending:* ₹${totalPendingAmount.toLocaleString('en-IN')}\n`;
    if (party.advance_balance > 0) {
      msg += `💰 *Advance Bal:* ₹${party.advance_balance.toLocaleString('en-IN')}\n`;
    }
    msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `*Recent Entries:*\n\n`;
    const recent = [...ledgerEntries].reverse().slice(0, 10);
    recent.forEach(e => {
      msg += `📅 *${formatDate(e.date)}* - ${e.type === 'bill' ? '🧾 Bill' : '💸 Receipt'}\n`;
      if (e.type === 'bill') {
        msg += `Amt: ₹${e.billAmount.toLocaleString('en-IN')} | Bal: *₹${e.balance.toLocaleString('en-IN')}*\n\n`;
      } else {
        msg += `Amt: ₹${e.receivedAmount.toLocaleString('en-IN')} | Bal: *₹${e.balance.toLocaleString('en-IN')}*\n\n`;
      }
    });
    msg += `_Generated via Sunshine ERP_`;
    
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleDownloadPDF = () => {
    // On mobile and desktop, print dialog provides robust 'Save as PDF'
    window.print();
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-12" ref={reportRef}>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('parties')} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-colors print:hidden action-buttons-container-exclude">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <UserRound className="h-7 w-7 text-indigo-500" />
              {party.party_name}
            </h1>
            <p className="text-slate-500 font-medium ml-9 mt-1">{party.mobile}</p>
          </div>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto action-buttons-container">
          <button 
            onClick={handleWhatsApp}
            disabled={isExporting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50"
          >
            <Share2 className="h-5 w-5" /> {isExporting ? 'Generating...' : 'WhatsApp'}
          </button>
          <button 
            onClick={handleDownloadPDF}
            disabled={isExporting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <Download className="h-5 w-5" /> PDF
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col">
          <div className="text-slate-500 flex items-center gap-2 mb-2">
            <ReceiptText className="h-4 w-4 text-indigo-500" />
            <span className="font-medium text-xs">Total Bill Amount</span>
          </div>
          <span className="text-2xl font-bold text-slate-900 mt-auto">{formatCurrency(totalBillsAmount)}</span>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col">
          <div className="text-slate-500 flex items-center gap-2 mb-2">
            <Banknote className="h-4 w-4 text-emerald-500" />
            <span className="font-medium text-xs">Total Received</span>
          </div>
          <span className="text-2xl font-bold text-slate-900 mt-auto">{formatCurrency(totalReceivedAmount)}</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col">
          <div className="text-slate-500 flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-rose-500" />
            <span className="font-medium text-xs">Total Pending</span>
          </div>
          <span className="text-2xl font-bold text-slate-900 mt-auto">{formatCurrency(totalPendingAmount)}</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col">
          <div className="text-slate-500 flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-amber-500" />
            <span className="font-medium text-xs">Advance Balance</span>
          </div>
          <span className="text-2xl font-bold text-slate-900 mt-auto">{formatCurrency(party.advance_balance)}</span>
        </div>
      </div>

      {/* ALL ENTRIES LEDGER TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-white px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-500" />
            Chronological Ledger
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
                <th className="px-2 py-2 font-medium">Date/Ref</th>
                                <th className="px-2 py-2 font-medium text-right">Bill(₹)</th>
                <th className="px-2 py-2 font-medium text-right">Recvd(₹)</th>
                <th className="px-2 py-2 font-medium text-right">Balance(₹)</th>
                <th className="px-2 py-2 font-medium text-center">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgerEntries.map(entry => {
                const isBill = entry.type === 'bill';
                
                return (
                  <tr key={entry.id} className={cn(
                    "transition-colors hover:bg-slate-50",
                    isBill && entry.isCleared ? "bg-slate-50/50 opacity-75" : "bg-white"
                  )}>
                    <td className="px-2 py-2 text-xs font-medium text-slate-700">
                      <div className="flex flex-col">
                        <span>{formatDate(entry.date)}</span>
                        <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                          {isBill ? <ReceiptText className="h-3 w-3"/> : <Banknote className="h-3 w-3"/>}
                          <span className="truncate max-w-[80px] sm:max-w-[120px]">{entry.ref}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-semibold text-slate-900">
                      {isBill ? formatCurrency(entry.billAmount) : '-'}
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-semibold text-emerald-600">
                      {!isBill ? formatCurrency(entry.receivedAmount) : '-'}
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-bold text-rose-600">
                      {formatCurrency(entry.balance)}
                    </td>
                    <td className="px-2 py-2 text-center text-xs">
                      {isBill ? (
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border",
                          entry.isCleared 
                            ? "bg-slate-100 text-slate-600 border-slate-200" 
                            : "bg-rose-50 text-rose-700 border-rose-100"
                        )}>
                          {entry.dueDays} days {entry.isCleared ? 'taken' : 'due'}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              
              {ledgerEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs font-medium">
                    No entries recorded for this party.
                  </td>
                </tr>
              )}
            </tbody>
            
            {/* TABLE FOOTER FOR TOTALS */}
            {ledgerEntries.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={1} className="px-2 py-2 font-bold text-slate-700 text-left text-xs">Total</td>
                  <td className="px-2 py-2 font-bold text-slate-900 text-right text-xs">{formatCurrency(totalBillsAmount)}</td>
                  <td className="px-2 py-2 font-bold text-emerald-600 text-right text-xs">{formatCurrency(totalReceivedAmount)}</td>
                  <td className="px-2 py-2 font-bold text-rose-600 text-right text-xs">{formatCurrency(totalPendingAmount)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
