"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  verificationReason?: string;
}

interface EntryItem {
  _id: string;
  taskId: string;
  userId: string;
  status?: number | null;
  amount?: number;
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
  totalEntries?: number;
  entries?: EntryItem[];
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
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchEntries = async () => {
    if (!linkId) return;

    setLoading(true);
    setError("");

    try {
      const res = await api.post<LikeLinkResponse>(
        "/like-task/view-entries",
        { linkId },
        { withCredentials: true }
      );

      const likeLinkData = res.data?.likeLink || null;
      const entryRows = Array.isArray(res.data?.entries) ? res.data.entries : [];

      setLikeLink(likeLinkData);
      setEntries(entryRows);

      const initialOpen: Record<string, boolean> = {};
      entryRows.forEach((entry) => {
        initialOpen[entry._id] = openRows[entry._id] ?? false;
      });
      setOpenRows(initialOpen);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to load entries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const nameA = (a.user?.name || a.user?.email || a.userId || "").toLowerCase();
      const nameB = (b.user?.name || b.user?.email || b.userId || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [entries]);

  const totals = useMemo(() => {
    return sortedEntries.reduce(
      (acc, entry) => {
        acc.users += 1;
        acc.completed += Number(entry.completedCount || 0);
        acc.pending += Number(entry.pendingCount || 0);
        acc.totalEmails += Array.isArray(entry.emailSlots) ? entry.emailSlots.length : 0;
        return acc;
      },
      { users: 0, completed: 0, pending: 0, totalEmails: 0 }
    );
  }, [sortedEntries]);

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

      await fetchEntries();
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

  const targetCount = Number(likeLink?.target || 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {likeLink?.title || "Like Link Entries"}
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
            <span>Users: {totals.users}</span>
            <span>Completed: {totals.completed}</span>
            <span>Pending: {totals.pending}</span>
            <span>Total Auth Emails: {totals.totalEmails}</span>
          </div>
        </div>

        <Button variant="outline" onClick={() => router.push("/employee/dashboard")}>
          ← Back
        </Button>
      </div>

      {sortedEntries.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            No entries found for this like link.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedEntries.map((entry) => {
            const isOpen = !!openRows[entry._id];
            const displayName =
              entry.user?.name || entry.user?.email || entry.userId || "Unknown User";

            const targetReached = targetCount > 0 && entry.completedCount >= targetCount;
            const finalStatusSet = entry.status === 1 || entry.status === 0;
            const actionDisabled = !targetReached || finalStatusSet || actionLoadingId === entry.taskId;

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
                        <p className="font-semibold text-base break-words">{displayName}</p>
                        <p className="text-sm text-gray-600 break-all">
                          {entry.user?.email || entry.userId}
                        </p>

                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                          <span>
                            Completed: {entry.completedCount}/{targetCount || 0}
                          </span>
                          <span>Pending: {entry.pendingCount}</span>
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
                        <Badge variant="destructive" className="bg-red-600 text-white inline-flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" />
                          Rejected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-400 text-black border-yellow-500 inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          Pending
                        </Badge>
                      )}

                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "-"}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t bg-gray-50 px-5 py-4 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-sm">
                          {finalStatusSet ? (
                            <span className="text-gray-600">
                              This task is already {entry.status === 1 ? "approved" : "rejected"}.
                            </span>
                          ) : targetReached ? (
                            <span className="text-green-700 font-medium">
                              Target reached. You can now approve or reject this task.
                            </span>
                          ) : (
                            <span className="text-amber-700 font-medium">
                              Approve/Reject will unlock only after completed count reaches {targetCount}.
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
                            {actionLoadingId === entry.taskId ? "Updating..." : "Approve"}
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={actionDisabled}
                            onClick={() => handleApprove(entry.taskId, 0)}
                          >
                            {actionLoadingId === entry.taskId ? "Updating..." : "Reject"}
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
                                  {slot.authAt ? new Date(slot.authAt).toLocaleString() : "-"}
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
                                  className={`rounded-lg px-3 py-2 ${
                                    slot.verified
                                      ? "bg-green-50 text-green-700 border border-green-200"
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
                        <div className="text-sm text-gray-500">No authenticated emails found.</div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}