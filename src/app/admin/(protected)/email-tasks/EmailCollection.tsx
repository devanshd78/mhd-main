"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Loader2, Download, Copy, ChevronUp, ChevronDown, Search, Users2, ListChecks, Filter, X, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import { post } from "@/lib/axios";
import { useVirtualizer } from "@tanstack/react-virtual";

// ---------- Types ----------
export type Platform = "youtube" | "instagram" | "tiktok" | string;

interface ContactRow {
  email: string;
  handle: string;
  platform: Platform;
  createdAt?: string;
  youtube?: {
    channelId: string;
    title: string;
    handle: string;
    urlByHandle: string;
    urlById: string;
    country?: string;
    subscriberCount?: number;
    videoCount?: number;
    viewCount?: number;
    description?: string;
    topicCategories?: string[];
    topicCategoryLabels?: string[];
    fetchedAt?: string;
  };
}

interface CollectorBlock {
  username: string;
  userId: string;
  totalCollected: number;
  dataCollected: ContactRow[]; // server already slices by detailsLimit
}

interface EmployeeBlock {
  employeeName: string;
  employeeId: string;
  employeeEmail: string;
  teamCounts: { members: number; contactsTotal: number };
  collectors: CollectorBlock[]; // only non-empty
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

// ---------- API ----------
const API_PATH = "/email/admin/all"; // keep aligned with your backend route

// ---------- Utils ----------
const toast = (
  icon: "success" | "error" | "info" | "warning",
  title: string,
  text?: string
) =>
  Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    title,
    text,
    timer: 2200,
    showConfirmButton: false,
    timerProgressBar: true,
  });

const fmtDateTime = (s?: string) => (s ? new Date(s).toLocaleString() : "-");
const n = (x?: number) => (typeof x === "number" ? x.toLocaleString() : "-");
const compact = (x: number) => Intl.NumberFormat(undefined, { notation: "compact" }).format(x);

const formatRange = (page: number, limit: number, total: number) => {
  const start = (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);
  if (total === 0) return "0 of 0";
  return `${start}–${end} of ${total}`;
};

