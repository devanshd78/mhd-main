'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ClipboardCopy as ClipboardCopyIcon,
  Eye as EyeIcon,
  LogOut as LogOutIcon,
  Users as UsersIcon,
  MailCheck as MailCheckIcon,
} from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

/* ===================== Types ===================== */

interface LinkItem {
  _id: string;
  title: string;
  isLatest?: boolean; // present from backend but NOT used for active state
  target: number;
  amount: number;
  createdAt: string; // ISO
  expireIn: number; // hours
  expiresAt?: string; // ISO (optional)
  status?: 'active' | 'expired'; // optional backend hint
}

interface EmailTaskItem {
  _id: string;
  createdBy: string;
  platform: string; // Instagram | TikTok | YouTube
  targetUser?: string | number;
  targetPerEmployee: number;
  amountPerPerson: number;
  maxEmails: number;
  expireIn: number; // hours
  createdAt: string; // ISO
  isLatest?: boolean; // present from backend but NOT used for active state
  status?: 'active' | 'expired';
  expiresAt?: string; // ISO (prefer when provided)
}

function SkeletonCard() {
  return (
    <Card className="p-6 space-y-4">
      <div className="h-4 bg-gray-200/70 rounded w-2/3" />
      <div className="h-3 bg-gray-200/70 rounded w-1/2" />
      <div className="h-3 bg-gray-200/70 rounded w-1/3" />
      <div className="flex gap-2 pt-2">
        <div className="h-8 w-28 bg-gray-200/70 rounded" />
        <div className="h-8 w-28 bg-gray-200/70 rounded" />
      </div>
    </Card>
  );
}

// Interleaved item type for rendering
 type MergedItem =
  | {
      kind: 'link';
      _id: string;
      createdAt: string;
      expireIn: number;
      expiresAt?: string;
      status?: 'active' | 'expired';
      isLatest?: boolean;
      title: string;
      target: number;
      amount: number;
    }
  | {
      kind: 'task';
      _id: string;
      createdAt: string;
      expireIn: number;
      expiresAt?: string;
      status?: 'active' | 'expired';
      isLatest?: boolean;
      platform: string;
      targetUser?: string | number;
      targetPerEmployee: number;
      amountPerPerson: number;
      maxEmails: number;
    };

/* ===================== Component ===================== */

