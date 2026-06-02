"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  XCircle,
} from "lucide-react";
import Swal from "sweetalert2";

interface EmailSlot {
  email: string;
  googleSub: string;
  authAt: string;
  authExpiresAt: string;
  submittedAt?: string;
  verified: boolean;

  verificationState?: "pending" | "verified" | "failed" | string;
  verificationReason?: string;
  verificationMessage?: string;
  verifiedBy?: string;
  videoId?: string;
  youtubeRating?: "like" | "dislike" | "none" | "unspecified" | "" | string;
}

interface EntryItem {
  _id: string;
  taskId: string;
  userId: string;
  status?: number | null;
  amount?: number;
  maxEmailsAllowed?: number;
  user?: {
    userId: string;
    name?: string;
    email?: string;
    phone?: string;
  } | null;
  completedCount: number;
  pendingCount: number;
  emailSlots: EmailSlot[];
  createdAt: string;
  updatedAt?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalEntries: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface LikeLinkResponse {
  likeLink?: {
    _id: string;
    title?: string;
    videoUrl?: string;
    target?: number;
    amount?: number;
    expireIn?: number;
    requireLike?: boolean;
    createdAt?: string;
  } | null;
  pagination?: PaginationInfo;
  entries?: EntryItem[];
}

interface LikeLinkItem {
  _id: string;
  title: string;
  videoUrl?: string;
  target?: number;
  amount?: number;
  createdAt?: string;
  expireAt?: string;
  status?: "active" | "expired";
}

export default function EmployeeLikeLinkEntriesPage() {
  const params = useSearchParams();
  const router = useRouter();

  const linkId = params.get("id");

  const employeeId =
    (typeof window !== "undefined" && localStorage.getItem("employeeId")) || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [likeLink, setLikeLink] = useState<LikeLinkResponse["likeLink"]>(null);
  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    totalEntries: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [likeLinks, setLikeLinks] = useState<LikeLinkItem[]>([]);
  const [loadingLikeLinks, setLoadingLikeLinks] = useState(false);

  const fetchLikeLinks = useCallback(async () => {
    if (!employeeId) return;

    try {
      setLoadingLikeLinks(true);

      const res = await api.get<LikeLinkItem[]>("/employee/likelinks", {
        withCredentials: true,
      });

      setLikeLinks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load like task videos", err);
    } finally {
      setLoadingLikeLinks(false);
    }
  }, [employeeId]);

  const fetchEntries = useCallback(
    async (pageNumber = pagination.page, pageLimit = pagination.limit) => {
      if (!linkId) return;

      if (!employeeId) {
        setLoading(false);
        setError("Employee ID not found. Please login again.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await api.post<LikeLinkResponse>(
          "/like-task/employee-view-entries",
          {
            linkId,
            employeeId,
            page: pageNumber,
            limit: pageLimit,
          },
          { withCredentials: true }
        );

        const likeLinkData = res.data?.likeLink || null;
        const entryRows = Array.isArray(res.data?.entries) ? res.data.entries : [];

        setLikeLink(likeLinkData);
        setEntries(entryRows);

        setPagination(
          res.data?.pagination || {
            page: pageNumber,
            limit: pageLimit,
            totalEntries: entryRows.length,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: pageNumber > 1,
          }
        );

        const initialOpen: Record<string, boolean> = {};
        entryRows.forEach((entry) => {
          initialOpen[entry._id] = openRows[entry._id] ?? false;
        });
        setOpenRows(initialOpen);
      } catch (err: any) {
        setError(
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to load entries."
        );
      } finally {
        setLoading(false);
      }
    },
    [linkId, employeeId, pagination.page, pagination.limit, openRows]
  );

  useEffect(() => {
    fetchLikeLinks();
    fetchEntries(1, pagination.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId, employeeId]);

  const isFailedSlot = (slot: EmailSlot) => {
    return (
      slot.verificationState === "failed" ||
      slot.verificationMessage === "Like not detected" ||
      (
        Boolean(slot.submittedAt) &&
        slot.verified !== true &&
        String(slot.youtubeRating || "").toLowerCase() === "none"
      )
    );
  };

  const getEntryTarget = (entry?: EntryItem) => {
    const entryLimit = Number(entry?.maxEmailsAllowed || 0);
    const linkTarget = Number(likeLink?.target || 0);

    if (entryLimit > 0) return entryLimit;
    if (linkTarget > 0) return linkTarget;

    return 0;
  };

  const getEntryReportStatus = (entry: EntryItem) => {
    const target = getEntryTarget(entry);
    const completed = Number(entry.completedCount || 0);
    const failed = Array.isArray(entry.emailSlots)
      ? entry.emailSlots.filter(isFailedSlot).length
      : 0;

    if (target > 0 && completed >= target) {
      return "Approved";
    }

    if (failed > 0) {
      return "Partial";
    }

    return "Pending";
  };

  const getEntryFailedCount = (entry: EntryItem) => {
    return Array.isArray(entry.emailSlots)
      ? entry.emailSlots.filter(isFailedSlot).length
      : 0;
  };

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        const reportStatus = getEntryReportStatus(entry);

        acc.users += 1;

        if (reportStatus === "Approved") acc.approvedUsers += 1;
        else if (reportStatus === "Partial") acc.partialUsers += 1;
        else acc.pendingUsers += 1;

        acc.completed += Number(entry.completedCount || 0);
        acc.failed += getEntryFailedCount(entry);

        acc.totalEmails += Array.isArray(entry.emailSlots)
          ? entry.emailSlots.length
          : 0;

        return acc;
      },
      {
        users: 0,
        approvedUsers: 0,
        pendingUsers: 0,
        partialUsers: 0,
        completed: 0,
        failed: 0,
        totalEmails: 0,
      }
    );
  }, [entries]);

  const targetCount = Number(likeLink?.target || 0);

  const selectedVideoFromList = useMemo(() => {
    return likeLinks.find((item) => item._id === linkId) || null;
  }, [likeLinks, linkId]);

  const handleVideoChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLinkId = event.target.value;

    if (!nextLinkId || nextLinkId === linkId) return;

    router.push(`/employee/view-link?id=${nextLinkId}`);
  };

  const toggleRow = (id: string) => {
    setOpenRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleApprove = async (taskId: string, approve: number) => {
    try {
      setActionLoadingId(taskId);

      await api.post(
        "/entry/updateLikeTaskStatus",
        { taskId, approve, employeeId },
        { withCredentials: true }
      );

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Status updated",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });

      await fetchEntries(pagination.page, pagination.limit);
    } catch (err: any) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Update failed",
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1) return;
    if (pagination.totalPages > 0 && newPage > pagination.totalPages) return;

    await fetchEntries(newPage, pagination.limit);
  };

  const handleLimitChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLimit = Number(event.target.value || 10);
    await fetchEntries(1, newLimit);
  };

  if (!linkId) {
    return <p className="p-6 text-center text-red-500">Missing link id.</p>;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return <p className="p-6 text-center text-red-500">{error}</p>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {likeLink?.title || selectedVideoFromList?.title || "Like Task Video Entries"}
          </h1>

          {likeLink?.videoUrl ? (
            <a
              href={likeLink.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline break-all inline-flex items-center gap-1"
            >
              Open Video
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}

          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
            <span>Target: {targetCount}</span>
            <span>Total Entries: {pagination.totalEntries}</span>
            <span>This Page Users: {totals.users}</span>
            <span>Approved Users: {totals.approvedUsers}</span>
            <span>Pending Users: {totals.pendingUsers}</span>
            <span>Partial Users: {totals.partialUsers}</span>
            <span>Verified Likes: {totals.completed}</span>
            <span>Failed Likes: {totals.failed}</span>
            <span>Total Auth Emails: {totals.totalEmails}</span>
          </div>
        </div>

        <Button variant="outline" onClick={() => router.push("/employee/dashboard")}>
          ← Back
        </Button>
      </div>

      <Card className="border bg-white">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Video-wise Like Task Entries</p>
              <p className="text-xs text-gray-500">
                Select any Like Task video to view its users and verification details.
              </p>
            </div>

            <div className="w-full lg:w-[360px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Select Video
              </label>

              <select
                value={linkId || ""}
                onChange={handleVideoChange}
                disabled={loadingLikeLinks}
                className="w-full h-10 rounded-md border bg-white px-3 py-2 text-sm"
              >
                <option value="">
                  {loadingLikeLinks ? "Loading videos..." : "Select video"}
                </option>

                {likeLinks.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Selected Video</p>
              <p className="text-sm font-medium truncate">
                {likeLink?.title || selectedVideoFromList?.title || "-"}
              </p>
            </div>

            <div className="rounded-lg border bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Target</p>
              <p className="text-sm font-medium">{targetCount}</p>
            </div>

            <div className="rounded-lg border bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Amount</p>
              <p className="text-sm font-medium">
                {typeof likeLink?.amount === "number" ? `₹${likeLink.amount}` : "-"}
              </p>
            </div>

            <div className="rounded-lg border bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Created</p>
              <p className="text-sm font-medium">
                {likeLink?.createdAt
                  ? new Date(likeLink.createdAt).toLocaleDateString()
                  : "-"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-xl px-4 py-3 bg-white">
        <div className="text-sm text-gray-600">
          Page {pagination.page} of {pagination.totalPages || 1}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={pagination.limit}
            onChange={handleLimitChange}
            className="border rounded-md px-2 py-1 text-sm bg-white"
          >
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>

          <Button
            size="sm"
            variant="outline"
            disabled={!pagination.hasPrevPage}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            Prev
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={!pagination.hasNextPage}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            No entries found for this like link under this employee.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const isOpen = !!openRows[entry._id];
            const reportStatus = getEntryReportStatus(entry);
            const failedCount = getEntryFailedCount(entry);
            const displayName =
              entry.user?.name ||
              entry.user?.email ||
              entry.userId ||
              "Unknown User";

            const entryTarget = getEntryTarget(entry);

            const targetReached =
              entryTarget > 0 && Number(entry.completedCount || 0) >= entryTarget;

            const finalStatusSet = entry.status === 1 || entry.status === 0;

            const actionDisabled =
              !targetReached ||
              finalStatusSet ||
              actionLoadingId === entry.taskId;

            return (
              <Card key={entry._id} className="overflow-hidden">
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() => toggleRow(entry._id)}
                    className="w-full text-left px-5 py-4 hover:bg-gray-50 transition flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="pt-0.5 shrink-0">
                        {isOpen ? (
                          <ChevronDown className="h-5 w-5 text-gray-600" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-600" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-base break-words">
                          {displayName}
                        </p>

                        <p className="text-sm text-gray-600 break-all">
                          {entry.user?.email || entry.userId}
                        </p>

                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                          <span>
                            Verified: {entry.completedCount}/{entryTarget}
                          </span>

                          <span>Failed: {failedCount}</span>

                          <span>Status: {reportStatus}</span>

                          <span>Emails: {entry.emailSlots?.length || 0}</span>

                          {typeof entry.amount === "number" ? (
                            <span>Amount: ₹{entry.amount}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0 pt-1">
                      {entry.status === 1 ? (
                        <Badge className="bg-green-600 text-white inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approved
                        </Badge>
                      ) : entry.status === 0 ? (
                        <Badge
                          variant="destructive"
                          className="bg-red-600 text-white inline-flex items-center gap-1"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Rejected
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-yellow-400 text-black border-yellow-500 inline-flex items-center gap-1"
                        >
                          <Clock3 className="h-3.5 w-3.5" />
                          Pending
                        </Badge>
                      )}

                      {reportStatus === "Approved" ? (
                        <Badge className="bg-green-600 text-white">Like: Approved</Badge>
                      ) : reportStatus === "Partial" ? (
                        <Badge className="bg-amber-500 text-white">Like: Partial</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-white">
                          Like: Pending
                        </Badge>
                      )}
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {entry.createdAt
                          ? new Date(entry.createdAt).toLocaleString()
                          : "-"}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t bg-gray-50 px-5 py-4 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-sm">
                          {finalStatusSet ? (
                            <span className="text-gray-600">
                              This task is already{" "}
                              {entry.status === 1 ? "approved" : "rejected"}.
                            </span>
                          ) : reportStatus === "Approved" ? (
                            <span className="text-green-700 font-medium">
                              All required likes are verified. You can now approve or reject this task.
                            </span>
                          ) : reportStatus === "Partial" ? (
                            <span className="text-red-700 font-medium">
                              Some likes failed verification. This user is Partial and does not count as active.
                            </span>
                          ) : (
                            <span className="text-amber-700 font-medium">
                              Verification is still pending. Approve/Reject will unlock only after verified count reaches{" "}
                              {entryTarget}.
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            disabled={actionDisabled}
                            onClick={() => handleApprove(entry.taskId, 1)}
                          >
                            {actionLoadingId === entry.taskId
                              ? "Updating..."
                              : "Approve"}
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={actionDisabled}
                            onClick={() => handleApprove(entry.taskId, 0)}
                          >
                            {actionLoadingId === entry.taskId
                              ? "Updating..."
                              : "Reject"}
                          </Button>
                        </div>
                      </div>

                      {entry.emailSlots?.length ? (
                        entry.emailSlots.map((slot, idx) => (
                          <div
                            key={`${slot.email}-${idx}`}
                            className="bg-white border rounded-xl p-4 space-y-3"
                          >
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium break-all">{slot.email}</p>

                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {slot.verified ? (
                                    <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                                      <CheckCircle2 className="h-4 w-4" />
                                      Verified
                                    </span>
                                  ) : isFailedSlot(slot) ? (
                                    <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                                      <XCircle className="h-4 w-4" />
                                      Failed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-amber-600 text-sm">
                                      <Clock3 className="h-4 w-4" />
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="text-sm text-gray-600 space-y-1 md:text-right">
                                <p>
                                  Auth:{" "}
                                  {slot.authAt
                                    ? new Date(slot.authAt).toLocaleString()
                                    : "-"}
                                </p>

                                <p>
                                  Expires:{" "}
                                  {slot.authExpiresAt
                                    ? new Date(slot.authExpiresAt).toLocaleString()
                                    : "-"}
                                </p>

                                <p>
                                  Submitted:{" "}
                                  {slot.submittedAt
                                    ? new Date(slot.submittedAt).toLocaleString()
                                    : "Not submitted"}
                                </p>
                              </div>
                            </div>

                            <div className="text-sm">
                              {slot.verificationReason ? (
                                <div
                                  className={`rounded-lg px-3 py-2 ${slot.verified
                                    ? "bg-green-50 text-green-700 border border-green-200"
                                    : isFailedSlot(slot)
                                      ? "bg-red-50 text-red-700 border border-red-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                    }`}
                                >
                                  {slot.verificationReason}
                                </div>
                              ) : !slot.verified ? (
                                <div className="rounded-lg px-3 py-2 bg-gray-50 text-gray-600 border">
                                  Verification not completed yet.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500">
                          No authenticated emails found.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {entries.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-xl px-4 py-3 bg-white">
          <div className="text-sm text-gray-600">
            Showing page {pagination.page} of {pagination.totalPages || 1} — Total{" "}
            {pagination.totalEntries} entries
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!pagination.hasPrevPage}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              Prev
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={!pagination.hasNextPage}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}