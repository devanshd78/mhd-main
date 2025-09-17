'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { post } from '@/lib/axios';

// ===================================================
// Consumes getEmployeeOverviewAdmin API
// POST body: { page, limit, detailsLimit, search? }
// Response: {
//   page, limit, totalEmployees, hasNext, detailsLimit, search,
//   data: Array<{
//     employeeName, employeeId, employeeEmail,
//     teamCounts: { members: number; contactsTotal: number },
//     collectors: Array<{
//       username: string; userId: string; totalCollected: number;
//       dataCollected: Array<{ email: string; handle: string; platform: string; createdAt?: string }>
//     }>
//   }>
// }
// ===================================================

export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'facebook' | 'other' | string;

interface ContactRow {
  email: string;
  handle: string;
  platform: Platform;
  createdAt?: string;
}

interface CollectorBlock {
  username: string;
  userId: string;
  totalCollected: number;
  dataCollected: ContactRow[]; // already sliced to detailsLimit by backend
}

interface EmployeeBlock {
  employeeName: string;
  employeeId: string;
  employeeEmail: string;
  teamCounts: { members: number; contactsTotal: number };
  collectors: CollectorBlock[]; // only those with non-empty data
}

interface OverviewResponse {
  page: number;
  limit: number;
  totalEmployees: number;
  hasNext: boolean;
  detailsLimit: number;
  search?: string;
  data: EmployeeBlock[];
}

const API_PATH = '/email/admin/all'; // ⟵ align with your route name

const toast = (icon: 'success' | 'error' | 'info' | 'warning', title: string, text?: string) =>
  Swal.fire({ toast: true, position: 'top-end', icon, title, text, timer: 2200, showConfirmButton: false, timerProgressBar: true });

const fmt = (s?: string) => (s ? new Date(s).toLocaleString() : '-');
const formatRange = (page: number, limit: number, total: number) => {
  const start = (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);
  if (total === 0) return '0 of 0';
  return `${start}–${end} of ${total}`;
};