export default function Dashboard() {
  const router = useRouter();

  // Links state
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [errorLinks, setErrorLinks] = useState('');

  // Email tasks state
  const [emailTasks, setEmailTasks] = useState<EmailTaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [errorTasks, setErrorTasks] = useState('');

  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  // force re-render every second (countdown)
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // fetch balance
  useEffect(() => {
    const empId = localStorage.getItem('employeeId');
    if (!empId) return;
    api
      .get<{ balance: number }>(`/employee/balance?employeeId=${empId}`)
      .then((res) => setBalance(res.data.balance))
      .catch((err) => console.error('Failed to fetch balance', err));
  }, []);

  // fetch all links
  useEffect(() => {
    setLoadingLinks(true);
    api
      .get<LinkItem[]>('/employee/links', { withCredentials: true })
      .then((res) => setLinks(res.data))
      .catch((e) => setErrorLinks(e.response?.data?.error || 'Failed to load links.'))
      .finally(() => setLoadingLinks(false));
  }, []);

  // fetch email tasks (employee scope via GET)
  useEffect(() => {
    setLoadingTasks(true);
    api
      .get<EmailTaskItem[]>('/employee/emailtasks', { withCredentials: true })
      .then((res) => setEmailTasks(res.data || []))
      .catch((e) => setErrorTasks(e.response?.data?.error || 'Failed to load email tasks.'))
      .finally(() => setLoadingTasks(false));
  }, []);

  /* ===================== Utils ===================== */

  const copy = (txt: string) =>
    navigator.clipboard.writeText(txt).then(() =>
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Copied',
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true,
      })
    );

  const handleLogout = async () => {
    localStorage.clear();
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: 'Logged out',
      showConfirmButton: false,
      timer: 1200,
    });
    router.push('/employee/login');
  };

  const goToLink = (id: string) => {
    setNavigatingId(id);
    router.push(`/employee/links?id=${id}`);
  };

  const openEmailTask = (taskId: string) => {
    setNavigatingId(taskId);
    router.push(`/employee/email-collection?task=${taskId}`);
  };

  // Prefer expiresAt if present; otherwise compute via createdAt + expireIn hours
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

  const formatDateTime = (d: Date) =>
    d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  // Basic search on link fields
  const filteredLinks = useMemo(() => {
    if (!query.trim()) return links;
    const q = query.toLowerCase();
    return links.filter((l) =>
      [l.title, String(l.target), String(l.amount)].some((v) => String(v).toLowerCase().includes(q))
    );
  }, [links, query]);

  // Basic search on task fields
  const filteredTasks = useMemo(() => {
    if (!query.trim()) return emailTasks;
    const q = query.toLowerCase();
    return emailTasks.filter((t) =>
      [
        t.platform,
        String(t.targetUser ?? ''),
        String(t.targetPerEmployee),
        String(t.amountPerPerson),
        String(t.maxEmails),
      ].some((v) => String(v).toLowerCase().includes(q))
    );
  }, [emailTasks, query]);

  // Interleaved (newest first) combined feed
  const mergedItems = useMemo<MergedItem[]>(() => {
    const linkItems: MergedItem[] = filteredLinks.map((l) => ({
      kind: 'link',
      _id: l._id,
      createdAt: l.createdAt,
      expireIn: l.expireIn,
      expiresAt: l.expiresAt,
      status: l.status,
      isLatest: l.isLatest,
      title: l.title,
      target: l.target,
      amount: l.amount,
    }));

    const taskItems: MergedItem[] = filteredTasks.map((t) => ({
      kind: 'task',
      _id: t._id,
      createdAt: t.createdAt,
      expireIn: t.expireIn,
      expiresAt: t.expiresAt,
      status: t.status,
      isLatest: t.isLatest,
      platform: t.platform,
      targetUser: t.targetUser,
      targetPerEmployee: t.targetPerEmployee,
      amountPerPerson: t.amountPerPerson,
      maxEmails: t.maxEmails,
    }));

    return [...linkItems, ...taskItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [filteredLinks, filteredTasks]);

  /* ===================== Render ===================== */

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Employee Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage links, view entries, and complete email tasks.</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {balance !== null && (
            <span className="text-sm sm:text-base font-medium text-green-700 bg-green-100 px-3 py-1 rounded-lg border border-green-300">
              Balance Left: ₹{balance.toLocaleString()}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/employee/users')}
            className="flex items-center gap-1"
          >
            <UsersIcon className="h-4 w-4" />
            Users
          </Button>
          <Button size="sm" variant="outline" onClick={handleLogout} className="flex items-center gap-1">
            <LogOutIcon className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, platform, target, amount…"
          className="max-w-md"
        />
        <Badge variant="outline" className="bg-white">
          {mergedItems.length} result{mergedItems.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* All Items (Links + Email Tasks interleaved by recency) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">All Items</h2>
          <Badge variant="secondary">{mergedItems.length}</Badge>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {loadingLinks || loadingTasks ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)
          ) : errorLinks || errorTasks ? (
            <Card className="p-6 text-center text-red-600 col-span-full">{errorLinks || errorTasks}</Card>
          ) : mergedItems.length === 0 ? (
            <Card className="p-10 text-center col-span-full">
              <p className="text-sm text-muted-foreground">Nothing here yet. Try adjusting your search.</p>
            </Card>
          ) : (
            mergedItems.map((item) => {
              // Common: compute expiry-driven state
              const { time, expired, hoursLeft, expiryDate } = getTimeLeft(
                item.createdAt,
                item.expireIn,
                item.expiresAt
              );
              const state = expired ? 'closed' : hoursLeft <= 6 ? 'urgent' : 'active';

              if (item.kind === 'link') {
                return (
                  <Card
                    key={`link-${item._id}`}
                    className={`relative p-6 space-y-4 transition ${
                      state === 'active'
                        ? 'bg-white border border-green-200 hover:shadow-md'
                        : state === 'urgent'
                        ? 'bg-white border-amber-200 hover:shadow-md'
                        : 'bg-white border border-gray-200 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {!expired ? (
                          <Badge className={state === 'urgent' ? 'bg-amber-500' : 'bg-green-600'}>
                            {state === 'urgent' ? 'Expiring soon' : 'Active'}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Closed</Badge>
                        )}
                        <Badge variant="outline">Shareable Link</Badge>
                        <Badge variant="outline">Target: {item.target}</Badge>
                        <Badge variant="outline">₹{item.amount}/person</Badge>
                      </div>
                    </div>

                    <div>
                      <p className="text-lg font-semibold break-words">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">Expires: {formatDateTime(expiryDate)}</p>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium">⌛ Time left</span>
                      <span
                        className={`font-semibold ${
                          expired ? 'text-gray-500' : state === 'urgent' ? 'text-amber-700' : 'text-green-700'
                        }`}
                      >
                        {!expired ? time : 'Expired'}
                      </span>
                    </div>

                    <div className="border-t pt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => goToLink(item._id)}
                        disabled={navigatingId === item._id}
                        className="flex items-center gap-1"
                      >
                        {navigatingId === item._id ? (
                          <span className="animate-spin h-4 w-4 border-t-2 border-gray-600 rounded-full" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                        View Entries
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copy(item.title)}
                        className="flex items-center gap-1 bg-white hover:bg-gray-50"
                      >
                        <ClipboardCopyIcon className="h-4 w-4" />
                        Copy Title
                      </Button>
                    </div>
                  </Card>
                );
              }

              // kind === 'task'
              return (
                <Card
                  key={`task-${item._id}`}
                  className={`relative p-6 space-y-4 transition ${
                    state === 'active'
                      ? 'bg-white border border-blue-200 hover:shadow-md'
                      : state === 'urgent'
                      ? 'bg-white border-amber-200 hover:shadow-md'
                      : 'bg-white border border-gray-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {!expired ? (
                        <Badge className={state === 'urgent' ? 'bg-amber-500' : 'bg-blue-600'}>
                          {state === 'urgent' ? 'Expiring soon' : 'Active'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Closed</Badge>
                      )}
                      <Badge variant="outline">Email Task</Badge>
                      <Badge variant="outline">Platform: {item.platform}</Badge>
                      <Badge variant="outline">₹{item.amountPerPerson}/person</Badge>
                      <Badge variant="outline">Max Emails: {item.maxEmails}</Badge>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-lg font-semibold break-words">{item.targetUser || ''}</p>
                    <p className="text-xs text-muted-foreground">Target per employee: {item.targetPerEmployee}</p>
                    <p className="text-xs text-muted-foreground">Expires: {formatDateTime(expiryDate)}</p>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">⌛ Time left</span>
                    <span
                      className={`font-semibold ${
                        expired ? 'text-gray-500' : state === 'urgent' ? 'text-amber-700' : 'text-blue-700'
                      }`}
                    >
                      {!expired ? time : 'Expired'}
                    </span>
                  </div>

                  <div className="border-t pt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => openEmailTask(item._id)}
                      className="flex items-center gap-1"
                    >
                      {navigatingId === item._id ? (
                        <span className="animate-spin h-4 w-4 border-t-2 border-gray-600 rounded-full" />
                      ) : (
                        <MailCheckIcon className="h-4 w-4" />
                      )}
                      View Entries
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
