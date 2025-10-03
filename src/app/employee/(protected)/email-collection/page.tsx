'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Filter, RefreshCcw, ArrowUpRight, Loader2, IndianRupee } from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { post } from '@/lib/axios';

export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'facebook' | 'other' | string;

export interface RosterEmail {
  emailMasked: string;
  handle: string;
  platform: Platform;
  createdAt?: string;
}

export interface RosterUser {
  userId: string;
  name: string | null;
  doneCount: number;
  status: 'completed' | 'partial';
  emails: RosterEmail[];
  paid?: boolean;
}

export interface TaskSummary {
  _id: string;
  platform: string;
  targetPerEmployee: number;
  amountPerPerson: number;
  maxEmails: number;
  expireIn: number;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'expired';
}

export interface RosterResponse {
  task: TaskSummary;
  totals: {
    performing: number;
    completed: number;
    partial: number;
  };
  users: RosterUser[];
}

// ===== utils =====
const toast = (
  icon: 'success' | 'error' | 'info' | 'warning',
  title: string,
  text?: string
) =>
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title,
    text,
    timer: 2200,
    showConfirmButton: false,
    timerProgressBar: true,
  });

const formatDateTime = (s?: string) =>
  s
    ? new Date(s).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

function readLocal(keys: string[]): string {
  if (typeof window === 'undefined') return '';
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return '';
}

const getTimeLeft = (createdAt: string, expireIn: number, expiresAt?: string) => {
  const expiryDate = expiresAt
    ? new Date(expiresAt)
    : new Date(new Date(createdAt).getTime() + expireIn * 60 * 60 * 1000);

  const now = new Date();
  const diff = expiryDate.getTime() - now.getTime();

  if (diff <= 0) return { expired: true, time: 'Expired', hoursLeft: 0, expiryDate } as const;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return {
    expired: false,
    time: `${hours}h ${minutes}m ${seconds}s`,
    hoursLeft: hours + minutes / 60,
    expiryDate,
  } as const;
};

// ===== constants =====
const PAY_API = '/employee/pay';