export default function AdminEmployeeOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Query state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState('');
  const [detailsLimit, setDetailsLimit] = useState(1000);

  // Data state
  const [rows, setRows] = useState<EmployeeBlock[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);

  // Drawer
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<EmployeeBlock | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((totalEmployees || 1) / limit)), [totalEmployees, limit]);

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  async function fetchData() {
    try {
      setLoading(true);
      setError('');
      const resp = await post<OverviewResponse>(API_PATH, {
        page,
        limit,
        detailsLimit,
        search: search.trim() || undefined,
      });
      const payload = resp.data;
      setRows(payload.data);
      setTotalEmployees(payload.totalEmployees);
      // keep detailsLimit in sync with server echo (if needed)
      if (typeof payload.detailsLimit === 'number') setDetailsLimit(payload.detailsLimit);
    } catch (e: any) {
      const msg = e?.message || 'Failed to fetch overview.';
      setError(msg);
      toast('error', 'API error', msg);
    } finally {
      setLoading(false);
    }
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    void fetchData();
  }

  // Aggregates for visible page
  const visibleStats = useMemo(() => {
    const employeesVisible = rows.length;
    const membersVisible = rows.reduce((a, e) => a + (e.teamCounts?.members || 0), 0);
    const contactsVisible = rows.reduce((a, e) => a + (e.teamCounts?.contactsTotal || 0), 0);
    const previewRows = rows.reduce((a, e) => a + e.collectors.reduce((aa, c) => aa + c.dataCollected.length, 0), 0);
    return { employeesVisible, membersVisible, contactsVisible, previewRows };
  }, [rows]);

  // Utilities: copy & export
  function copyEmails(list: string[]) {
    const text = list.join(', ');
    navigator.clipboard
      .writeText(text)
      .then(() => toast('success', 'Copied emails'))
      .catch(() => toast('error', 'Copy failed'));
  }

  function exportContactsCSV(filename: string, contacts: ContactRow[]) {
    const header = ['email', 'handle', 'platform', 'createdAt'];
    const rows = [header, ...contacts.map((c) => [c.email, c.handle, c.platform, c.createdAt ? new Date(c.createdAt).toISOString() : ''])];
    const csv = rows.map((r) => r.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Collect contacts for export/copy
  const allPageContacts = useMemo(() =>
    rows.flatMap((e) => e.collectors.flatMap((c) => c.dataCollected)),
  [rows]);

  function openEmployee(e: EmployeeBlock) {
    setActive(e);
    setOpen(true);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border bg-white"><CardContent className="p-5"><div className="text-sm text-muted-foreground">Total Employees</div><div className="text-2xl font-semibold mt-1">{totalEmployees}</div></CardContent></Card>
        <Card className="border bg-white"><CardContent className="p-5"><div className="text-sm text-muted-foreground">Visible Employees</div><div className="text-2xl font-semibold mt-1">{visibleStats.employeesVisible}</div></CardContent></Card>
        <Card className="border bg-white"><CardContent className="p-5"><div className="text-sm text-muted-foreground">Team Members (visible)</div><div className="text-2xl font-semibold mt-1">{visibleStats.membersVisible}</div></CardContent></Card>
        <Card className="border bg-white"><CardContent className="p-5"><div className="text-sm text-muted-foreground">Contacts Total (visible)</div><div className="text-2xl font-semibold mt-1">{visibleStats.contactsVisible}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <Card className="border bg-white">
        <CardHeader className="p-4"><CardTitle className="text-base">Search & Filters</CardTitle></CardHeader>
        <CardContent className="p-4">
          <form className="grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={onSearchSubmit}>
            <div className="space-y-1.5 md:col-span-2">
              <div className="text-xs text-muted-foreground">Search by employee name</div>
              <Input placeholder="e.g. Devansh" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Page size</div>
              <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Limit" /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100, 200].map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Details limit (per collector)</div>
              <Input type="number" min={1} max={5000} value={detailsLimit} onChange={(e) => setDetailsLimit(Math.max(1, Math.min(5000, Number(e.target.value) || 0)))} />
            </div>
            <div className="md:col-span-4 flex gap-2">
              <Button type="submit">Apply</Button>
              <Button type="button" variant="outline" onClick={() => { setSearch(''); setPage(1); void fetchData(); }}>Reset</Button>
              <Button type="button" variant="outline" onClick={() => copyEmails(allPageContacts.map((c) => c.email))}>Copy emails (page)</Button>
              <Button type="button" onClick={() => exportContactsCSV(`overview-page${page}.csv`, allPageContacts)}>Export CSV (page)</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Employees table */}
      <Card className="border bg-white">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Employees with Collected Contacts</CardTitle>
            <div className="text-sm text-muted-foreground">{formatRange(page, limit, totalEmployees)}</div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Contacts Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground"><div className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div></TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No results</TableCell>
                  </TableRow>
                ) : (
                  rows.map((e) => (
                    <TableRow key={e.employeeId} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{e.employeeName}</span>
                          <span className="text-[11px] text-muted-foreground">{e.employeeEmail}</span>
                          <span className="text-[11px] text-muted-foreground">ID: {e.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{e.teamCounts.members}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{e.teamCounts.contactsTotal}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEmployee(e)}>View collectors</Button>
                          <Button size="sm" variant="outline" onClick={() => exportContactsCSV(`employee-${e.employeeId}.csv`, e.collectors.flatMap((c) => c.dataCollected))}>Export CSV</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Page {page} of {totalPages}</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page <= 1}>Previous</Button>
          <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={loading || page >= totalPages}>Next</Button>
        </div>
      </div>

      {/* Collectors drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto p-4">
          <SheetHeader>
            <SheetTitle>Collectors & Contacts</SheetTitle>
            <SheetDescription>Only collectors with non-empty data are shown.</SheetDescription>
          </SheetHeader>

          {!active ? (
            <div className="py-10 text-center text-muted-foreground">No selection.</div>
          ) : (
            <div className="py-4 space-y-6">
              <div>
                <div className="text-sm text-muted-foreground">Employee</div>
                <div className="font-medium">{active.employeeName}</div>
                <div className="text-xs text-muted-foreground">{active.employeeEmail}</div>
              </div>

              {active.collectors.map((c) => (
                <Card key={c.userId} className="border bg-white">
                  <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{c.username || c.userId}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Total {c.totalCollected}</Badge>
                        <Button size="sm" variant="outline" onClick={() => copyEmails(c.dataCollected.map((x) => x.email))}>Copy emails</Button>
                        <Button size="sm" variant="outline" onClick={() => exportContactsCSV(`collector-${c.userId}.csv`, c.dataCollected)}>Export</Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Handle</TableHead>
                            <TableHead>Platform</TableHead>
                            <TableHead>Saved</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {c.dataCollected.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No contacts</TableCell>
                            </TableRow>
                          ) : (
                            c.dataCollected.map((row, idx) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  <button className="underline underline-offset-2 hover:no-underline" onClick={() => copyEmails([row.email])} title="Click to copy">{row.email}</button>
                                </TableCell>
                                <TableCell>{row.handle}</TableCell>
                                <TableCell><Badge variant="outline" className="capitalize">{row.platform}</Badge></TableCell>
                                <TableCell>{fmt(row.createdAt)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div className="text-xs text-muted-foreground">Preview rows (sum across collectors): {visibleStats.previewRows}</div>
            </div>
          )}

          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
