'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Filter, RefreshCcw, ArrowUpRight, Download, Info as InfoIcon, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { post } from '@/lib/axios';

// ===================================================
// API TYPES (updated to match actual payloads)
// ===================================================
export type Platform = 'youtube' | 'instagram' | 'tiktok' | string;

export interface InfluencerDetail {
    email: string;
    handle: string; // e.g. @codewithharry
    platform: Platform; // e.g. 'youtube'
    createdAt?: string | null;
}

export interface EmployeeUserRow {
    userId: string;
    name: string | null;
    total: number; // total contacts saved for this user
    firstSavedAt: string | null;
    lastSavedAt: string | null;
    influencerDetails: InfluencerDetail[]; // may be empty; we lazy-load if needed
}

export interface ListByEmployeeResponse {
    employeeId: string;
    page: number;
    limit: number;
    totalUsers: number;
    hasNext: boolean;
    data: EmployeeUserRow[];
}

export interface ContactsByUserResponse {
    userId: string;
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    data: InfluencerDetail[];
}

// ===================================================
// UTILITIES
// ===================================================
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

const formatDateTime = (s?: string | null) =>
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

// ===================================================
// PAGE
// ===================================================
export default function EmployeeEmailCollectionsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [listMeta, setListMeta] = useState<
        Pick<ListByEmployeeResponse, 'employeeId' | 'page' | 'limit' | 'totalUsers' | 'hasNext'>
    >();
    const [rows, setRows] = useState<EmployeeUserRow[]>([]);

    // Filters
    const [q, setQ] = useState('');
    const [platform, setPlatform] = useState<'all' | Platform>('all');

    // Drawer
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState<EmployeeUserRow | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    useEffect(() => {
        void loadList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function loadList() {
        try {
            setLoading(true);
            setError('');

            const employeeId = readLocal(['employeeId', 'EmployeeId', 'empId', 'EMPLOYEE_ID']);
            if (!employeeId) throw new Error('Missing employeeId in localStorage.');

            // ✅ Updated endpoint and types
            const resp = await post<ListByEmployeeResponse>('/email/getbyemployeeid', {
                employeeId,
                page: 1,
                limit: 100,
            });

            setRows(resp.data.data);
            const { page, limit, totalUsers, hasNext } = resp.data;
            setListMeta({ employeeId, page, limit, totalUsers, hasNext });
        } catch (e: any) {
            const msg = e?.message || 'Failed to fetch list.';
            setError(msg);
            toast('error', 'API error', msg);
        } finally {
            setLoading(false);
        }
    }

    async function loadDetailsIfNeeded(user: EmployeeUserRow) {
        if (user.influencerDetails && user.influencerDetails.length > 0) return user;
        try {
            setDetailsLoading(true);
            const resp = await post<ContactsByUserResponse>('/email/by-user', {
                userId: user.userId,
                page: 1,
                limit: 100,
            });
            const updated: EmployeeUserRow = { ...user, influencerDetails: resp.data.data };
            setRows((prev) => prev.map((r) => (r.userId === user.userId ? updated : r)));
            return updated;
        } catch (e: any) {
            toast('error', 'Failed to load user contacts', e?.message);
            return user;
        } finally {
            setDetailsLoading(false);
        }
    }

    async function openDetails(user: EmployeeUserRow) {
        const withDetails = await loadDetailsIfNeeded(user);
        setActive(withDetails);
        setOpen(true);
    }

    // Derived
    const availablePlatforms = useMemo(() => {
        const set = new Set<string>();
        rows.forEach((r) => r.influencerDetails?.forEach((d) => d.platform && set.add(d.platform)));
        return Array.from(set).sort();
    }, [rows]);

    const filtered = useMemo(() => {
        return rows
            .filter((r) => {
                if (platform !== 'all') {
                    const hasPlatform = r.influencerDetails?.some((d) => d.platform === platform);
                    if (!hasPlatform) return false;
                }
                if (q.trim()) {
                    const needle = q.toLowerCase();
                    const hay = [r.name || '', r.userId, ...r.influencerDetails.flatMap((d) => [d.email, d.handle])]
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
    }, [rows, q, platform]);

    const stats = useMemo(() => {
        const totalUsers = listMeta?.totalUsers ?? rows.length;
        const totalContacts = rows.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
        return { totalUsers, totalContacts };
    }, [rows, listMeta]);

    // Exporters
    function exportAllContactsCSV() {
        const header = ['name', 'email', 'handle', 'platform'];
        const data: string[][] = [header];
        rows.forEach((r) => {
            if (r.influencerDetails?.length) {
                r.influencerDetails.forEach((d) => {
                    data.push([
                        r.name || '',
                        d.email || '',
                        d.handle || '',
                        d.platform || '',
                    ]);
                });
            } else {
                // still include the user row with empty contact fields
                data.push([r.name || '', '', '', '', '']);
            }
        });
        exportCSV('email-contacts-all.csv', data);
    }

    function exportUserContactsCSV(user: EmployeeUserRow) {
        const header = ['email', 'handle', 'platform'];
        const data: string[][] = [header];
        (user.influencerDetails || []).forEach((d) =>
            data.push([
                d.email || '',
                d.handle || '',
                d.platform || '',
            ])
        );
        exportCSV(`contacts-${user.name}.csv`, data);
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border bg-white">
                    <CardContent className="p-5">
                        <div className="text-sm text-muted-foreground">Total Users</div>
                        <div className="text-2xl font-semibold mt-1">{stats.totalUsers}</div>
                    </CardContent>
                </Card>
                <Card className="border bg-white">
                    <CardContent className="p-5">
                        <div className="text-sm text-muted-foreground">Total Contacts</div>
                        <div className="text-2xl font-semibold mt-1">{stats.totalContacts}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card className="border bg-white">
                <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
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
                            <Button onClick={exportAllContactsCSV}>
                                <Download className="h-4 w-4 mr-1" /> Export All
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border bg-white">
                <CardHeader className="p-4">
                    <CardTitle className="text-base">Users & Saved Contacts</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>First Saved</TableHead>
                                    <TableHead>Last Saved</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                            <div className="inline-flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                                            No data.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((r) => (
                                        <TableRow key={r.userId} className="hover:bg-gray-50">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{r.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{r.total}</Badge>
                                            </TableCell>
                                            <TableCell>{formatDateTime(r.firstSavedAt)}</TableCell>
                                            <TableCell>{formatDateTime(r.lastSavedAt)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="inline-flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => openDetails(r)}>
                                                        <ArrowUpRight className="h-4 w-4 mr-1" /> View
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => exportUserContactsCSV(r)}>
                                                        <Download className="h-4 w-4 mr-1" /> Export
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
                        <SheetTitle className="flex items-center gap-2">
                            Saved Contacts
                        </SheetTitle>
                    </SheetHeader>

                    {!active ? (
                        <div className="py-10 text-center text-muted-foreground">No selection.</div>
                    ) : (
                        <div className="py-4 space-y-6">
                            <div>
                                <div className="text-sm text-muted-foreground">User</div>
                                <div className="font-medium">{active.name}</div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{active.total} contact{active.total !== 1 ? 's' : ''}</Badge>
                                <span className="text-xs text-muted-foreground ml-auto">
                                    Last Saved: {formatDateTime(active.lastSavedAt)}
                                </span>
                            </div>


                            <Card className="border bg-white">
                                <CardHeader className="p-4">
                                    <CardTitle className="text-sm">Contacts</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3">
                                    {detailsLoading ? (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                                        </div>
                                    ) : active.influencerDetails.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">No contacts for this user.</div>
                                    ) : (
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
                                                    {active.influencerDetails.map((c, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell className="font-medium">{c.email}</TableCell>
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
