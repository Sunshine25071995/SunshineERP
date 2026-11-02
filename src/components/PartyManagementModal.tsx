import React, { useState, useMemo } from 'react';
import { JobCard, JobCardParty, User } from '../types';
import { 
  useJobCardParties, 
  addJobCardParty, 
  updateJobCardParty, 
  deleteJobCardParty, 
  getNextPartyCode 
} from '../utils/parties';
import { 
  X, Plus, Edit2, Trash2, Search, Check, AlertTriangle, 
  Building, Phone, User as UserIcon, ClipboardList, Loader2, RefreshCw
} from 'lucide-react';
import { logActivity } from '../services/activityLog';

interface PartyManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobCards: JobCard[];
  onPartySelect?: (partyCode: string) => void;
  currentUser?: User;
}

export const PartyManagementModal: React.FC<PartyManagementModalProps> = ({
  isOpen,
  onClose,
  jobCards,
  onPartySelect,
  currentUser,
}) => {
  const { parties, loading } = useJobCardParties();
  const [search, setSearch] = useState('');
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingParty, setEditingParty] = useState<JobCardParty | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deletion modal state
  const [deletingParty, setDeletingParty] = useState<JobCardParty | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Map of job card count per party code
  const partyJobCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const jc of jobCards) {
      if (jc.partyCode) {
        const clean = jc.partyCode.trim();
        const padded = clean.padStart(3, '0');
        map[clean] = (map[clean] || 0) + 1;
        if (clean !== padded) {
          map[padded] = (map[padded] || 0) + 1;
        }
      }
    }
    return map;
  }, [jobCards]);

  // Filter parties by search
  const filteredParties = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.code.toLowerCase().includes(q) ||
      (p.contactPerson && p.contactPerson.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q))
    );
  }, [parties, search]);

  const openAddForm = () => {
    setEditingParty(null);
    setFormName('');
    setFormCode(getNextPartyCode(parties));
    setFormContact('');
    setFormPhone('');
    setFormNotes('');
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (party: JobCardParty) => {
    setEditingParty(party);
    setFormName(party.name);
    setFormCode(party.code);
    setFormContact(party.contactPerson || '');
    setFormPhone(party.phone || '');
    setFormNotes(party.notes || '');
    setFormError(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingParty(null);
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('Party Name is required.');
      return;
    }

    const trimmedCode = formCode.trim();
    if (!trimmedCode) {
      setFormError('Party Code is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingParty) {
        await updateJobCardParty(editingParty.id, {
          name: trimmedName,
          code: trimmedCode,
          contactPerson: formContact,
          phone: formPhone,
          notes: formNotes,
        });

        if (currentUser) {
          await logActivity(
            'Job Card Party Updated',
            `Updated Party: ${trimmedName} (${trimmedCode})`,
            currentUser.id || currentUser.loginId,
            currentUser.name
          );
        }
      } else {
        const newParty = await addJobCardParty({
          name: trimmedName,
          code: trimmedCode,
          contactPerson: formContact,
          phone: formPhone,
          notes: formNotes,
        });

        if (currentUser) {
          await logActivity(
            'Job Card Party Created',
            `Created Party: ${trimmedName} (${newParty.code})`,
            currentUser.id || currentUser.loginId,
            currentUser.name
          );
        }

        if (onPartySelect) {
          onPartySelect(newParty.code);
        }
      }

      handleCloseForm();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to save party. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingParty) return;
    setIsDeleting(true);
    try {
      await deleteJobCardParty(deletingParty.id);

      if (currentUser) {
        await logActivity(
          'Job Card Party Deleted',
          `Deleted Party: ${deletingParty.name} (${deletingParty.code})`,
          currentUser.id || currentUser.loginId,
          currentUser.name
        );
      }

      setDeletingParty(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to delete party.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Manage Job Card Parties</h2>
              <p className="text-xs text-gray-500 font-medium">Add, edit, or delete customer parties for job cards</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Search Bar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by party name or code (e.g. 001)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-9 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {!showForm && (
            <button
              onClick={openAddForm}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition shadow-sm shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Party</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* Add / Edit Form Card */}
          {showForm && (
            <form onSubmit={handleSave} className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 sm:p-5 animate-scale-in">
              <div className="flex items-center justify-between pb-3 border-b border-indigo-100/70 mb-4">
                <span className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                  {editingParty ? <Edit2 className="w-4 h-4 text-indigo-600" /> : <Plus className="w-4 h-4 text-indigo-600" />}
                  {editingParty ? `Edit Party: ${editingParty.name}` : 'New Job Card Party'}
                </span>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="text-xs text-indigo-700 hover:text-indigo-950 font-semibold"
                >
                  Cancel
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Party Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shree Polyfilm Pvt Ltd"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Party Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 008"
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Contact Person (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Bhai"
                    value={formContact}
                    onChange={e => setFormContact(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Mobile / Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Notes / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ahmedabad branch"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-indigo-100/70">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200/60 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 active:scale-95 transition disabled:opacity-60 shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingParty ? 'Update Party' : 'Save Party'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* List of Parties */}
          {loading ? (
            <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <p className="text-sm">Loading parties…</p>
            </div>
          ) : filteredParties.length === 0 ? (
            <div className="py-12 text-center text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 p-6">
              <Building className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-bold text-gray-600">No parties found</p>
              <p className="text-xs text-gray-400 mt-1">
                {search ? 'Try adjusting your search query.' : 'Click "Add Party" above to create your first party.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredParties.map(party => {
                const count = partyJobCount[party.code] || 0;
                return (
                  <div
                    key={party.id}
                    className="p-3.5 sm:p-4 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      {/* Code Badge */}
                      <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs flex-shrink-0">
                        {party.code}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-gray-900 group-hover:text-indigo-900 transition-colors">
                            {party.name}
                          </h4>
                          {count > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                              <ClipboardList className="w-3 h-3" />
                              {count} Job Card{count > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                              0 Jobs
                            </span>
                          )}
                        </div>

                        {(party.contactPerson || party.phone) && (
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                            {party.contactPerson && (
                              <span className="inline-flex items-center gap-1">
                                <UserIcon className="w-3 h-3 text-gray-400" />
                                {party.contactPerson}
                              </span>
                            )}
                            {party.phone && (
                              <a
                                href={`tel:${party.phone}`}
                                className="inline-flex items-center gap-1 text-gray-600 hover:text-indigo-600 font-medium"
                              >
                                <Phone className="w-3 h-3 text-gray-400" />
                                {party.phone}
                              </a>
                            )}
                          </div>
                        )}
                        {party.notes && (
                          <p className="text-xs text-gray-400 mt-0.5 italic">{party.notes}</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      {onPartySelect && (
                        <button
                          onClick={() => {
                            onPartySelect(party.code);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                        >
                          Select
                        </button>
                      )}
                      <button
                        onClick={() => openEditForm(party)}
                        title="Edit Party"
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingParty(party)}
                        title="Delete Party"
                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
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

        {/* Modal Footer */}
        <div className="px-5 py-3 sm:px-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Total: <strong>{parties.length}</strong> parties</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition shadow-xs"
          >
            Close
          </button>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {deletingParty && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-100 animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-gray-900">Delete Party?</h3>
              <p className="text-sm font-semibold text-gray-700">
                "{deletingParty.name}" <span className="font-mono text-xs text-indigo-700">({deletingParty.code})</span>
              </p>
            </div>

            {(partyJobCount[deletingParty.code] || 0) > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  Warning: Used in {partyJobCount[deletingParty.code]} Job Card(s)
                </p>
                <p>
                  Deleting this party will not delete the job cards, but those job cards will show the raw code ({deletingParty.code}) instead of the company name.
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center">
                This party is not currently linked to any job cards. It can be safely removed.
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingParty(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 active:scale-95 transition disabled:opacity-60 shadow-sm shadow-rose-600/30 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <span>Delete Party</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