// ===== page =====
export default function EmployeeEmailCollectionsPage() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get('task') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [roster, setRoster] = useState<RosterResponse | null>(null);

  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState<'all' | Platform>('all');

  const [open, setOpen] = useState(false);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  // New: track which user is currently being paid
  const [payingUserId, setPayingUserId] = useState<string | null>(null);

  // tick for countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // initial + on taskId change
  useEffect(() => {
    (async () => {
      try {
        setError('');
        if (!taskId) {
          setError('Missing task id in URL.');
          setLoading(false);
          return;
        }
        await loadRoster(taskId);
      } catch {
        // handled in loadRoster
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function loadRoster(tid: string) {
    try {
      setLoading(true);
      setError('');

      const employeeId = readLocal(['employeeId', 'EmployeeId', 'empId', 'EMPLOYEE_ID']);
      if (!employeeId) throw new Error('Missing employeeId in localStorage.');

      // matches your backend shape & sample response
      const resp = await post<RosterResponse>('/employee/taskbyuser', {
        taskId: tid,
        employeeId,
      });

      setRoster(resp.data);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to fetch roster.';
      setError(msg);
      toast('error', 'API error', msg);
    } finally {
      setLoading(false);
    }
  }

  const currentTask = roster?.task ?? null;

  const availablePlatforms = useMemo(() => {
    const set = new Set<string>();
    (roster?.users || []).forEach((u) =>
      u.emails?.forEach((e) => e.platform && set.add(e.platform))
    );
    return Array.from(set).sort();
  }, [roster]);

  interface RosterUserWithMeta extends RosterUser {
    firstSavedAt: string | null;
    lastSavedAt: string | null;
    total: number;
  }

  const filteredUsers: RosterUserWithMeta[] = useMemo(() => {
    if (!roster) return [];

    const withMeta: RosterUserWithMeta[] = roster.users.map((u) => {
      const times = (u.emails || [])
        .map((e) => (e.createdAt ? +new Date(e.createdAt) : 0))
        .filter(Boolean);
      const firstSavedAt = times.length ? new Date(Math.min(...times)).toISOString() : null;
      const lastSavedAt = times.length ? new Date(Math.max(...times)).toISOString() : null;
      const total = u.emails?.length || 0;
      return { ...u, firstSavedAt, lastSavedAt, total };
    });

    return withMeta
      .filter((r) => {
        if (platform !== 'all') {
          const hasPlatform = r.emails?.some((d) => d.platform === platform);
          if (!hasPlatform) return false;
        }
        if (q.trim()) {
          const needle = q.toLowerCase();
          const hay = [r.name || '', r.userId, ...(r.emails || []).flatMap((d) => [d.emailMasked, d.handle])]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = a.lastSavedAt ? +new Date(a.lastSavedAt) : 0;
        const db = b.lastSavedAt ? +new Date(b.lastSavedAt) : 0;
        return db - da;
      });
  }, [roster, q, platform]);

  const stats = useMemo(() => {
    if (!roster) return { performing: 0, completed: 0, partial: 0, totalContacts: 0 };
    const totalContacts = roster.users.reduce((acc, u) => acc + (u.emails?.length || 0), 0);
    return { ...roster.totals, totalContacts };
  }, [roster]);

  const refresh = async () => {
    if (taskId) await loadRoster(taskId);
  };

  const countdown = useMemo(() => {
    if (!currentTask)
      return { label: '-', state: 'closed' as 'active' | 'urgent' | 'closed' };
    const { time, expired, hoursLeft } = getTimeLeft(
      currentTask.createdAt,
      currentTask.expireIn,
      currentTask.expiresAt
    );
    const st = expired ? 'closed' : hoursLeft <= 6 ? 'urgent' : 'active';
    return { label: expired ? 'Expired' : time, state: st };
  }, [currentTask]);

  const activeUser = useMemo(() => {
    if (!activeUserId || !roster) return null;
    const base = roster.users.find((u) => u.userId === activeUserId) || null;
    if (!base) return null;
    const times = (base.emails || [])
      .map((e) => (e.createdAt ? +new Date(e.createdAt) : 0))
      .filter(Boolean);
    const lastSavedAt = times.length ? new Date(Math.max(...times)).toISOString() : null;
    const total = base.emails?.length || 0;
    return { ...base, lastSavedAt, total } as RosterUserWithMeta;
  }, [activeUserId, roster]);

  // ===== PAY HANDLER =====
  async function handlePay(user: RosterUserWithMeta) {
    try {
      if (!currentTask) throw new Error('No task loaded.');
      if (!taskId) throw new Error('Missing task id in URL.');

      const employeeId = readLocal(['employeeId', 'EmployeeId', 'empId', 'EMPLOYEE_ID']);
      if (!employeeId) throw new Error('Missing employeeId in localStorage.');

      const { isConfirmed } = await Swal.fire({
        title: 'Confirm Payout?',
        text: `Pay ₹${currentTask.amountPerPerson} for ${user.name || user.userId}?`,
        icon: 'question',
        confirmButtonText: `Pay ₹${currentTask.amountPerPerson}`,
        showCancelButton: true,
        reverseButtons: true,
      });

      if (!isConfirmed) return;

      setPayingUserId(user.userId);

      await post(PAY_API, {
        taskId,
        userId: user.userId,
        employeeId,
      });

      toast('success', 'Payout marked', `${user.name || user.userId} has been marked as paid.`);

      // Optimistic update: set this user as paid locally.
      setRoster((prev) =>
        prev
          ? {
              ...prev,
              users: prev.users.map((u) =>
                u.userId === user.userId ? { ...u, paid: true } : u
              ),
            }
          : prev
      );

      // Optionally refresh to re-pull server truth
      // await refresh();
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Payment failed.';
      toast('error', 'Payment error', msg);
    } finally {
      setPayingUserId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Filters (no task picker) */}
      <Card className="border bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">Search</div>
                <div className="relative">
                  <Input
                    placeholder="Search by user, email(masked), or handle…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="pl-8"
                  />
                  <Filter className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">Platform</div>
                <Select value={platform} onValueChange={(v: any) => setPlatform(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All platforms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {availablePlatforms.map((p) => (
                      <SelectItem key={p} value={p}>
                        {String(p).charAt(0).toUpperCase() + String(p).slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={refresh} disabled={!taskId || loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4 mr-1" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task meta + countdown */}
      {currentTask && (
        <Card className="border bg-white">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <Badge variant="outline">Task: {currentTask.platform}</Badge>
            <Badge variant="outline">Target/employee: {currentTask.targetPerEmployee}</Badge>
            <Badge variant="outline">₹{currentTask.amountPerPerson}/person</Badge>
            <Badge variant="outline">Max Emails: {currentTask.maxEmails}</Badge>
            <span
              className={`ml-auto text-sm font-medium ${
                countdown.state === 'closed'
                  ? 'text-gray-500'
                  : countdown.state === 'urgent'
                  ? 'text-amber-700'
                  : 'text-blue-700'
              }`}
            >
              ⏳ {countdown.label}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border bg-white">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Performing Users</div>
            <div className="text-2xl font-semibold mt-1">{stats.performing}</div>
          </CardContent>
        </Card>
        <Card className="border bg-white">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Completed</div>
            <div className="text-2xl font-semibold mt-1 text-green-700">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card className="border bg-white">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Partial</div>
            <div className="text-2xl font-semibold mt-1 text-amber-700">{stats.partial}</div>
          </CardContent>
        </Card>
        <Card className="border bg-white">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Total Contacts (masked)</div>
            <div className="text-2xl font-semibold mt-1">{stats.totalContacts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border bg-white">
        <CardHeader className="p-4">
          <CardTitle className="text-base">Users Performing This Task</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>{/* New */}
                  <TableHead>Last Saved</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !filteredUsers || filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No users for this task.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((r) => (
                    <TableRow key={r.userId} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {r.doneCount}/{currentTask?.maxEmails ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.status === 'completed' ? (
                          <Badge className="bg-green-600">Completed</Badge>
                        ) : (
                          <Badge className="bg-amber-500">Partial</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.paid ? (
                          <Badge className="bg-green-600">Paid</Badge>
                        ) : (
                          <Badge variant="outline">Unpaid</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(r.lastSavedAt || undefined)}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setActiveUserId(r.userId);
                              setOpen(true);
                            }}
                          >
                            <ArrowUpRight className="h-4 w-4 mr-1" /> View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handlePay(r)}
                            disabled={!!r.paid || payingUserId === r.userId || !currentTask}
                          >
                            {payingUserId === r.userId ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <IndianRupee className="h-4 w-4 mr-1" />
                            )}
                            Pay
                          </Button>
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

      {/* Details side panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-4">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">Saved Contacts (masked)</SheetTitle>
          </SheetHeader>

          {!activeUser ? (
            <div className="py-10 text-center text-muted-foreground">No selection.</div>
          ) : (
            <div className="py-4 space-y-6">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground">User</div>
                  <div className="font-medium">{activeUser.name || activeUser.userId}</div>
                </div>
                <div className="flex items-center gap-2">
                  {activeUser.paid ? (
                    <Badge className="bg-green-600">Paid</Badge>
                  ) : (
                    <Badge variant="outline">Unpaid</Badge>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handlePay(activeUser)}
                    disabled={!!activeUser.paid || payingUserId === activeUser.userId || !currentTask}
                  >
                    {payingUserId === activeUser.userId ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <IndianRupee className="h-4 w-4 mr-1" />
                    )}
                    Pay
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {activeUser.total} contact{activeUser.total !== 1 ? 's' : ''}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  Last Saved: {formatDateTime(activeUser.lastSavedAt || undefined)}
                </span>
              </div>

              <Card className="border bg-white">
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">Contacts</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {activeUser.emails.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No contacts for this user.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email (masked)</TableHead>
                            <TableHead>Handle</TableHead>
                            <TableHead>Platform</TableHead>
                            <TableHead>Saved</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeUser.emails.map((c, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{c.emailMasked}</TableCell>
                              <TableCell>{c.handle}</TableCell>
                              <TableCell className="capitalize">{c.platform}</TableCell>
                              <TableCell>{formatDateTime(c.createdAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
