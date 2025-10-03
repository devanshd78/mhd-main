"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Filter,
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCcw,
  X,
  Copy as CopyIcon,
  UploadCloud,
  CheckSquare,
} from "lucide-react";
import { post } from "@/lib/axios";

/**
 * Types matching the /missing/list backend contract
 */
export type MissingItem = {
  missingId: string; // kept for keys only; not rendered
  handle: string;
  platform: "youtube" | "instagram" | "tiktok" | string;
  createdAt: string; // ISO
};

export type MissingListResponse = {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  data: MissingItem[];
};

export type MissingListRequest = {
  page?: number;
  limit?: number; // default 50, max 200
  search?: string;
  platform?: string;
  handle?: string;
};

async function listMissing(body: MissingListRequest): Promise<MissingListResponse> {
  const res = await post<MissingListResponse>("/missing/list", body);
  return res.data; // <- unwrap AxiosResponse<T>
}

// --- Create Email Task API (simple single or bulk) ---
export type CreateEmailTaskItem = {
  platform: string;
  targetUser?: string; // we'll map from item.handle for convenience
  amountPerPerson: number;
  expireIn: number; // hours
};
export type CreateEmailTasksRequest =
  | { items: CreateEmailTaskItem[]; adminId: string }
  | (CreateEmailTaskItem & { adminId: string });

async function createEmailTasks(body: CreateEmailTasksRequest): Promise<any> {
  const res = await post<any>("/admin/emailtasks", body);
  return res.data;
}

// --- Small utilities ---
const prettyDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "-");

const relativeTime = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - d) / 1000));
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
};

const useDebouncedValue = (value: string, delay = 400) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};

const getPlatformColor = (platform: string) => {
  switch (platform.toLowerCase()) {
    case "youtube":
    case "yt":
      return "bg-red-100 text-red-700 border-red-200";
    case "instagram":
    case "ig":
      return "bg-pink-100 text-pink-700 border-pink-200";
    case "tiktok":
    case "tt":
      return "bg-gray-900 text-white border-gray-900";
    default:
      return "bg-blue-100 text-blue-700 border-blue-200";
  }
};

const platformLabel = (platform: string) => {
  const p = platform.toLowerCase();
  if (p === "yt") return "youtube";
  if (p === "ig") return "instagram";
  if (p === "tt") return "tiktok";
  return platform;
};

const getPlatformIcon = (platform: string) => {
  switch (platform.toLowerCase()) {
    case "youtube":
    case "yt":
      return <div className="w-3.5 h-3.5 bg-red-600 rounded-sm" />;
    case "instagram":
    case "ig":
      return (
        <div className="w-3.5 h-3.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg" />
      );
    case "tiktok":
    case "tt":
      return <div className="w-3.5 h-3.5 bg-black rounded-full" />;
    default:
      return <div className="w-3.5 h-3.5 bg-blue-500 rounded" />;
  }
};

