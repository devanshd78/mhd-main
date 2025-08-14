"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead as TH,
    TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface User {
    userId: string;
    name: string;
    phone: number;
    email: string;
    upiId: string;
    createdAt: string;
}

export default function AdminUsersPage() {
    const params = useSearchParams();
    const router = useRouter();
    const employeeId = params.get("id");
    const name = params.get("name");

    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!employeeId) {
            setError("No employee specified.");
            setLoading(false);
            return;
        }
        api
            .get<{ users: User[] }>(`/user/getbyEmployeeId/${employeeId}`, {
                withCredentials: true,
            })
            .then((res) => {
                setUsers(res.data.users);
            })
            .catch((err) => {
                setError(err.response?.data?.error || "Failed to load users.");
            })
            .finally(() => setLoading(false));
    }, [employeeId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full py-12">
                <p>Loading users...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-600 py-10">
                <p>{error}</p>
                <Button variant="outline" onClick={() => router.back()}>
                    Go Back
                </Button>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold">Users for Employee {name}</h1>
                <Button variant="outline" onClick={() => router.back()}>
                    Back
                </Button>
            </div>

            <div className="overflow-x-auto bg-white shadow rounded-lg">
                <Table className="w-full">
                    <TableHeader className="bg-gray-100">
                        <TableRow>
                            <TH className="px-4 py-2 text-left">Name</TH>
                            <TH className="px-4 py-2 text-center">Phone</TH>
                            <TH className="px-4 py-2 text-left">Email</TH>
                            <TH className="px-4 py-2 text-left">UPI ID</TH>
                            <TH className="px-4 py-2 text-left">Created At</TH>
                            <TH className="px-4 py-2 text-left">Action</TH>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((u) => (
                            <TableRow key={u.userId} className="hover:bg-gray-50">
                                <TableCell className="px-4 py-2">{u.name}</TableCell>
                                <TableCell className="px-4 py-2 text-center">{u.phone}</TableCell>
                                <TableCell className="px-4 py-2">{u.email}</TableCell>
                                <TableCell className="px-4 py-2">{u.upiId}</TableCell>
                                <TableCell className="px-4 py-2">
                                    {new Date(u.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="px-4 py-2">
                                    <Button
                                        variant="outline"
                                        className="mr-2"
                                        onClick={() => router.push(`/admin/dashboard/users/view?id=${u.userId}`)}
                                    >
                                        Legacy Details
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => router.push(`/admin/dashboard/users/view-screenshot?id=${u.userId}`)}
                                    >
                                        New Details
                                    </Button>

                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}