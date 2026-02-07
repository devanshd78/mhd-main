"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { format } from "date-fns";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead as TH,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";

// Uses your merged payload (linkTitle, screenshots, entries)
const SCREENSHOTS_BY_LINK_ENDPOINT = "/admin/byLinkAndEmployee";

/* ----------------------- Types ----------------------- */
interface UserEntry {
  _id: string;
  entryId?: string;
  linkId: string;
  name: string;
  upiId: string;
  noOfPersons?: number;
  linkAmount?: number;
  totalAmount?: number;
  telegramLink?: string;
  status?: number | null;
  createdAt: string;
  screenshotId?: string; // join key
  linkTitle?: string;
  user?: {
    userId: string;
    name: string;
    email: string;
    phone: number;
    upiId: string;
  } | null;
}

interface ApiResponse {
  title: string;
  entries: UserEntry[];
  totals: {
    totalUsers: number;
    totalPersons: number;
    totalAmountPaid: number;
  };
}

type ActionKind = "comment" | "reply";

interface ScreenshotAction {
  kind: ActionKind;
  videoId: string;
  commentId: string;
  parentId: string | null;
  permalink: string;
  text: string | null;
  authorChannelId: string | null;
  publishedAt: string | null;
}

interface ScreenshotRow {
  screenshotId: string;
  userId: string;
  linkId: string;
  verified: boolean;
  videoId: string;
  channelId: string;
  createdAt: string;
  actions: ScreenshotAction[];
}

interface ScreenshotsResponse {
  linkId: string;
  linkTitle: string;
  screenshots: ScreenshotRow[];
  totalScreenshots: number;
  page: number;
  pages: number;
  entries: UserEntry[];
  totalEntries: number;
}

