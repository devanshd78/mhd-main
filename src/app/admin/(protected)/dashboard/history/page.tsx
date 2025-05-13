"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead as TH,
    TableCell,
} from '@/components/ui/table';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import api from '@/lib/axios';
import { ArrowLeft } from 'lucide-react';

interface HistoryEntry {
    _id: string;
    createdAt: string;
    amount: number;
    note: string;
}

const HistoryPage = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const employeeId = searchParams.get('id');
    const employeeName = searchParams.get('name');

    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(false);
    const [totalAmount, setTotalAmount] = useState<number>(0);

    useEffect(() => {
        if (employeeId) {
            fetchHistory();
        }
    }, [employeeId, page]);

    const fetchHistory = async () => {
        if (!employeeId) return;
        setLoading(true);
        try {
            const { data } = await api.post('/admin/employees/balance-history', {
                employeeId,
                page,
                limit: 20,
            });
            setHistory(data.history);
            setTotal(data.total);
            setTotalAmount(data.totalAmount);
        } catch (err) {
            console.error('Failed to fetch balance history', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    const totalPages = Math.ceil(total / 20);

    return (
        <div className="p-4">
            {/* Back Button */}
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm text-black-600 hover:underline mb-4"
            >
                <ArrowLeft className="h-4 w-4" />
                Back
            </button>

            <h1 className="text-2xl font-semibold mb-4">
                Balance History for Employee {employeeName || 'Loading...'}
            </h1>

            <p className="text-sm text-gray-600 mb-4">
                Total Balance Added: <span className="font-medium text-black">₹{totalAmount}</span>
            </p>
            {loading ? (
                <p>Loading...</p>
            ) : (
                <div className="overflow-x-auto">
                    <Table className="min-w-full">
                        <TableHeader>
                            <TableRow>
                                <TH className="p-2 text-left">Date</TH>
                                <TH className="p-2 text-left">Amount</TH>
                                <TH className="p-2 text-left">Notes</TH>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history.map((entry) => (
                                <TableRow key={entry._id}>
                                    <TableCell className="p-2">{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell className="p-2">{entry.amount}</TableCell>
                                    <TableCell className="p-2">{entry.note}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    <div className="mt-4">
                        <Pagination className="flex justify-between items-center">
                            <PaginationContent>
                                <PaginationPrevious
                                    onClick={() => page > 1 && handlePageChange(page - 1)}
                                    className={page === 1 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                >
                                    Previous
                                </PaginationPrevious>

                                <div className="flex gap-2">
                                    {Array.from({ length: totalPages }).map((_, index) => {
                                        const pageNum = index + 1;
                                        return (
                                            <PaginationItem key={pageNum}>
                                                <PaginationLink
                                                    onClick={() => handlePageChange(pageNum)}
                                                    isActive={page === pageNum}
                                                    className="cursor-pointer"
                                                >
                                                    {pageNum}
                                                </PaginationLink>
                                            </PaginationItem>
                                        );
                                    })}
                                </div>

                                {totalPages > 5 && (
                                    <>
                                        <PaginationEllipsis />
                                        <PaginationItem>
                                            <PaginationLink onClick={() => handlePageChange(totalPages)}>
                                                {totalPages}
                                            </PaginationLink>
                                        </PaginationItem>
                                    </>
                                )}

                                <PaginationNext
                                    className={page === totalPages ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                    onClick={() => page < totalPages && handlePageChange(page + 1)}
                                >
                                    Next
                                </PaginationNext>
                            </PaginationContent>
                        </Pagination>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoryPage;
