"use client";

import React, { useEffect, useState } from "react";
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

interface UserEntry {
    _id: string;
    name: string;
    upiId: string;
    noOfPersons?: number;
    linkAmount?: number;
    totalAmount?: number;
    telegramLink?: string;
    status?: number;
    createdAt: string;
    user: {
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

export default function UserEntriesPage() {
    const params = useSearchParams();
    const router = useRouter();
    const linkId = params.get("linkid");
    const empId = params.get("empid");

    const [entries, setEntries] = useState<UserEntry[]>([]);
    const [title, setTitle] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // NEW state for totals
    const [totals, setTotals] = useState<{
        totalUsers: number;
        totalPersons: number;
        totalAmountPaid: number;
    }>({ totalUsers: 0, totalPersons: 0, totalAmountPaid: 0 });

    useEffect(() => {
        if (!linkId || !empId) return;
        setLoading(true);
        api.post<ApiResponse>(
            "/admin/links/user-entries",
            { linkId, employeeId: empId }
        )
            .then(res => {
                setTitle(res.data.title);
                setEntries(res.data.entries);
                setTotals(res.data.totals);        // set totals
            })
            .catch(err => {
                setError(err.response?.data?.error || "Failed to load user entries.");
            })
            .finally(() => setLoading(false));
    }, [linkId, empId]);

    if (!linkId || !empId) {
        return <p className="p-8 text-center text-red-600">Missing link or employee ID.</p>;
    }

    return (
        <div className="p-8 max-w mx-auto space-y-6 bg-gray-50 rounded-lg shadow-md">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-semibold">User Entries for: {title}</h1>
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
            ) : entries.length === 0 ? (
                <p className="text-center text-gray-500">No user entries found.</p>
            ) : (
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
                                            <TableCell className="px-4 py-3">
                                                {e.user?.name || e.name}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">{e.upiId}</TableCell>
                                            <TableCell className="px-4 py-3 text-center">
                                                {e.noOfPersons ?? "—"}
                                            </TableCell>
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
                                                ) : "—"}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-center">
                                                {e.status === 1 ? (
                                                    <Badge variant="default" className="bg-green-600">Approved</Badge>
                                                ) : e.status === 0 ? (
                                                    <Badge variant="destructive" className="bg-red-600">Rejected</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-yellow-400">Pending</Badge>
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