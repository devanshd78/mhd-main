'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ClipboardCopyIcon,
  EyeIcon,
  LogOutIcon,
  UsersIcon,
  Info as InfoIcon,
  MailCheckIcon,
} from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

interface LinkItem {
  _id: string;
  title: string;
  isLatest: boolean;
  target: number;
  amount: number;
  createdAt: string;
  expireIn: number; // hours
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

export default function Dashboard() {
  const router = useRouter();

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  // force re-render every second (countdown)
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // fetch balance
  useEffect(() => {
    const empId = localStorage.getItem('employeeId');
    if (!empId) return;
    api
      .get<{ balance: number }>(`/employee/balance?employeeId=${empId}`)
      .then(res => setBalance(res.data.balance))
      .catch(err => console.error('Failed to fetch balance', err));
  }, []);

  // fetch all links
  useEffect(() => {
    api
      .get<LinkItem[]>('/employee/links', { withCredentials: true })
      .then(res => setLinks(res.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load links.'))
      .finally(() => setLoading(false));
  }, []);

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

  const getTimeLeft = (createdAt: string, expireIn: number) => {
    const expiryDate = new Date(new Date(createdAt).getTime() + expireIn * 60 * 60 * 1000);
    const now = new Date();
    const diff = expiryDate.getTime() - now.getTime();

    if (diff <= 0) return { expired: true, time: 'Expired', hoursLeft: 0, expiryDate };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return {
      expired: false,
      time: `${hours}h ${minutes}m ${seconds}s`,
      hoursLeft: hours + minutes / 60,
      expiryDate,
    };
  };

  const formatDateTime = (d: Date) =>
    d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const filtered = useMemo(() => {
    if (!query.trim()) return links;
    const q = query.toLowerCase();
    return links.filter(l =>
      [l.title, String(l.target), String(l.amount)].some(v => String(v).toLowerCase().includes(q))
    );
  }, [links, query]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Employee Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage links, view entries, and share proof requirements with users.</p>
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
            onClick={() => router.push('/employee/email-collection')}
            className="flex items-center gap-1"
          >
            <MailCheckIcon className="h-4 w-4" />
            Email Collection
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/employee/users')}
            className="flex items-center gap-1"
          >
            <UsersIcon className="h-4 w-4" />
            Users
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-1"
          >
            <LogOutIcon className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by title, target, amount…"
          className="max-w-md"
        />
        <Badge variant="outline" className="bg-white">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="grid lg:grid-cols-1 gap-6">
        {/* Left: cards */}
        <div className="w-full">
          {loading ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : error ? (
            <Card className="p-6 text-center text-red-600">{error}</Card>
          ) : filtered.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-sm text-muted-foreground">No links found. Adjust your search.</p>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map(link => {
                const { time, expired, hoursLeft, expiryDate } = getTimeLeft(link.createdAt, link.expireIn);
                const state =
                  link.isLatest && !expired ? (hoursLeft <= 6 ? 'urgent' : 'active') : 'closed';

                return (
                  <Card
                    key={link._id}
                    className={`relative p-6 space-y-4 transition ${state === 'active'
                      ? 'bg-white border border-green-200 hover:shadow-md'
                      : state === 'urgent'
                        ? 'bg-amber-50 border-amber-300 hover:shadow-md'
                        : 'bg-white border border-gray-200 hover:shadow-md'
                      }`}
                  >
                    {/* Status ribbon */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {link.isLatest && !expired ? (
                          <Badge
                            className={state === 'urgent' ? 'bg-amber-500' : 'bg-green-600'}
                          >
                            {state === 'urgent' ? 'Expiring soon' : 'Active'}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Closed</Badge>
                        )}
                        <Badge variant="outline">Target: {link.target}</Badge>
                        <Badge variant="outline">₹{link.amount}/person</Badge>
                      </div>
                    </div>

                    <div>
                      <p className="text-lg font-semibold break-words">{link.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Expires: {formatDateTime(expiryDate || new Date(link.createdAt))}
                      </p>
                    </div>

                    {/* Countdown */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium">⌛ Time left</span>
                      <span
                        className={`font-semibold ${expired
                          ? 'text-gray-500'
                          : state === 'urgent'
                            ? 'text-amber-700'
                            : 'text-green-700'
                          }`}
                      >
                        {link.isLatest ? time : '—'}
                      </span>
                    </div>

                    <div className="border-t pt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => goToLink(link._id)}
                        disabled={navigatingId === link._id}
                        className="flex items-center gap-1"
                      >
                        {navigatingId === link._id ? (
                          <span className="animate-spin h-4 w-4 border-t-2 border-gray-600 rounded-full" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                        View Entries
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copy(link.title)}
                        className="flex items-center gap-1 bg-white hover:bg-gray-50"
                      >
                        <ClipboardCopyIcon className="h-4 w-4" />
                        Copy Title
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}