// Simple copy helper
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// --- Page component ---
export default function MissingListPage() {
  const [items, setItems] = useState<MissingItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Row selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Upload Task modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<MissingItem | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [expireHours, setExpireHours] = useState<string>("24");
  const [amount, setAmount] = useState<string>("10");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [handle, setHandle] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 500);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body: MissingListRequest = {
        page,
        limit,
        search: debouncedSearch.trim() || undefined,
        platform: platform.trim() || undefined,
        handle: handle.trim() || undefined,
      };

      const payload = await listMissing(body);
      setItems(payload.data);
      setTotal(payload.total);
      setHasNext(payload.hasNext);
      // Clear selection when data changes
      setSelected(new Set());
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, platform, handle]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, platform, handle]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(total / Math.max(1, limit))),
    [total, limit]
  );
  const hasActiveFilters = !!(search || platform || handle);

  const clearFilters = () => {
    setSearch("");
    setPlatform("");
    setHandle("");
  };

  const from = useMemo(
    () => (items.length ? (page - 1) * limit + 1 : 0),
    [items.length, page, limit]
  );
  const to = useMemo(
    () => (items.length ? (page - 1) * limit + items.length : 0),
    [items.length, page, limit]
  );

  const quickPlatforms = [
    { key: "youtube", label: "YouTube" },
    { key: "instagram", label: "Instagram" },
    { key: "tiktok", label: "TikTok" },
  ];

  // Selection helpers
  const isAllChecked = items.length > 0 && items.every((it) => selected.has(it.missingId));
  const toggleAll = () => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (isAllChecked) {
        items.forEach((it) => s.delete(it.missingId));
      } else {
        items.forEach((it) => s.add(it.missingId));
      }
      return s;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  // Modal helpers
  const openUploadModal = (item?: MissingItem) => {
    setModalItem(item ?? null);
    setBulkMode(!item);
    setExpireHours("24");
    setAmount("10");
    setSubmitError(null);
    setSubmitSuccess(null);
    setModalOpen(true);
  };
  const closeUploadModal = () => {
    setModalOpen(false);
    setSubmitError(null);
    setSubmitSuccess(null);
    setModalItem(null);
    setBulkMode(false);
  };

  const onSubmitUpload = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    const adminId = typeof window !== "undefined" ? localStorage.getItem("adminId") || "" : "";
    if (!adminId) {
      setSubmitError("Admin session missing. Please log in again.");
      return;
    }
    const exp = Number(expireHours);
    const amt = Number(amount);
    if (!Number.isFinite(exp) || exp < 1) {
      setSubmitError("Please enter a valid expiry in hours (min 1).");
      return;
    }
    if (!Number.isFinite(amt) || amt < 0) {
      setSubmitError("Please enter a valid non-negative amount.");
      return;
    }
    setSubmitLoading(true);
    try {
      if (bulkMode) {
        const map = new Map(items.map((i) => [i.missingId, i]));
        const payloadItems: CreateEmailTaskItem[] = Array.from(selected)
          .map((id) => map.get(id))
          .filter(Boolean)
          .map((it) => ({
            platform: platformLabel((it as MissingItem).platform),
            targetUser: (it as MissingItem).handle,
            amountPerPerson: amt,
            expireIn: exp,
          }));
        if (!payloadItems.length) {
          setSubmitError("No selected rows to upload.");
          setSubmitLoading(false);
          return;
        }
        await createEmailTasks({ items: payloadItems, adminId });
      } else if (modalItem) {
        await createEmailTasks({
          platform: platformLabel(modalItem.platform),
          targetUser: modalItem.handle,
          amountPerPerson: amt,
          expireIn: exp,
          adminId,
        });
      }

      setSubmitSuccess("Email task(s) created successfully.");
      setTimeout(() => {
        closeUploadModal();
        fetchData();
      }, 500);
    } catch (e: any) {
      setSubmitError(e?.response?.data?.error || e?.message || "Failed to create email task(s)");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Missing Details</h1>
              <p className="text-gray-600">Track and manage missing creator information</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                disabled={loading}
                aria-label="Refresh"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCcw className="w-4 h-4" />
                )}
                Refresh
              </button>

              {selected.size > 0 && (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200 text-blue-700">
                    <CheckSquare className="w-4 h-4" />
                    <span className="font-medium">{selected.size}</span>
                    <span>selected</span>
                  </div>
                  <button
                    onClick={() => openUploadModal()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <UploadCloud className="w-4 h-4" />
                    Upload Task (Selected)
                  </button>
                </>
              )}

              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm border">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-gray-900">{total.toLocaleString()}</span>
                <span className="text-gray-500">total</span>
              </div>
            </div>
          </div>

          {/* Quick platform chips */}
          <div className="flex flex-wrap gap-2">
            {quickPlatforms.map((p) => {
              const active = platformLabel(platform) === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setPlatform(active ? "" : p.key)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"
                    }`}
                >
                  {getPlatformIcon(p.key)}
                  {p.label}
                  {active && <X className="w-3.5 h-3.5 opacity-80" />}
                </button>
              );
            })}
          </div>
        </header>

        {/* Search + Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6 sticky top-4 z-10">
          {/* Main Search */}
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              placeholder="Search by handle or platform..."
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filter Row */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setFiltersOpen((s) => !s)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4" />
              Advanced Filters
              {hasActiveFilters && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
            </button>

            <div className="flex items-center gap-2">
              {platform && (
                <AppliedChip label={`Platform: ${platformLabel(platform)}`} onClear={() => setPlatform("")} />
              )}
              {handle && <AppliedChip label={`Handle: ${handle}`} onClear={() => setHandle("")} />}
              {search && <AppliedChip label={`Search: "${search}"`} onClear={() => setSearch("")} />}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Advanced Filters */}
          {filtersOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="">All platforms</option>
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Handle</label>
                <input
                  placeholder="@handle or handle"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <Th>
                    <input
                      type="checkbox"
                      aria-label="Select all on page"
                      className="w-4 h-4 rounded border-gray-300"
                      checked={isAllChecked}
                      onChange={toggleAll}
                    />
                  </Th>
                  <Th>Handle</Th>
                  <Th>Platform</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && <SkeletonRows rows={Math.min(limit, 10)} />}

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <div className="text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="font-medium">No results found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  items.map((item, index) => (
                    <tr
                      key={item.missingId}
                      className="hover:bg-gray-50 transition-colors"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <Td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.handle}`}
                          className="w-4 h-4 rounded border-gray-300"
                          checked={selected.has(item.missingId)}
                          onChange={() => toggleOne(item.missingId)}
                        />
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{item.handle}</span>
                          <button
                            title="Copy handle"
                            aria-label="Copy handle"
                            onClick={async () => {
                              const ok = await copyToClipboard(item.handle);
                              if (!ok) alert("Couldn't copy");
                            }}
                            className="p-1 rounded hover:bg-gray-100 text-gray-500"
                          >
                            <CopyIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(item.platform)}
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPlatformColor(
                              item.platform
                            )}`}
                          >
                            {platformLabel(item.platform)}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4 opacity-50" />
                          <span className="text-sm" title={prettyDate(item.createdAt)}>
                            {relativeTime(item.createdAt)}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <button
                          onClick={() => openUploadModal(item)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                          <UploadCloud className="w-4 h-4" />
                          Upload Task
                        </button>
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Show</span>
                  <select
                    className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                  >
                    {[25, 50, 100, 150, 200].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span>per page</span>
                </div>
                <div className="text-sm text-gray-600 hidden sm:block">
                  Showing <span className="font-medium">{from}</span>–
                  <span className="font-medium">{to}</span> of
                  <span className="font-medium"> {total.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600 sm:hidden">
                  Page <span className="font-medium">{page}</span> of
                  <span className="font-medium"> {pageCount}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasNext || loading}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-xs text-gray-500 bg-white rounded-xl p-4 border border-gray-200">
          <p>
            <strong>Tip:</strong> Platform accepts aliases (yt, ig, tt). Handle accepts with or without
            @ symbol. Use advanced filters for more precise results.
          </p>
        </div>
      </div>

      {/* Upload Task Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeUploadModal}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold">
                {bulkMode ? `Upload Tasks (${selected.size} selected)` : 'Upload Task'}
              </h3>
              <button
                onClick={closeUploadModal}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 pt-4 pb-2">
              {!bulkMode && modalItem && (
                <div className="mb-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(modalItem.platform)}
                    <span className="font-medium text-gray-900">{modalItem.handle}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${getPlatformColor(modalItem.platform)}`}>
                      {platformLabel(modalItem.platform)}
                    </span>
                  </div>
                </div>
              )}
              {bulkMode && (
                <div className="mb-4 text-xs text-gray-600">
                  <p className="mb-1">This will create one Email Task per selected row.</p>
                  <p>Each task will use its row's <span className="font-medium">platform</span> and <span className="font-medium">handle</span> as <code>targetUser</code>.</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expire time (hours)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={expireHours}
                    onChange={(e) => setExpireHours(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 24"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount per person
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 10.00"
                  />
                </div>
              </div>

              {submitError && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {submitError}
                </div>
              )}
              {submitSuccess && (
                <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
                  {submitSuccess}
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-2 pb-4">
                <button
                  onClick={closeUploadModal}
                  className="px-4 py-2 text-sm font-medium rounded-lg border bg-white hover:bg-gray-50"
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={onSubmitUpload}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  disabled={submitLoading}
                >
                  {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  {submitLoading ? (bulkMode ? "Uploading..." : "Uploading...") : (bulkMode ? "Upload Tasks" : "Upload Task")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
      {children}
    </th>
  );
}

function Td({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`px-6 py-3 whitespace-nowrap ${mono ? "font-mono text-sm" : "text-sm"}`}>
      {children}
    </td>
  );
}

function AppliedChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full border bg-white">
      {label}
      <button
        onClick={onClear}
        className="p-0.5 rounded hover:bg-gray-100"
        aria-label={`Clear ${label}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

function SkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`sk-${i}`}>
          <td className="px-6 py-3">
            <div className="h-4 w-4 bg-gray-200/70 rounded animate-pulse" />
          </td>
          <td className="px-6 py-3">
            <div className="h-4 w-40 bg-gray-200/70 rounded animate-pulse" />
          </td>
          <td className="px-6 py-3">
            <div className="h-5 w-24 bg-gray-200/70 rounded-full animate-pulse" />
          </td>
          <td className="px-6 py-3">
            <div className="h-4 w-28 bg-gray-200/70 rounded animate-pulse" />
          </td>
          <td className="px-6 py-3">
            <div className="h-8 w-28 bg-gray-200/70 rounded-lg animate-pulse" />
          </td>
        </tr>
      ))}
    </>
  );
}
