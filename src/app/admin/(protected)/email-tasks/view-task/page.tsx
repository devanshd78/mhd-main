'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead as TH,
  TableCell,
} from '@/components/ui/table';
import { Loader2, RefreshCcw, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/axios';

/* =================== Types (match backend response) =================== */
type Platform = string;

interface YouTubeData {
  channelId?: string;
  title?: string;
  handle?: string;
  urlByHandle?: string;
  urlById?: string;
  description?: string;
  country?: string;
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number;
  topicCategories?: string[];
  topicCategoryLabels?: string[];
  fetchedAt?: string;
}

interface EmailEntry {
  email: string;
  handle: string;
  platform: Platform;
  createdAt?: string;
  youtube?: YouTubeData; // optional YouTube enrichment
}

interface RosterUser {
  userId: string;
  name: string | null;
  doneCount: number;
  status: 'completed' | 'partial';
  paid?: boolean; // <--- NEW: paid/unpaid per user
  emails: EmailEntry[];
}

interface EmployeeGroup {
  employeeId: string;
  name: string | null;
  usersCount: number;
  completedUsers: number;
  partialUsers: number;
  paidUsers: number; // <--- NEW: count paid users per employee
  totalEmails: number;
  users: RosterUser[];
}

interface TaskSummary {
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

interface TaskRosterResponse {
  task: TaskSummary;
  totals: {
    employees: number;
    users: number;
    completedUsers: number;
    partialUsers: number;
    paidUsers: number; // <--- NEW: top-level count of paid users
    totalEmails: number;
  };
  employees: EmployeeGroup[];
}

/* =================== Helpers =================== */
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

const formatCompact = (n?: number) =>
  typeof n === 'number'
    ? new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
    : '-';

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

function exportCSV(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* =================== Page =================== */
export default function AdminTaskRosterPage() {
  const sp = useSearchParams();
  // Accept both ?taskId=... and legacy ?id=...
  const taskId = sp.get('taskId') || sp.get('id') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<TaskRosterResponse | null>(null);

  // filters
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState<string>('all');
  const [status, setStatus] = useState<'all' | 'completed' | 'partial'>('all');

  // expand/collapse employees
  const [openEmployees, setOpenEmployees] = useState<Record<string, boolean>>({});

  // countdown tick
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!taskId) {
      setError('Missing taskId in URL.');
      setLoading(false);
      return;
    }
    void fetchRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function fetchRoster() {
    try {
      setLoading(true);
      setError('');
      const res = await api.post<TaskRosterResponse>('/admin/emailtasks/bytaskId', { taskId });
      setData(res.data);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to load roster.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const platforms = useMemo(() => {
    const set = new Set<string>();
    data?.employees.forEach((eg) =>
      eg.users.forEach((u) =>
        u.emails.forEach((em) => {
          if (em.platform) set.add(em.platform);
        })
      )
    );
    return Array.from(set).sort();
  }, [data]);

  const countdown = useMemo(() => {
    if (!data?.task) return { label: '-', state: 'closed' as 'active' | 'urgent' | 'closed' };
    const t = data.task;
    const { time, expired, hoursLeft } = getTimeLeft(t.createdAt, t.expireIn, t.expiresAt);
    const st = expired ? 'closed' : hoursLeft <= 6 ? 'urgent' : 'active';
    return { label: expired ? 'Expired' : time, state: st };
  }, [data]);

  // derived + filtered view
  const filteredEmployees = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();

    // Filter users (and their emails) per employee according to q/platform/status
    const groups = data.employees
      .map((eg) => {
        const users = eg.users
          .map((u) => {
            // platform filter at email level
            const emailsPlat = platform === 'all' ? u.emails : u.emails.filter((e) => e.platform === platform);
            // text filter
            const hay = [u.name || '', u.userId, ...emailsPlat.flatMap((e) => [e.email, e.handle])]
              .join(' ')
              .toLowerCase();
            const passText = needle ? hay.includes(needle) : true;
            const passStatus = status === 'all' ? true : u.status === status;
            if (!passText || !passStatus) return null;
            // keep only filtered emails
            return { ...u, emails: emailsPlat } as RosterUser;
          })
          .filter(Boolean) as RosterUser[];

        // recompute quick counters for the filtered set
        const completedUsers = users.reduce((acc, u) => acc + (u.status === 'completed' ? 1 : 0), 0);
        const partialUsers = users.reduce((acc, u) => acc + (u.status === 'partial' ? 1 : 0), 0);
        const paidUsers = users.reduce((acc, u) => acc + (u.paid ? 1 : 0), 0); // <--- NEW
        const totalEmails = users.reduce((acc, u) => acc + (u.emails?.length || 0), 0);
        const usersCount = users.length;

        return { ...eg, users, usersCount, completedUsers, partialUsers, paidUsers, totalEmails } as EmployeeGroup;
      })
      .filter((eg) => eg.usersCount > 0);

    return groups;
  }, [data, q, platform, status]);

  const filteredTotals = useMemo(() => {
    const t = { employees: 0, users: 0, completedUsers: 0, partialUsers: 0, paidUsers: 0, totalEmails: 0 };
    filteredEmployees.forEach((eg) => {
      t.employees += 1;
      t.users += eg.usersCount;
      t.completedUsers += eg.completedUsers;
      t.partialUsers += eg.partialUsers;
      t.paidUsers += eg.paidUsers; // <--- NEW
      t.totalEmails += eg.totalEmails;
    });
    return t;
  }, [filteredEmployees]);

  const exportAllCSV = () => {
    if (!data) return;
    const rows: string[][] = [
      [
        'employeeId',
        'employeeName',
        'userId',
        'userName',
        'status',
        'paid', // <--- NEW
        'email',
        'handle',
        'platform',
        'createdAt',
        'yt.channelId',
        'yt.title',
        'yt.handle',
        'yt.urlByHandle',
        'yt.urlById',
        'yt.subscriberCount',
        'yt.videoCount',
        'yt.viewCount',
        'yt.country',
      ],
    ];
    filteredEmployees.forEach((eg) => {
      eg.users.forEach((u) => {
        if (!u.emails.length) {
          rows.push([eg.employeeId, eg.name || '', u.userId, u.name || '', u.status, String(!!u.paid), '', '', '', '', '', '', '', '', '', '', '', '', '']);
        } else {
          u.emails.forEach((em) => {
            const yt = em.youtube || {};
            rows.push([
              eg.employeeId,
              eg.name || '',
              u.userId,
              u.name || '',
              u.status,
              String(!!u.paid), // <--- NEW
              em.email || '',
              em.handle || '',
              em.platform || '',
              em.createdAt ? new Date(em.createdAt).toISOString() : '',
              yt.channelId || '',
              yt.title || '',
              yt.handle || '',
              yt.urlByHandle || '',
              yt.urlById || '',
              String(yt.subscriberCount ?? ''),
              String(yt.videoCount ?? ''),
              String(yt.viewCount ?? ''),
              yt.country || '',
            ]);
          });
        }
      });
    });
    exportCSV(`task-${data.task._id}-roster.csv`, rows);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-8 space-y-6">
      {/* Page header / Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold">Task Roster</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportAllCSV} disabled={!data || filteredEmployees.length === 0}>
              Export CSV
            </Button>
            <Button variant="outline" onClick={fetchRoster} disabled={loading || !taskId}>
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1" />}
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border bg-white">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">Search</div>
                  <div className="relative">
                    <Input
                      placeholder="Search by user, email, or handle…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      className="pl-8"
                    />
                    <Filter className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">Platform</div>
                  <select
                    className="rounded border px-3 py-2 w-full"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                  >
                    <option value="all">All</option>
                    {platforms.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">User Status</div>
                  <select
                    className="rounded border px-3 py-2 w-full"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as typeof status)}
                  >
                    <option value="all">All</option>
                    <option value="completed">Completed</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task summary */}
      <Card>
        <CardContent className="p-4">
          {!taskId ? (
            <div className="text-red-600">Missing taskId in URL (?taskId=...)</div>
          ) : loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading task…
            </div>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : !data ? (
            <div className="text-muted-foreground">No data.</div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm px-2 py-1 rounded border bg-white">Platform: {data.task.platform}</span>
              <span className="text-sm px-2 py-1 rounded border bg-white">
                Target/employee: {data.task.targetPerEmployee}
              </span>
              <span className="text-sm px-2 py-1 rounded border bg-white">
                ₹{data.task.amountPerPerson}/person
              </span>
              <span className="text-sm px-2 py-1 rounded border bg-white">Max Emails: {data.task.maxEmails}</span>
              <span className="text-sm px-2 py-1 rounded border bg-white">
                Expires: {formatDateTime(data.task.expiresAt)}
              </span>
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Employees</div>
              <div className="text-2xl font-semibold mt-1">{filteredTotals.employees}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Users</div>
              <div className="text-2xl font-semibold mt-1">{filteredTotals.users}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Completed Users</div>
              <div className="text-2xl font-semibold mt-1 text-green-700">{filteredTotals.completedUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Partial Users</div>
              <div className="text-2xl font-semibold mt-1 text-amber-700">{filteredTotals.partialUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Paid Users</div>
              <div className="text-2xl font-semibold mt-1 text-green-700">{filteredTotals.paidUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total Emails</div>
              <div className="text-2xl font-semibold mt-1">{filteredTotals.totalEmails}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grouped by employee */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !data ? null : filteredEmployees.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">No matching records.</CardContent>
        </Card>
      ) : (
        filteredEmployees.map((eg) => {
          const open = !!openEmployees[eg.employeeId];
          return (
            <Card key={eg.employeeId} className="border bg-white">
              <CardContent className="p-0">
                {/* Employee header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 border-b cursor-pointer hover:bg-gray-50"
                  onClick={() => setOpenEmployees((p) => ({ ...p, [eg.employeeId]: !open }))}
                >
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <div className="font-semibold">{eg.name || eg.employeeId}</div>
                  <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded border bg-white">Users: {eg.usersCount}</span>
                    <span className="px-2 py-0.5 rounded border bg-white text-green-700">Completed: {eg.completedUsers}</span>
                    <span className="px-2 py-0.5 rounded border bg-white text-amber-700">Partial: {eg.partialUsers}</span>
                    <span className="px-2 py-0.5 rounded border bg-white text-green-700">Paid: {eg.paidUsers}</span>{/* NEW */}
                    <span className="px-2 py-0.5 rounded border bg-white">Emails: {eg.totalEmails}</span>
                  </div>
                </div>

                {/* Users table */}
                {open && (
                  <div className="p-4">
                    <div className="overflow-x-auto">
                      <Table className="w-full table-auto">
                        <TableHeader className="bg-gray-50">
                          <TableRow>
                            <TH>User</TH>
                            <TH>Progress</TH>
                            <TH>Status</TH>
                            <TH>Payment</TH>{/* NEW */}
                            <TH>Last Saved</TH>
                            <TH>Emails</TH>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {eg.users.map((u) => {
                            const lastSavedAt = u.emails.length
                              ? formatDateTime(
                                  u.emails
                                    .map((e) => (e.createdAt ? +new Date(e.createdAt) : 0))
                                    .filter(Boolean)
                                    .sort((a, b) => b - a)[0] as any
                                )
                              : '-';

                            return (
                              <TableRow key={u.userId} className="align-top">
                                <TableCell className="min-w-[180px]">
                                  <div className="flex flex-col">
                                    <span className="font-medium">{u.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {u.doneCount}/{data!.task.maxEmails}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                      u.status === 'completed'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {u.status}
                                  </span>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {u.paid ? (
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                                      Paid
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border">Unpaid</span>
                                  )}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">{lastSavedAt}</TableCell>
                                <TableCell className="p-0">
                                  {u.emails.length === 0 ? (
                                    <div className="text-xs text-muted-foreground p-3">No emails</div>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <Table className="w-full">
                                        <TableHeader>
                                          <TableRow>
                                            <TH>Email</TH>
                                            <TH>Handle</TH>
                                            <TH>Platform</TH>
                                            <TH>Channel</TH>
                                            <TH>Saved</TH>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {u.emails.map((em, idx) => {
                                            const yt = em.youtube;
                                            const channelUrl = yt?.urlByHandle || yt?.urlById;
                                            const channelLabel = yt?.title || yt?.handle || yt?.channelId || '';
                                            return (
                                              <TableRow key={`${u.userId}-${idx}`}>
                                                <TableCell className="font-medium break-all">{em.email}</TableCell>
                                                <TableCell className="break-all">{em.handle}</TableCell>
                                                <TableCell className="capitalize">{em.platform}</TableCell>
                                                <TableCell className="min-w-[220px]">
                                                  {yt ? (
                                                    <div className="flex flex-col text-xs">
                                                      <div className="font-medium">
                                                        {channelUrl ? (
                                                          <a href={channelUrl} target="_blank" rel="noreferrer" className="underline">
                                                            {channelLabel}
                                                          </a>
                                                        ) : (
                                                          channelLabel
                                                        )}
                                                      </div>
                                                      <div className="text-muted-foreground">
                                                        Subs: {formatCompact(yt.subscriberCount)} · Views: {formatCompact(yt.viewCount)} · Videos: {formatCompact(yt.videoCount)}
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                  )}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">{formatDateTime(em.createdAt)}</TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
