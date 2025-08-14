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
  screenshotId?: string;     // for joining with screenshots
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

interface ScreenshotRow {
  screenshotId: string;
  userId: string;
  linkId?: string;
  verified: boolean;
  analysis?: any;
  createdAt: string;
}

interface ScreenshotsResponse {
  linkId: string;
  linkTitle: string;
  screenshots: ScreenshotRow[];
  totalScreenshots: number;
  page: number;
  pages: number;
  entries: UserEntry[]; // merged entries in same payload
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

/* ----------------------- Component ----------------------- */
export default function UserEntriesPage() {
  const params = useSearchParams();
  const router = useRouter();

  const linkId = params.get("linkid");
  const empId = params.get("empid");
  const ssIdParam = params.get("ssId"); // 👈 toggle to screenshots mode if present
  const isScreenshotsMode = useMemo(() => Boolean(ssIdParam), [ssIdParam]);

  const [title, setTitle] = useState("");

  // Entries state (for non-ss mode)
  const [entries, setEntries] = useState<UserEntry[]>([]);
  const [totals, setTotals] = useState({
    totalUsers: 0,
    totalPersons: 0,
    totalAmountPaid: 0,
  });

  // Screenshots state (ss mode)
  const [shots, setShots] = useState<ScreenshotRow[]>([]);
  const [shotsPage, setShotsPage] = useState(1);
  const [shotsPages, setShotsPages] = useState(1);
  const [shotsTotal, setShotsTotal] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState<null | boolean>(null); // filter: null=all, true, false
  const [ssEntries, setSsEntries] = useState<UserEntry[]>([]); // entries coming from /admin/ssLink

  // Shared loading & error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Analysis modal
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [analysisForId, setAnalysisForId] = useState<string>("");

  // Map screenshotId -> entry (for amounts/status)
  const entryByShotId = useMemo(() => {
    const map: Record<string, UserEntry> = {};
    for (const e of ssEntries) {
      if (e.screenshotId) map[e.screenshotId] = e;
    }
    return map;
  }, [ssEntries]);

  // Total Paid in screenshots mode (derive from ssEntries)
  const ssTotalPaid = useMemo(
    () =>
      ssEntries.reduce((sum, e) => sum + (typeof e.totalAmount === "number" ? e.totalAmount : 0), 0),
    [ssEntries]
  );

  useEffect(() => {
    if (!linkId || !empId) return;

    setLoading(true);
    setError("");

    if (isScreenshotsMode) {
      // ---------------------- Screenshots API (merged) ----------------------
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
        .post<ScreenshotsResponse>(SCREENSHOTS_BY_LINK_ENDPOINT, body)
        .then((res) => {
          setTitle(res.data.linkTitle);
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
      // ---------------------- Entries API (existing) ----------------------
      api
        .post<ApiResponse>("/admin/links/user-entries", { linkId, employeeId: empId })
        .then((res) => {
          setTitle(res.data.title);
          setEntries(res.data.entries);
          setTotals(res.data.totals);
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

  const openAnalysis = (s: ScreenshotRow) => {
    setAnalysisForId(s.screenshotId);
    setAnalysisData(s.analysis || null);
    setAnalysisOpen(true);
  };

  const resetAndBack = () => router.back();

  return (
    <div className="p-8 max-w mx-auto space-y-6 bg-gray-50 rounded-lg shadow-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold">
          {isScreenshotsMode ? "Screenshots for:" : "User Entries for:"} {title}
        </h1>
        <div className="flex items-center gap-2">
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
          {/* Summary (now includes Total Paid derived from entries) */}
          <div className="flex flex-wrap gap-6 bg-white p-4 rounded shadow">
            <div>
              <div className="text-sm text-gray-500">Total Screenshots</div>
              <div className="text-xl font-medium">{shotsTotal}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Paid</div>
              <div className="text-xl font-medium">{formatINR(ssTotalPaid)}</div>
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
                      <TH className="px-4 py-2 text-left">Analysis</TH>
                      <TH className="px-4 py-2 text-right">Submitted</TH>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-white divide-y divide-gray-200">
                    {shots.map((s) => {
                      const linked = entryByShotId[s.screenshotId];
                      const userLabel = linked?.user?.name || linked?.name || s.userId || "—";
                      const submittedAt = linked?.createdAt || s.createdAt;

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
                              <Badge variant="outline" className="bg-yellow-400">No</Badge>
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
                              <Badge className="bg-green-600">Approved</Badge>
                            ) : linked?.status === 0 ? (
                              <Badge variant="destructive" className="bg-red-600">Rejected</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-400">Pending</Badge>
                            )}
                          </TableCell>

                          <TableCell className="px-4 py-3">
                            {s.analysis ? (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <span className="mr-2">
                                  Liked: <b>{s.analysis.liked ? "Yes" : "No"}</b>
                                </span>
                                <span className="mr-2">
                                  Verified: <b>{s.analysis.verified ? "Yes" : "No"}</b>
                                </span>
                                <span className="mr-2">
                                  Comments:{" "}
                                  <b>
                                    {Array.isArray(s.analysis.comment) ? s.analysis.comment.length : 0}
                                  </b>
                                </span>
                                <span className="mr-2">
                                  Replies:{" "}
                                  <b>
                                    {Array.isArray(s.analysis.replies) ? s.analysis.replies.length : 0}
                                  </b>
                                </span>
                                <Button size="sm" variant="outline" onClick={() => openAnalysis(s)}>
                                  View JSON
                                </Button>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
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

          {/* Analysis JSON Modal (simple) */}
          {analysisOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
              onClick={() => setAnalysisOpen(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-lg max-w-2xl w-full p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">Analysis — {shortId(analysisForId, 8, 6)}</h2>
                  <Button size="sm" variant="outline" onClick={() => setAnalysisOpen(false)}>
                    Close
                  </Button>
                </div>
                <pre className="mt-2 bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
                  {analysisData ? JSON.stringify(analysisData, null, 2) : "—"}
                </pre>
              </div>
            </div>
          )}
        </>
      ) : (
        /* --------------------------- ENTRIES UI (original) --------------------------- */
        <>
          {/* Totals Bar */}
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

          {/* Entries Table */}
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
                        {e.telegramLink ? (
                          <a
                            href={e.telegramLink}
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
                          <Badge variant="default" className="bg-green-600">
                            Approved
                          </Badge>
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
