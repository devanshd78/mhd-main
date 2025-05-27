"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import api from "@/lib/axios";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead as TH,
  TableCell,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface HistoryItem {
  field: string;
  from: number;
  to: number;
  updatedAt: string;
  _id: string;
}

interface Submission {
  _id: string;
  entryId?: string;
  linkId: string;
  employeeId?: string;
  name: string;
  upiId: string;
  notes?: string;
  amount?: number;
  createdAt: string;
  type?: number;
  status?: number;
  noOfPersons?: number;
  linkAmount?: number;
  totalAmount?: number;
  telegramLink?: string;
  history?: HistoryItem[];
  isUpdated?: number;
}

interface ApiResponse {
  title: string;
  entries: Submission[];
}

export default function AdminLinkEntriesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const linkId = params.get("id");

  const [entries, setEntries] = useState<Submission[]>([]);
  const [titleHref, setTitleHref] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showHistory, setShowHistory] = useState(false);
  const [historyEntry, setHistoryEntry] = useState<Submission | null>(null);

  useEffect(() => {
    if (!linkId) return;
    setLoading(true);
    setError("");
    api
      .post<ApiResponse>(
        "/admin/links/entries",
        { linkId },
        { withCredentials: true }
      )
      .then((res) => {
        setTitleHref(res.data.title);
        setEntries(res.data.entries || []);
      })
      .catch((err) =>
        setError(err.response?.data?.error || "Failed to load entries.")
      )
      .finally(() => setLoading(false));
  }, [linkId]);

  if (!linkId) {
    return <p className="text-red-500 text-center p-8">No link selected.</p>;
  }

  const groupEntries = entries.filter((e) => e.type === 1);
  const individualEntries = entries.filter((e) => e.type !== 1);

  const openHistory = (entry: Submission) => {
    if (entry.isUpdated) {
      setHistoryEntry(entry);
      setShowHistory(true);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-bold">
          Entries for Link: {titleHref}
        </h1>
        <Button variant="outline" onClick={() => router.back()}>
          ← Back
        </Button>
      </div>

      {/* Loading / Error */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : error ? (
        <p className="text-red-500 text-center">{error}</p>
      ) : (
        <>
          {/* History Modal */}
          {historyEntry && (
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogPortal>
                <DialogOverlay className="fixed inset-0 bg-black/50" />
                <DialogContent className="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-2xl shadow-lg">
                  <DialogHeader>
                    <DialogTitle>Update History</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {historyEntry.history?.map((item) => (
                      <div key={item._id} className="p-2 border rounded">
                        <div className="text-sm font-medium">{item.field}</div>
                        <div className="text-xs">from {item.from} to {item.to}</div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(item.updatedAt), "PPpp")}
                        </div>
                      </div>
                    ))}
                  </div>
                  <DialogFooter className="flex justify-end mt-4">
                    <Button size="sm" variant="outline" onClick={() => setShowHistory(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </DialogPortal>
            </Dialog>
          )}

          {/* Group Entries Table */}
          {groupEntries.length > 0 && (
            <div className="overflow-x-auto bg-white shadow rounded-lg">
              <h2 className="p-4 text-lg font-semibold">Entries by Users</h2>
              <Table className="min-w-full">
                <TableHeader className="bg-gray-100">
                  <TableRow>
                    <TH className="px-4 py-2 text-left">Name</TH>
                    <TH className="px-4 py-2 text-left">UPI ID</TH>
                    <TH className="px-4 py-2 text-left">Telegram</TH>
                    <TH className="px-4 py-2 text-center"># Persons</TH>
                    <TH className="px-4 py-2 text-right">Amt/Person</TH>
                    <TH className="px-4 py-2 text-right">Total</TH>
                    <TH className="px-4 py-2 text-center">Status</TH>
                    <TH className="px-4 py-2 text-center">Updated</TH>
                    <TH className="px-4 py-2 text-right">Submitted At</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupEntries.map((e) => (
                    <TableRow key={e._id} className="hover:bg-gray-50">
                      <TableCell className="px-4 py-2">{e.name}</TableCell>
                      <TableCell className="px-4 py-2">{e.upiId}</TableCell>
                      <TableCell className="px-4 py-2">
                        {e.telegramLink ? (
                          <a
                            href={
                              e.telegramLink.startsWith("http")
                                ? e.telegramLink
                                : `https://t.me/${e.telegramLink.replace(/^@/, "")}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Open
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-center">{e.noOfPersons}</TableCell>
                      <TableCell className="px-4 py-2 text-right">₹{e.linkAmount}</TableCell>
                      <TableCell className="px-4 py-2 text-right">₹{e.totalAmount}</TableCell>
                      <TableCell className="px-4 py-2 text-center">
                        {e.status === 1 ? (
                          <span className="text-green-600">Approved</span>
                        ) : e.status === 0 ? (
                          <span className="text-red-600">Rejected</span>
                        ) : (
                          <span className="text-yellow-600">Pending</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-center">
                        {e.isUpdated ? (
                          <Button size="sm" variant="outline" onClick={() => openHistory(e)}>
                            View
                          </Button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right whitespace-nowrap">
                        {format(new Date(e.createdAt), "PPpp")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Individual Entries Table */}
          {individualEntries.length > 0 && (
            <div className="overflow-x-auto bg-white shadow rounded-lg">
              <h2 className="p-4 text-lg font-semibold">Entries by Employees</h2>
              <Table className="min-w-full">
                <TableHeader className="bg-gray-100">
                  <TableRow>
                    <TH className="px-4 py-2 text-left">Name</TH>
                    <TH className="px-4 py-2 text-left">UPI ID</TH>
                    <TH className="px-4 py-2 text-right">Amount</TH>
                    <TH className="px-4 py-2 text-left">Notes</TH>
                    <TH className="px-4 py-2 text-center">Updated</TH>
                    <TH className="px-4 py-2 text-right">Submitted At</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {individualEntries.map((e) => (
                    <TableRow key={e._id} className="hover:bg-gray-50">
                      <TableCell className="px-4 py-2">{e.name}</TableCell>
                      <TableCell className="px-4 py-2">{e.upiId}</TableCell>
                      <TableCell className="px-4 py-2 text-right">₹{e.amount}</TableCell>
                      <TableCell className="px-4 py-2 truncate max-w-xs">
                        {e.notes || "—"}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-center">
                        {e.isUpdated ? (
                          <Button size="sm" variant="outline" onClick={() => openHistory(e)}>
                            View
                          </Button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right whitespace-nowrap">
                        {format(new Date(e.createdAt), "PPpp")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}