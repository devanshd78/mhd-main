"use client";

import React, { useEffect, useState, ChangeEvent, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import api from '@/lib/axios';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead as TH,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

interface HistoryItem {
  field: string;
  from: number;
  to: number;
  updatedAt: string;
  _id: string;
}

interface Screenshot {
  _id: string;
  userId: string;
  linkId: string;
  verified: boolean;
  analysis?: {
    liked?: boolean;
    user_id?: string;
    comment?: string[];
    replies?: string[];
    verified?: boolean;
  };
  screenshotId: string;
  createdAt: string;
}

interface Submission {
  entryId: string;
  name: string;
  upiId: string;
  notes?: string;
  amount?: number;
  createdAt: string;
  type?: number;
  noOfPersons?: number;
  linkAmount?: number;
  totalAmount?: number;
  telegramLink?: string;
  status?: number;
  history?: HistoryItem[];
  isUpdated?: number;
  screenshot?: Screenshot; // <-- NEW when new payload is returned
}

const PAGE_SIZE = 10;

function shortId(id?: string, head = 8, tail = 6) {
  if (!id) return '—';
  if (id.length <= head + tail) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export default function LinkEntriesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const linkId = params.get('id');
  const employeeId =
    (typeof window !== 'undefined' && localStorage.getItem('employeeId')) || "";

  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // edit modal states
  const [showEdit, setShowEdit] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Submission | null>(null);
  const [editPersons, setEditPersons] = useState(0);
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // history modal states
  const [showHistory, setShowHistory] = useState(false);
  const [historyEntry, setHistoryEntry] = useState<Submission | null>(null);

  // analysis modal (only used for new response)
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [analysisForId, setAnalysisForId] = useState<string>("");

  const isNewPayload = useMemo(
    () => subs.some(s => typeof s?.screenshot?.screenshotId === 'string'),
    [subs]
  );

  // load balance (kept as-is)
  useEffect(() => {
    if (!employeeId) return;
    api.get(`/employee/balance?employeeId=${employeeId}`)
      .then(() => {})
      .catch(() => {});
  }, [employeeId]);

  // fetch
  const fetchEntries = async (p = 1) => {
    if (!linkId || !employeeId) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post<{
        entries: Submission[];
        total: number;
        page: number;
        pages: number;
        grandTotal: number;
      }>("/entry/listByLink", { linkId, employeeId, page: p, limit: PAGE_SIZE }, { withCredentials: true });

      setSubs(data.entries);
      setTotalAmount(data.grandTotal);
      setPage(data.page);
      setPages(data.pages);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load entries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(1); }, [linkId, employeeId]);

  // start edit
  const startEditTypeOne = (entry: Submission) => {
    setEditingEntry(entry);
    setEditPersons(entry.noOfPersons ?? 0);
    setEditError("");
    setShowEdit(true);
  };

  const handleEditPersons = async () => {
    if (!editingEntry) return;
    if (editPersons < 1 || (editingEntry.noOfPersons!==undefined && editPersons>editingEntry.noOfPersons)) {
      setEditError(`Value must be between 1 and ${editingEntry.noOfPersons}`);
      return;
    }
    setIsSavingEdit(true);
    try {
      await api.post("/entry/updateEntry", { noOfPersons: editPersons, entryId: editingEntry.entryId }, { withCredentials: true });
      setShowEdit(false);
      fetchEntries(page);
    } finally { setIsSavingEdit(false); }
  };

  // history viewer
  const startHistoryView = (entry: Submission) => {
    setHistoryEntry(entry);
    setShowHistory(true);
  };

  // approve/reject
  const handleApprove = async (id: string, approve: number) => {
    try {
      await api.post("/entry/updateStatus", { entryId: id, approve }, { withCredentials: true });
      Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Status updated", showConfirmButton:false, timer:1500, timerProgressBar:true });
      fetchEntries(page);
    } catch (err:any) {
      Swal.fire({ toast:true, position:"top-end", icon:"error", title: err.response?.data?.error||"Update failed", showConfirmButton:false, timer:1500, timerProgressBar:true });
    }
  };

  const Pager = () => pages>1? (
    <div className="flex items-center justify-center gap-4 py-4">
      <Button size="sm" variant="outline" disabled={page===1} onClick={()=>fetchEntries(page-1)}>Prev</Button>
      <span className="text-sm">Page {page} of {pages}</span>
      <Button size="sm" variant="outline" disabled={page===pages} onClick={()=>fetchEntries(page+1)}>Next</Button>
    </div>
  ): null;

  const openAnalysis = (s: Screenshot | undefined) => {
    if (!s) return;
    setAnalysisForId(s.screenshotId);
    setAnalysisData(s.analysis || null);
    setAnalysisOpen(true);
  };

  if (!linkId) return <p className="text-red-500 text-center mt-10">No link selected.</p>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Entries for Link</h2>
        <Button variant="outline" onClick={()=>router.push("/employee/dashboard")}>Go Home</Button>
      </div>

      {/* Edit Modal */}
      {editingEntry?.type===1 && (
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 bg-black/50" />
            <DialogContent className="fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-2xl shadow-lg">
              <DialogHeader><DialogTitle>Edit Number of Persons</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Persons</label>
                  <Input
                    type="number"
                    min={1}
                    max={editingEntry.noOfPersons}
                    value={editPersons}
                    onChange={(e:ChangeEvent<HTMLInputElement>)=>{
                      const v=Number(e.target.value); setEditPersons(v);
                      if(editingEntry.noOfPersons!==undefined && v>editingEntry.noOfPersons) setEditError(`Value cannot exceed ${editingEntry.noOfPersons}`);
                      else if(v<1) setEditError('Value must be at least 1'); else setEditError('');
                    }}
                  />
                  {editError && <p className="text-red-600 text-sm mt-1">{editError}</p>}
                </div>
                <div className="text-sm">Total = <strong>₹{(editingEntry.linkAmount||0)*editPersons}</strong></div>
              </div>
              <DialogFooter className="flex justify-end space-x-2 mt-6">
                <Button size="sm" variant="outline" onClick={()=>setShowEdit(false)} disabled={isSavingEdit}>Cancel</Button>
                <Button size="sm" onClick={handleEditPersons} disabled={isSavingEdit||Boolean(editError)}>{isSavingEdit?"Saving…":"Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      )}

      {/* History Modal */}
      {historyEntry && (
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 bg-black/50" />
            <DialogContent className="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-2xl shadow-lg">
              <DialogHeader><DialogTitle>Update History</DialogTitle></DialogHeader>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {historyEntry.history?.map(item=> (
                  <div key={item._id} className="p-2 border rounded">
                    <div className="text-sm font-medium">{item.field}</div>
                    <div className="text-xs">from {item.from} to {item.to}</div>
                    <div className="text-xs text-gray-500">{format(new Date(item.updatedAt), 'PPpp')}</div>
                  </div>
                ))}
              </div>
              <DialogFooter className="flex justify-end mt-4">
                <Button size="sm" variant="outline" onClick={()=>setShowHistory(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      )}

      {/* Analysis Modal (new payload only) */}
      {analysisOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setAnalysisOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-lg max-w-2xl w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <pre className="mt-2 bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
              {analysisData ? JSON.stringify(analysisData, null, 2) : "—"}
            </pre>
            <div className="flex items-center justify-end mt-2">
              <Button size="sm" variant="outline" onClick={() => setAnalysisOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <>
          {!isNewPayload ? (
            // ----------------- OLD RESPONSE: render exactly as-is -----------------
            <>
              <Table>
                <TableHeader className="bg-gray-100">
                  <TableRow>
                    <TH>Name</TH>
                    <TH>UPI ID</TH>
                    {subs[0]?.type===1 ? <>
                      <TH>Telegram</TH>
                      <TH>Status</TH>
                      <TH className="text-center">Persons</TH>
                      <TH className="text-center">Amt/Person</TH>
                      <TH className="text-center">Total</TH>
                      <TH>Updated</TH>
                    </> : <TH>Notes</TH>}
                    <TH className="text-right">Submitted</TH>
                    <TH className="text-right">Action</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map(s => (
                    <TableRow key={s.entryId}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.upiId}</TableCell>
                      {s.type===1 ? <>
                        <TableCell>
                          <a
                            href={s.telegramLink?.startsWith('http')?s.telegramLink:`https://t.me/${s.telegramLink}`}
                            target="_blank" rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Open
                          </a>
                        </TableCell>
                        <TableCell>
                          {s.status===1
                            ? <Badge className="bg-green-600 text-white">Approved</Badge>
                            : s.status===0
                            ? <Badge variant="destructive" className="bg-red-600">Rejected</Badge>
                            : <Badge variant="outline" className="bg-yellow-400">Pending</Badge>}
                        </TableCell>
                        <TableCell className="text-center">{s.noOfPersons}</TableCell>
                        <TableCell className="text-center">₹{s.linkAmount}</TableCell>
                        <TableCell className="text-center">₹{s.totalAmount}</TableCell>
                        <TableCell>
                          {s.isUpdated ? (
                            <Button size="sm" variant="outline" onClick={()=>startHistoryView(s)}>View</Button>
                          ) : ('-')}
                        </TableCell>
                      </> : <TableCell className="truncate max-w-[200px]">{s.notes||'-'}</TableCell>}
                      <TableCell className="text-right whitespace-nowrap">{format(new Date(s.createdAt), 'PPpp')}</TableCell>
                      <TableCell className="text-right align-top">
                        <div className="flex flex-col items-end space-y-2">
                          {s.type===1 ? (
                            <Button size="sm" variant="outline" onClick={()=>startEditTypeOne(s)}>Update Entry</Button>
                          ) : (
                            <Button size="sm" variant="outline">Edit</Button>
                          )}
                          <div className="flex space-x-2">
                            <Button size="sm" variant="default" onClick={()=>handleApprove(s.entryId,1)}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={()=>handleApprove(s.entryId,0)}>Reject</Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pager />

              <div className="text-right text-lg font-semibold pt-2">
                Paid Total: ₹{totalAmount.toFixed(2)}
              </div>
            </>
          ) : (
            // ----------------- NEW RESPONSE: show screenshot info, paid & all -----------------
            <>
              <Table>
                <TableHeader className="bg-gray-100">
                  <TableRow>
                    <TH>Name</TH>
                    <TH>UPI ID</TH>
                    <TH>Status</TH>
                    <TH className="text-center">Amt/Person</TH>
                    <TH className="text-center">Total Paid</TH>
                    <TH className="text-center">Verified</TH>
                    <TH>Analysis</TH>
                    <TH className="text-right">Submitted</TH>
                    <TH className="text-right">Action</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map(s => {
                    const ss = s.screenshot;
                    return (
                      <TableRow key={s.entryId}>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>{s.upiId}</TableCell>

                        <TableCell>
                          {s.status===1
                            ? <Badge className="bg-green-600 text-white">Approved</Badge>
                            : s.status===0
                            ? <Badge variant="destructive" className="bg-red-600">Rejected</Badge>
                            : <Badge variant="outline" className="bg-yellow-400">Pending</Badge>}
                        </TableCell>

                        <TableCell className="text-center">{s.linkAmount != null ? `₹${s.linkAmount}` : '—'}</TableCell>
                        <TableCell className="text-center">{s.totalAmount != null ? `₹${s.totalAmount}` : '—'}</TableCell>

                        <TableCell className="text-center">
                          {ss?.verified
                            ? <Badge className="bg-green-600 text-white">Yes</Badge>
                            : <Badge variant="outline" className="bg-yellow-400">No</Badge>}
                        </TableCell>

                        <TableCell>
                          {ss?.analysis ? (
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                              <span>Liked: <b>{ss.analysis.liked ? 'Yes' : 'No'}</b></span>
                              <span>Comments: <b>{Array.isArray(ss.analysis.comment) ? ss.analysis.comment.length : 0}</b></span>
                              <span>Replies: <b>{Array.isArray(ss.analysis.replies) ? ss.analysis.replies.length : 0}</b></span>
                              <Button size="sm" variant="outline" onClick={()=>openAnalysis(ss)}>View Details</Button>
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </TableCell>

                        <TableCell className="text-right whitespace-nowrap">
                          {format(new Date(s.createdAt), 'PPpp')}
                        </TableCell>

                        <TableCell className="text-right align-top">
                          <div className="flex flex-col items-end space-y-2">
                            <div className="flex space-x-2">
                              <Button size="sm" variant="default" onClick={()=>handleApprove(s.entryId,1)}>Approve</Button>
                              <Button size="sm" variant="destructive" onClick={()=>handleApprove(s.entryId,0)}>Reject</Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Pager />

              {/* Footer totals (already provided by API as grandTotal) */}
              <div className="text-right text-lg font-semibold pt-2">
                Paid Total: ₹{totalAmount.toFixed(2)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