function debounce<T extends (...args: any[]) => any>(fn: T, delay = 350) {
  let timer: any;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ---------- Main Component ----------
export default function AdminEmployeeOverviewPage() {
  // fetch state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // query state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50); // larger default for power users
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [detailsLimit, setDetailsLimit] = useState(1000);

  // data
  const [rows, setRows] = useState<EmployeeBlock[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  // sorting
  const [sortKey, setSortKey] = useState<"name" | "members" | "contacts">("contacts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // drawer
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<EmployeeBlock | null>(null);

  // filters inside drawer
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");

  // virtualization ref for main list
  const parentRef = useRef<HTMLDivElement | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalEmployees || 1) / limit)),
    [totalEmployees, limit]
  );

  const runFetch = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const resp = await post<OverviewResponse>(API_PATH, {
        page,
        limit,
        detailsLimit,
        search: appliedSearch || undefined,
      });
      const payload = resp.data;
      setRows(payload.data || []);
      setTotalEmployees(payload.totalEmployees || 0);
      setHasNext(!!payload.hasNext);
      if (typeof payload.detailsLimit === "number") setDetailsLimit(payload.detailsLimit);
    } catch (e: any) {
      const msg = e?.message || "Failed to fetch overview.";
      setError(msg);
      toast("error", "API error", msg);
    } finally {
      setLoading(false);
    }
  }, [page, limit, detailsLimit, appliedSearch]);

  useEffect(() => {
    runFetch();
  }, [runFetch]);

  // debounced search apply
  const applySearch = useMemo(
    () =>
      debounce((value: string) => {
        setAppliedSearch(value.trim());
        setPage(1);
      }, 400),
    []
  );

  // sort visible rows (client-side sort for the current page)
  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return dir * a.employeeName.localeCompare(b.employeeName);
      if (sortKey === "members") return dir * ((a.teamCounts?.members || 0) - (b.teamCounts?.members || 0));
      return dir * ((a.teamCounts?.contactsTotal || 0) - (b.teamCounts?.contactsTotal || 0));
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  // aggregates for current page
  const visibleStats = useMemo(() => {
    const employeesVisible = sortedRows.length;
    const membersVisible = sortedRows.reduce((a, e) => a + (e.teamCounts?.members || 0), 0);
    const contactsVisible = sortedRows.reduce((a, e) => a + (e.teamCounts?.contactsTotal || 0), 0);
    const previewRows = sortedRows.reduce((a, e) => a + e.collectors.reduce((aa, c) => aa + c.dataCollected.length, 0), 0);
    return { employeesVisible, membersVisible, contactsVisible, previewRows };
  }, [sortedRows]);

  // utilities
  function copyEmails(list: string[]) {
    const text = Array.from(new Set(list)).join(", ");
    navigator.clipboard
      .writeText(text)
      .then(() => toast("success", "Copied emails"))
      .catch(() => toast("error", "Copy failed"));
  }

  function exportContactsCSV(filename: string, contacts: ContactRow[]) {
    const header = [
      "email",
      "handle",
      "platform",
      "createdAt",
      "channelTitle",
      "channelHandle",
      "subscriberCount",
      "videoCount",
      "viewCount",
      "country",
      "categories",
    ];
    const rows = [
      header,
      ...contacts.map((c) => [
        c.email,
        c.handle,
        c.platform,
        c.createdAt ? new Date(c.createdAt).toISOString() : "",
        c.youtube?.title || "",
        c.youtube?.handle || "",
        c.youtube?.subscriberCount ?? "",
        c.youtube?.videoCount ?? "",
        c.youtube?.viewCount ?? "",
        c.youtube?.country || "",
        (c.youtube?.topicCategoryLabels || []).join(" | "),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openEmployee(e: EmployeeBlock) {
    setActive(e);
    setPlatformFilter("all");
    setCategoryFilter("all");
    setOpen(true);
  }

  // virtualization for the main employees list (div-based rows to avoid <tr> positioning issues)
  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // row height estimate
    overscan: 8,
  });

  // filtered contacts inside drawer by platform + category
  const activeCollectors = useMemo(() => {
    if (!active) return [] as CollectorBlock[];

    const platformFiltered =
      platformFilter === "all"
        ? active.collectors
        : active.collectors.map((c) => ({
            ...c,
            dataCollected: c.dataCollected.filter((r) => r.platform === platformFilter),
          }));

    if (categoryFilter === "all") return platformFiltered;

    return platformFiltered.map((c) => ({
      ...c,
      dataCollected: c.dataCollected.filter((r) =>
        (r.youtube?.topicCategoryLabels || []).includes(categoryFilter as string)
      ),
    }));
  }, [active, platformFilter, categoryFilter]);

  const allPageContacts = useMemo(
    () => sortedRows.flatMap((e) => e.collectors.flatMap((c) => c.dataCollected)),
    [sortedRows]
  );

  // derive category options/counts for the active employee (respecting platformFilter)
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!active) return map;
    const base =
      platformFilter === "all"
        ? active.collectors
        : active.collectors.map((c) => ({
            ...c,
            dataCollected: c.dataCollected.filter((r) => r.platform === platformFilter),
          }));
    base.forEach((c) => {
      c.dataCollected.forEach((r) => {
        (r.youtube?.topicCategoryLabels || []).forEach((label) => {
          map.set(label, (map.get(label) || 0) + 1);
        });
      });
    });
    return map;
  }, [active, platformFilter]);

  // CSS grid template used for header + rows (kept responsive)
  const gridCols = "grid-cols-[minmax(180px,2fr)_minmax(80px,1fr)_minmax(120px,1fr)_minmax(200px,1.5fr)]";

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value={n(totalEmployees)} />
        <StatCard label="Visible Employees" value={n(visibleStats.employeesVisible)} />
        <StatCard label="Team Members (visible)" value={n(visibleStats.membersVisible)} />
        <StatCard label="Contacts Total (visible)" value={n(visibleStats.contactsVisible)} />
      </div>

      {/* Controls */}
      <Card className="border bg-white shadow-sm">
        <CardHeader className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">Search & Filters</CardTitle>
          <div className="text-xs text-muted-foreground">{formatRange(page, limit, totalEmployees)}</div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-2">
              <div className="text-xs text-muted-foreground mb-1">Search by employee name</div>
              <div className="flex items-center gap-2">
                <div className="relative w-full">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="e.g. Devansh"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      applySearch(e.target.value);
                    }}
                  />
                </div>
                {search && (
                  <Button variant="ghost" size="icon" onClick={() => { setSearch(""); applySearch(""); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Sort</div>
              <div className="flex gap-2">
                <Select value={sortKey} onValueChange={(v: any) => setSortKey(v)}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contacts">Contacts</SelectItem>
                    <SelectItem value="members">Members</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
                  {sortDir === "asc" ? (
                    <span className="inline-flex items-center gap-1"><ChevronUp className="h-4 w-4" /> Asc</span>
                  ) : (
                    <span className="inline-flex items-center gap-1"><ChevronDown className="h-4 w-4" /> Desc</span>
                  )}
                </Button>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Page size</div>
              <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Limit" /></SelectTrigger>
                <SelectContent>
                  {[25, 50, 100, 200, 500].map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Details per collector</div>
              <Input
                type="number"
                min={1}
                max={20000}
                value={detailsLimit}
                onChange={(e) => setDetailsLimit(Math.max(1, Math.min(20000, Number(e.target.value) || 0)))}
              />
            </div>

            <div className="md:col-span-5 flex flex-wrap gap-2">
              <Button onClick={() => runFetch()}>Apply</Button>
              <Button variant="outline" onClick={() => { setSearch(""); setAppliedSearch(""); setPage(1); runFetch(); }}>Reset</Button>
              <Button variant="outline" onClick={() => copyEmails(allPageContacts.map((c) => c.email))}>
                <Copy className="h-4 w-4 mr-2" /> Copy emails (page)
              </Button>
              <Button onClick={() => exportContactsCSV(`overview-page${page}.csv`, allPageContacts)}>
                <Download className="h-4 w-4 mr-2" /> Export CSV (page)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employees List (Virtualized / Grid-based) */}
      <Card className="border bg-white shadow-sm">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Employees with Collected Contacts</CardTitle>
            <div className="text-sm text-muted-foreground">Page {page} of {totalPages}</div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={parentRef} className="h-[560px] overflow-auto border-t">
            {/* Sticky header */}
            <div className={`sticky top-0 z-10 hidden md:grid ${gridCols} bg-gray-50 border-b px-4 py-2 text-xs text-muted-foreground`}>
              <div>Employee</div>
              <div>Members</div>
              <div>Contacts Total</div>
              <div className="text-right">Actions</div>
            </div>

            {/* Mobile cards header hint */}
            <div className="md:hidden px-4 py-2 text-xs text-muted-foreground border-b bg-gray-50">
              Employees (scroll) — tap a card to view collectors
            </div>

            {/* Virtual list container */}
            {loading ? (
              <div className="py-10 text-center text-muted-foreground">
                <div className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
              </div>
            ) : sortedRows.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">No results</div>
            ) : (
              <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
                {rowVirtualizer.getVirtualItems().map((vr) => {
                  const e = sortedRows[vr.index];
                  return (
                    <div
                      key={e.employeeId}
                      data-index={vr.index}
                      ref={(node) => rowVirtualizer.measureElement(node as Element)}
                      className="absolute inset-x-0"
                      style={{ transform: `translateY(${vr.start}px)` }}
                    >
                      {/* Desktop row */}
                      <div className={`hidden md:grid ${gridCols} items-center px-4 py-3 hover:bg-gray-50`}>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate">{e.employeeName}</span>
                          <span className="text-[11px] text-muted-foreground truncate">{e.employeeEmail}</span>
                          <span className="text-[11px] text-muted-foreground truncate">ID: {e.employeeId}</span>
                        </div>
                        <div><Badge variant="outline">{e.teamCounts.members}</Badge></div>
                        <div><Badge variant="outline">{e.teamCounts.contactsTotal}</Badge></div>
                        <div className="text-right">
                          <div className="inline-flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEmployee(e)}>View collectors</Button>
                            <Button size="sm" variant="outline" onClick={() => exportContactsCSV(`employee-${e.employeeId}.csv`, e.collectors.flatMap((c) => c.dataCollected))}>Export CSV</Button>
                          </div>
                        </div>
                      </div>

                      {/* Mobile card */}
                      <button className="md:hidden w-full text-left px-4 py-3 border-b active:bg-gray-50" onClick={() => openEmployee(e)}>
                        <div className="font-medium">{e.employeeName}</div>
                        <div className="text-[11px] text-muted-foreground">{e.employeeEmail}</div>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <Badge variant="outline">Members {e.teamCounts.members}</Badge>
                          <Badge variant="outline">Contacts {e.teamCounts.contactsTotal}</Badge>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground">Use page size + virtualization for speed. Server says {hasNext ? "more pages available" : "end of results"}.</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page <= 1}>Previous</Button>
          <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={loading || (!hasNext && page >= totalPages)}>Next</Button>
        </div>
      </div>

      {/* Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto p-0">
          <div className="p-4">
            <SheetHeader>
              <SheetTitle>Collectors & Contacts</SheetTitle>
              <SheetDescription>Designed for 100s/1000s of rows per collector — fully virtualized.</SheetDescription>
            </SheetHeader>
          </div>

          {!active ? (
            <div className="py-10 text-center text-muted-foreground">No selection.</div>
          ) : (
            <div className="px-4 pb-4 space-y-4">
              {/* Employee header */}
              <Card className="border bg-white">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-muted-foreground">Employee</div>
                    <div className="font-medium truncate">{active.employeeName}</div>
                    <div className="text-xs text-muted-foreground truncate">{active.employeeEmail}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">Members {active.teamCounts.members}</Badge>
                    <Badge variant="outline">Contacts {compact(active.teamCounts.contactsTotal)}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Drawer filters */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-1">Platform</span>
                  <Badge
                    variant={platformFilter === "all" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setPlatformFilter("all")}
                  >All</Badge>
                  {(["youtube", "instagram", "tiktok"] as Platform[]).map((p) => (
                    <Badge key={p}
                      variant={platformFilter === p ? "default" : "outline"}
                      className="capitalize cursor-pointer"
                      onClick={() => setPlatformFilter(p)}
                    >{p}</Badge>
                  ))}
                </div>

                {/* Category chips (from API topicCategoryLabels) */}
                {categoryCounts.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground mr-1">Category</span>
                    <Badge
                      variant={categoryFilter === "all" ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setCategoryFilter("all")}
                    >All</Badge>
                    {Array.from(categoryCounts.entries()).map(([label, count]) => (
                      <Badge
                        key={label}
                        variant={categoryFilter === label ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setCategoryFilter(label)}
                        title={`${count} contact${count === 1 ? "" : "s"}`}
                      >{label} ({count})</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Collectors (collapsible + virtualized lists) */}
              <div className="space-y-3">
                {activeCollectors.map((collector) => (
                  <CollectorCard key={collector.userId} collector={collector} copyEmails={copyEmails} exportContactsCSV={exportContactsCSV} />
                ))}
              </div>

              <div className="text-xs text-muted-foreground">Preview rows (sum across collectors): {n(visibleStats.previewRows)}</div>
            </div>
          )}

          <div className="p-4">
            <SheetFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}

// ---------- Subcomponents ----------
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card className="border bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold mt-1">{value}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CollectorCard({
  collector,
  copyEmails,
  exportContactsCSV,
}: {
  collector: CollectorBlock;
  copyEmails: (emails: string[]) => void;
  exportContactsCSV: (filename: string, contacts: ContactRow[]) => void;
}) {
  const [open, setOpen] = useState(true);

  // virtualization inside collector contacts — use div rows to avoid <tr> positioning pitfalls
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rows = collector.dataCollected;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const innerGrid = "grid grid-cols-[minmax(180px,1.5fr)_minmax(140px,1fr)_minmax(100px,.8fr)_minmax(140px,1fr)_minmax(120px,1fr)]";

  return (
    <Card className="border bg-white">
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2" onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <CardTitle className="text-sm truncate max-w-[60vw]">{collector.username || collector.userId}</CardTitle>
          </button>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Total {n(collector.totalCollected)}</Badge>
            <Button size="sm" variant="outline" onClick={() => copyEmails(rows.map((x) => x.email))}><Copy className="h-4 w-4 mr-1" />Copy</Button>
            <Button size="sm" variant="outline" onClick={() => exportContactsCSV(`collector-${collector.userId}.csv`, rows)}><Download className="h-4 w-4 mr-1" />Export</Button>
          </div>
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <CardContent className="p-0">
              <div ref={parentRef} className="h-[360px] overflow-auto border-t">
                {/* header */}
                <div className={`sticky top-0 z-10 hidden md:${innerGrid} bg-gray-50 border-b px-4 py-2 text-xs text-muted-foreground`}>
                  <div>Email</div>
                  <div>Handle</div>
                  <div>Platform</div>
                  <div>Saved</div>
                  <div className="text-right">Info</div>
                </div>
                <div className="md:hidden px-4 py-2 text-xs text-muted-foreground border-b bg-gray-50">Contacts</div>

                {rows.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground">No contacts</div>
                ) : (
                  <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
                    {rowVirtualizer.getVirtualItems().map((vr) => {
                      const row = rows[vr.index];
                      return (
                        <div
                          key={`${row.email}-${vr.index}`}
                          data-index={vr.index}
                          ref={(node) => rowVirtualizer.measureElement(node as Element)}
                          className="absolute inset-x-0"
                          style={{ transform: `translateY(${vr.start}px)` }}
                        >
                          {/* Desktop row */}
                          <div className={`${innerGrid} items-center px-4 py-3 hover:bg-gray-50 hidden md:grid`}>
                            <button className="underline underline-offset-2 hover:no-underline truncate text-left" onClick={() => navigator.clipboard.writeText(row.email)} title="Click to copy">
                              {row.email}
                            </button>
                            <div className="truncate">{row.handle}</div>
                            <div><Badge variant="outline" className="capitalize">{row.platform}</Badge></div>
                            <div>{fmtDateTime(row.createdAt)}</div>
                            <div className="text-right">
                              {row.youtube ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button size="sm" variant="outline">Details</Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-96 max-w-full">
                                    <div className="space-y-2 text-sm">
                                      <div className="font-medium break-words">{row.youtube.title}</div>
                                      <div className="text-xs text-muted-foreground break-all">{row.youtube.handle}</div>
                                      <Separator />
                                      <div className="grid grid-cols-3 gap-2">
                                        <MiniStat icon={<Users2 className="h-4 w-4" />} label="Subs" value={row.youtube.subscriberCount ? compact(row.youtube.subscriberCount) : "-"} />
                                        <MiniStat icon={<ListChecks className="h-4 w-4" />} label="Videos" value={row.youtube.videoCount ? compact(row.youtube.videoCount) : "-"} />
                                        <MiniStat icon={<Filter className="h-4 w-4" />} label="Views" value={row.youtube.viewCount ? compact(row.youtube.viewCount) : "-"} />
                                      </div>
                                      <div className="text-xs text-muted-foreground">Country: {row.youtube.country || "-"}</div>
                                      {row.youtube.description && (
                                        <div className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                                          {row.youtube.description}
                                        </div>
                                      )}
                                      {row.youtube.topicCategoryLabels?.length ? (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {row.youtube.topicCategoryLabels.map((t, idx) => (
                                            <Badge key={`${t}-${idx}`} variant="outline" className="text-[10px]">{t}</Badge>
                                          ))}
                                        </div>
                                      ) : null}
                                      <div className="flex gap-2">
                                        <a className="underline text-sm" href={row.youtube.urlByHandle} target="_blank" rel="noreferrer">Open channel</a>
                                        <a className="underline text-sm" href={row.youtube.urlById} target="_blank" rel="noreferrer">Open by ID</a>
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">Fetched: {fmtDateTime(row.youtube.fetchedAt)}</div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </div>

                          {/* Mobile row */}
                          <div className="md:hidden px-4 py-3 border-b">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{row.handle || row.email}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{row.email}</div>
                              </div>
                              <Badge variant="outline" className="capitalize">{row.platform}</Badge>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">Saved: {fmtDateTime(row.createdAt)}</div>
                            {row.youtube && (
                              <div className="mt-2">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button size="sm" variant="outline">Details</Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 max-w-full">
                                    <div className="space-y-2 text-sm">
                                      <div className="font-medium break-words">{row.youtube.title}</div>
                                      <div className="text-xs text-muted-foreground break-all">{row.youtube.handle}</div>
                                      <Separator />
                                      <div className="grid grid-cols-3 gap-2">
                                        <MiniStat icon={<Users2 className="h-4 w-4" />} label="Subs" value={row.youtube.subscriberCount ? compact(row.youtube.subscriberCount) : "-"} />
                                        <MiniStat icon={<ListChecks className="h-4 w-4" />} label="Videos" value={row.youtube.videoCount ? compact(row.youtube.videoCount) : "-"} />
                                        <MiniStat icon={<Filter className="h-4 w-4" />} label="Views" value={row.youtube.viewCount ? compact(row.youtube.viewCount) : "-"} />
                                      </div>
                                      <div className="text-xs text-muted-foreground">Country: {row.youtube.country || "-"}</div>
                                      {row.youtube.description && (
                                        <div className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                                          {row.youtube.description}
                                        </div>
                                      )}
                                      {row.youtube.topicCategoryLabels?.length ? (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {row.youtube.topicCategoryLabels.map((t, idx) => (
                                            <Badge key={`${t}-${idx}`} variant="outline" className="text-[10px]">{t}</Badge>
                                          ))}
                                        </div>
                                      ) : null}
                                      <div className="flex gap-2">
                                        <a className="underline text-sm" href={row.youtube.urlByHandle} target="_blank" rel="noreferrer">Open channel</a>
                                        <a className="underline text-sm" href={row.youtube.urlById} target="_blank" rel="noreferrer">Open by ID</a>
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">Fetched: {fmtDateTime(row.youtube.fetchedAt)}</div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="p-2 rounded-xl border bg-white shadow-sm">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <div className="font-medium">{value}</div>
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