/* ----------------------- Helpers ----------------------- */
function shortId(id?: string, head = 6, tail = 4) {
  if (!id) return "—";
  if (id.length <= head + tail) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

function formatINR(n?: number | null) {
  if (n == null) return "—";
  return `₹${n}`;
}

function safeUrl(url?: string | null) {
  if (!url) return null;
  const u = String(url).trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return null;
}

function splitActions(actions: ScreenshotAction[] = []) {
  const comments = actions.filter((a) => a.kind === "comment");
  const replies = actions.filter((a) => a.kind === "reply");
  return { comments, replies };
}

/* ----------------------- Component ----------------------- */
export default function UserEntriesPage() {
  const params = useSearchParams();
  const router = useRouter();

  const linkId = params.get("linkid");
  const empId = params.get("empid");
  const ssIdParam = params.get("ssId"); // if present => screenshots mode
  const isScreenshotsMode = useMemo(() => Boolean(ssIdParam), [ssIdParam]);

  const [title, setTitle] = useState("");

  // Entries state (non-screenshots mode)
  const [entries, setEntries] = useState<UserEntry[]>([]);
  const [totals, setTotals] = useState({
    totalUsers: 0,
    totalPersons: 0,
    totalAmountPaid: 0,
  });

  // Screenshots state (screenshots mode)
  const [shots, setShots] = useState<ScreenshotRow[]>([]);
  const [shotsPage, setShotsPage] = useState(1);
  const [shotsPages, setShotsPages] = useState(1);
  const [shotsTotal, setShotsTotal] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState<null | boolean>(null);
  const [ssEntries, setSsEntries] = useState<UserEntry[]>([]);

  // Shared loading & error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Details modal (comments & replies only)
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsShot, setDetailsShot] = useState<ScreenshotRow | null>(null);

  // Map screenshotId -> entry (for amount/status/user label)
  const entryByShotId = useMemo(() => {
    const map: Record<string, UserEntry> = {};
    for (const e of ssEntries) {
      if (e.screenshotId) map[e.screenshotId] = e;
    }
    return map;
  }, [ssEntries]);

  // Total Paid in screenshots mode (derive from ssEntries)
  const ssTotalPaid = useMemo(() => {
    return ssEntries.reduce(
      (sum, e) => sum + (typeof e.totalAmount === "number" ? e.totalAmount : 0),
      0
    );
  }, [ssEntries]);

  const ssTotals = useMemo(() => {
    let comments = 0;
    let replies = 0;
    for (const s of shots) {
      const sp = splitActions(s.actions || []);
      comments += sp.comments.length;
      replies += sp.replies.length;
    }
    return { comments, replies };
  }, [shots]);

  // Reset page when filter changes
  useEffect(() => {
    if (isScreenshotsMode) setShotsPage(1);
  }, [verifiedOnly, isScreenshotsMode]);

  useEffect(() => {
    if (!linkId || !empId) return;

    setLoading(true);
    setError("");

    if (isScreenshotsMode) {
      const body: any = {
        linkId,
        employeeId: empId,
        page: shotsPage,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      };
      if (typeof verifiedOnly === "boolean") body.verified = verifiedOnly;

      api
        .post<ScreenshotsResponse>(SCREENSHOTS_BY_LINK_ENDPOINT, body, {
          withCredentials: true,
        })
        .then((res) => {
          setTitle(res.data.linkTitle || "");
          setShots(res.data.screenshots || []);
          setShotsPage(res.data.page);
          setShotsPages(res.data.pages);
          setShotsTotal(res.data.totalScreenshots || 0);
          setSsEntries(res.data.entries || []);
        })
        .catch((err) => {
          setError(err?.response?.data?.error || "Failed to load screenshots.");
        })
        .finally(() => setLoading(false));
    } else {
      api
        .post<ApiResponse>(
          "/admin/links/user-entries",
          { linkId, employeeId: empId },
          { withCredentials: true }
        )
        .then((res) => {
          setTitle(res.data.title || "");
          setEntries(res.data.entries || []);
          setTotals(res.data.totals || { totalUsers: 0, totalPersons: 0, totalAmountPaid: 0 });
        })
        .catch((err) => {
          setError(err.response?.data?.error || "Failed to load user entries.");
        })
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId, empId, isScreenshotsMode, shotsPage, verifiedOnly]);

  if (!linkId || !empId) {
    return <p className="p-8 text-center text-red-600">Missing link or employee ID.</p>;
  }

  const openDetails = (s: ScreenshotRow) => {
    setDetailsShot(s);
    setDetailsOpen(true);
  };

  const resetAndBack = () => router.back();

  const linkUrl = safeUrl(title);

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-6 bg-gray-50 rounded-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {isScreenshotsMode ? "Screenshots for:" : "User Entries for:"}{" "}
            {linkUrl ? (
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:underline break-all"
              >
                {title}
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <span className="break-all">{title}</span>
            )}
          </h1>
          {isScreenshotsMode && (
            <p className="text-xs text-gray-500">
              Showing only <b>comments & replies</b> from screenshot actions.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isScreenshotsMode && (
            <>
              <Button
                variant={verifiedOnly === true ? "default" : "outline"}
                onClick={() => setVerifiedOnly(verifiedOnly === true ? null : true)}
                size="sm"
              >
                {verifiedOnly === true ? "Showing Verified" : "Verified"}
              </Button>
              <Button
                variant={verifiedOnly === false ? "default" : "outline"}
                onClick={() => setVerifiedOnly(verifiedOnly === false ? null : false)}
                size="sm"
              >
                {verifiedOnly === false ? "Showing Unverified" : "Unverified"}
              </Button>
            </>
          )}
          <Button variant="outline" onClick={resetAndBack}>
            ← Back
          </Button>
        </div>
      </div>

      {/* Loading / Error */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : error ? (
        <p className="text-red-500 text-center">{error}</p>
      ) : isScreenshotsMode ? (
        /* --------------------------- SCREENSHOTS UI --------------------------- */
        <>
          {/* Summary */}
          <div className="flex flex-wrap gap-6 bg-white p-4 rounded shadow">
            <div>
              <div className="text-sm text-gray-500">Total Screenshots</div>
              <div className="text-xl font-medium">{shotsTotal}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Paid</div>
              <div className="text-xl font-medium">{formatINR(ssTotalPaid)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Comments</div>
              <div className="text-xl font-medium">{ssTotals.comments}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Replies</div>
              <div className="text-xl font-medium">{ssTotals.replies}</div>
            </div>
            {typeof verifiedOnly === "boolean" && (
              <div>
                <div className="text-sm text-gray-500">Filter</div>
                <div className="text-xl font-medium">{verifiedOnly ? "Verified" : "Unverified"}</div>
              </div>
            )}
          </div>

          {/* Table */}
          <Card className="overflow-auto">
            <CardContent className="p-0">
              {shots.length === 0 ? (
                <p className="text-center text-gray-500 py-6">No screenshots found.</p>
              ) : (
                <Table className="min-w-full divide-y divide-gray-200">
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TH className="px-4 py-2 text-left">Screenshot</TH>
                      <TH className="px-4 py-2 text-left">User</TH>
                      <TH className="px-4 py-2 text-center">Verified</TH>
                      <TH className="px-4 py-2 text-right">Amt/Person</TH>
                      <TH className="px-4 py-2 text-right">Total Paid</TH>
                      <TH className="px-4 py-2 text-center">Status</TH>
                      <TH className="px-4 py-2 text-center">Comments</TH>
                      <TH className="px-4 py-2 text-center">Replies</TH>
                      <TH className="px-4 py-2 text-left">Details</TH>
                      <TH className="px-4 py-2 text-right">Submitted</TH>
                    </TableRow>
                  </TableHeader>

                  <TableBody className="bg-white divide-y divide-gray-200">
                    {shots.map((s) => {
                      const linked = entryByShotId[s.screenshotId];
                      const userLabel =
                        linked?.user?.name || linked?.name || s.userId || "—";
                      const submittedAt = linked?.createdAt || s.createdAt;

                      const { comments, replies } = splitActions(s.actions || []);

                      return (
                        <TableRow key={s.screenshotId} className="hover:bg-gray-50">
                          <TableCell className="px-4 py-3 font-mono">
                            {shortId(s.screenshotId, 8, 6)}
                          </TableCell>

                          <TableCell className="px-4 py-3">{userLabel}</TableCell>

                          <TableCell className="px-4 py-3 text-center">
                            {s.verified ? (
                              <Badge className="bg-green-600 text-white">Yes</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-400">
                                No
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="px-4 py-3 text-right">
                            {formatINR(linked?.linkAmount)}
                          </TableCell>

                          <TableCell className="px-4 py-3 text-right">
                            {formatINR(linked?.totalAmount)}
                          </TableCell>

                          <TableCell className="px-4 py-3 text-center">
                            {linked?.status === 1 ? (
                              <Badge className="bg-green-600 text-white">Approved</Badge>
                            ) : linked?.status === 0 ? (
                              <Badge variant="destructive" className="bg-red-600">
                                Rejected
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-400">
                                Pending
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="px-4 py-3 text-center">
                            <b>{comments.length}</b>
                          </TableCell>

                          <TableCell className="px-4 py-3 text-center">
                            <b>{replies.length}</b>
                          </TableCell>

                          <TableCell className="px-4 py-3">
                            <Button size="sm" variant="outline" onClick={() => openDetails(s)}>
                              View
                            </Button>
                          </TableCell>

                          <TableCell className="px-4 py-3 text-right whitespace-nowrap">
                            {submittedAt ? format(new Date(submittedAt), "PPpp") : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Pager */}
          {shotsPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-3">
              <Button
                size="sm"
                variant="outline"
                disabled={shotsPage === 1}
                onClick={() => setShotsPage((p) => p - 1)}
              >
                Prev
              </Button>
              <span className="text-sm">
                Page {shotsPage} / {shotsPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={shotsPage === shotsPages}
                onClick={() => setShotsPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}

          {/* Details Modal (ONLY Comments & Replies) */}
          {detailsOpen && detailsShot && (
            <div
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
              onClick={() => setDetailsOpen(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-lg max-w-3xl w-full p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Actions — {shortId(detailsShot.screenshotId, 8, 6)}
                    </h2>
                    <p className="text-xs text-gray-500 break-all">
                      Video: {detailsShot.videoId} • Channel: {detailsShot.channelId}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setDetailsOpen(false)}>
                    Close
                  </Button>
                </div>

                {(() => {
                  const { comments, replies } = splitActions(detailsShot.actions || []);
                  return (
                    <>
                      <div className="mt-4 flex flex-wrap gap-3">
                        {detailsShot.verified ? (
                          <Badge className="bg-green-600 text-white">Verified</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-400">
                            Not verified
                          </Badge>
                        )}
                        <span className="text-sm text-gray-700">
                          Comments: <b>{comments.length}</b>
                        </span>
                        <span className="text-sm text-gray-700">
                          Replies: <b>{replies.length}</b>
                        </span>
                      </div>

                      <div className="mt-4 space-y-5 max-h-[60vh] overflow-y-auto pr-1">
                        {/* Comments */}
                        <div>
                          <div className="text-sm font-semibold">Comments</div>
                          {comments.length ? (
                            <ul className="mt-2 space-y-2">
                              {comments.map((c, i) => (
                                <li key={`${c.commentId}-${i}`} className="border rounded-lg p-3 bg-white">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs text-gray-500">
                                      Comment {i + 1} • ID: {shortId(c.commentId, 10, 6)}
                                    </div>
                                    {safeUrl(c.permalink) && (
                                      <a
                                        href={c.permalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                                      >
                                        Open <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                  <div className="mt-2 text-sm text-gray-800 break-words">
                                    {c.text || "—"}
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    {c.publishedAt
                                      ? format(new Date(c.publishedAt), "PPpp")
                                      : "—"}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">—</p>
                          )}
                        </div>

                        {/* Replies */}
                        <div>
                          <div className="text-sm font-semibold">Replies</div>
                          {replies.length ? (
                            <ul className="mt-2 space-y-2">
                              {replies.map((r, i) => (
                                <li key={`${r.commentId}-${i}`} className="border rounded-lg p-3 bg-white">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs text-gray-500">
                                      Reply {i + 1} • ID: {shortId(r.commentId, 10, 6)}
                                    </div>
                                    {safeUrl(r.permalink) && (
                                      <a
                                        href={r.permalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                                      >
                                        Open <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    Parent: {r.parentId ? shortId(r.parentId, 10, 6) : "—"}
                                  </div>
                                  <div className="mt-2 text-sm text-gray-800 break-words">
                                    {r.text || "—"}
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    {r.publishedAt
                                      ? format(new Date(r.publishedAt), "PPpp")
                                      : "—"}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-sm text-gray-500">—</p>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </>
      ) : (
        /* --------------------------- ENTRIES UI (original) --------------------------- */
        <>
          <div className="flex flex-wrap gap-4 bg-white p-4 rounded shadow">
            <div>
              <div className="text-sm text-gray-500">Total Users</div>
              <div className="text-xl font-medium">{totals.totalUsers}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Persons</div>
              <div className="text-xl font-medium">{totals.totalPersons}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Paid</div>
              <div className="text-xl font-medium">₹{totals.totalAmountPaid}</div>
            </div>
          </div>

          <Card className="overflow-auto">
            <CardContent className="p-0">
              <Table className="min-w-full divide-y divide-gray-200">
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TH className="px-4 py-2 text-left">User</TH>
                    <TH className="px-4 py-2 text-left">UPI ID</TH>
                    <TH className="px-4 py-2 text-center"># Persons</TH>
                    <TH className="px-4 py-2 text-right">Amt/Person</TH>
                    <TH className="px-4 py-2 text-right">Total</TH>
                    <TH className="px-4 py-2 text-center">Telegram</TH>
                    <TH className="px-4 py-2 text-center">Status</TH>
                    <TH className="px-4 py-2 text-right">Submitted At</TH>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white divide-y divide-gray-200">
                  {entries.map((e) => (
                    <TableRow key={e._id} className="hover:bg-gray-50">
                      <TableCell className="px-4 py-3">{e.user?.name || e.name}</TableCell>
                      <TableCell className="px-4 py-3">{e.upiId}</TableCell>
                      <TableCell className="px-4 py-3 text-center">{e.noOfPersons ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        {e.linkAmount != null ? `₹${e.linkAmount}` : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        {e.totalAmount != null ? `₹${e.totalAmount}` : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {safeUrl(e.telegramLink) ? (
                          <a
                            href={e.telegramLink!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {e.status === 1 ? (
                          <Badge className="bg-green-600 text-white">Approved</Badge>
                        ) : e.status === 0 ? (
                          <Badge variant="destructive" className="bg-red-600">
                            Rejected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-400">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right whitespace-nowrap">
                        {format(new Date(e.createdAt), "PPpp")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
