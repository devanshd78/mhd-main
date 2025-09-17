'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { post } from '@/lib/axios';

// ===================================================
// This page consumes the Admin API (getAllEmailContacts)
// POST body: { page, limit, userId?, search? }
// Response: { page, limit, total, hasNext, data: { email, handle, platform }[] }
// ===================================================

export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'facebook' | 'other' | string;

interface EmailContactItem {
  email: string;
  handle: string; // may include leading @
  platform: Platform;
}

interface AllContactsResponse {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  data: EmailContactItem[];
}

const API_PATH = '/email/contacts/all'; // ⟵ align with your route that calls getAllEmailContacts

const toast = (icon: 'success' | 'error' | 'info' | 'warning', title: string, text?: string) =>
  Swal.fire({ toast: true, position: 'top-end', icon, title, text, timer: 2200, showConfirmButton: false, timerProgressBar: true });

function formatRange(page: number, limit: number, total: number) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);
  if (total === 0) return '0 of 0';
  return `${start}–${end} of ${total}`;
}

export default function AdminEmailContactsPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // query state
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [userId, setUserId] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // data state
  const [rows, setRows] = useState<EmailContactItem[]>([]);
  const [total, setTotal] = useState<number>(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit || 1)), [total, limit]);

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  async function fetchData() {
    try {
      setLoading(true);
      setError('');
      const resp = await post<AllContactsResponse>(API_PATH, {
        page,
        limit,
        userId: userId.trim() || undefined,
        search: search.trim() || undefined,
      });
      // AxiosResponse<T> → payload in resp.data
      setRows(resp.data.data);
      setTotal(resp.data.total);
    } catch (e: any) {
      const msg = e?.message || 'Failed to fetch contacts.';
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

  function copyEmails(emails: string[]) {
    const text = emails.join(', ');
    navigator.clipboard
      .writeText(text)
      .then(() => toast('success', 'Copied emails'))
      .catch(() => toast('error', 'Copy failed'));
  }

  function exportCSV(items: EmailContactItem[]) {
    const header = ['email', 'handle', 'platform'];
    const rows = [header, ...items.map((i) => [i.email, i.handle, i.platform])];
    const csv = rows.map((r) => r.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-page${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pageEmails = useMemo(() => rows.map((r) => r.email), [rows]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Header / Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border bg-white">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Total Contacts</div>
            <div className="text-2xl font-semibold mt-1">{total}</div>
          </CardContent>
        </Card>
        <Card className="border bg-white">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">This Page</div>
            <div className="text-2xl font-semibold mt-1">{rows.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border bg-white">
        <CardHeader className="p-4">
          <CardTitle className="text-base">Search & Filters</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <form className="grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={onSearchSubmit}>
            <div className="space-y-1.5 md:col-span-2">
              <div className="text-xs text-muted-foreground">Search (email / @handle / platform)</div>
              <Input
                placeholder="e.g. @codewithharry or youtube or user@example.com"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Filter by userId (optional)</div>
              <Input placeholder="Collector userId" value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Page size</div>
              <Select
                value={String(limit)}
                onValueChange={(v) => {
                  setLimit(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select limit" />
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100, 200].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-4 flex gap-2">
              <Button type="submit">Apply</Button>
              <Button type="button" variant="outline" onClick={() => { setSearch(''); setUserId(''); setPage(1); void fetchData(); }}>
                Reset
              </Button>
              <Button type="button" variant="outline" onClick={() => copyEmails(pageEmails)}>
                Copy emails (page)
              </Button>
              <Button type="button" onClick={() => exportCSV(rows)}>
                Export CSV (page)
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border bg-white">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Email Contacts</CardTitle>
            <div className="text-sm text-muted-foreground">{formatRange(page, limit, total)}</div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Handle</TableHead>
                  <TableHead>Platform</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      <div className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">No results</TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, idx) => (
                    <TableRow key={idx} className="hover:bg-gray-50">
                      <TableCell>
                        <button
                          className="underline underline-offset-2 hover:no-underline"
                          onClick={() => copyEmails([r.email])}
                          title="Click to copy"
                        >
                          {r.email}
                        </button>
                      </TableCell>
                      <TableCell>{r.handle}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{r.platform}</Badge>
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
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || page <= 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={loading || page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
