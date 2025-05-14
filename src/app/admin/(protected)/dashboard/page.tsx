'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
    DialogOverlay,
    DialogPortal,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead as TH,
    TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Search, PlusIcon, Clock, LogOutIcon } from 'lucide-react'
import { format } from 'date-fns'
import api from '@/lib/axios'
import Swal from 'sweetalert2'

interface Employee {
    _id: string
    name: string
    email: string
    employeeId: string
    balance: number
}

interface LinkEntry {
    _id: string
    title: string
    createdBy: string
    createdAt: string
    target: number
    amount: number
}

interface Submission {
    name: string
    upiId: string
    amount: number
    notes: string
    createdAt: string
}

/** Shared class for all modal <DialogContent>s
 *  (Overlay now handles centring – see below) */
const modalContainer =
    'w-full sm:w-[90vw] md:w-full max-w-md sm:max-w-3xl ' + /* ▲ removed fixed/inset */
    'bg-white shadow-lg p-6 sm:rounded-2xl ' +
    'max-h-[90vh] overflow-y-auto'                             /* ▲ mobile‑friendly */

const AdminDashboardPage: React.FC = () => {
    const router = useRouter()

    /* ----------------------- employee list & search ----------------------- */
    const [employees, setEmployees] = useState<Employee[]>([])
    const [filtered, setFiltered] = useState<Employee[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    /* ----------------------- upload link modal --------------------------- */
    const [uploadOpen, setUploadOpen] = useState(false)
    const [linkTitle, setLinkTitle] = useState('');
    const [linkTarget, setLinkTarget] = useState('');
    const [linkAmount, setLinkAmount] = useState('');
    const [creatingLink, setCreatingLink] = useState(false);

    const [linkSuccess, setLinkSuccess] = useState<string | null>(null)
    const [showLinksModal, setShowLinksModal] = useState(false);

    /* ----------------------- drill‑down modals --------------------------- */
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
    const [links, setLinks] = useState<LinkEntry[]>([])
    const [linksLoading, setLinksLoading] = useState(false)
    const [selectedLink, setSelectedLink] = useState<LinkEntry | null>(null)
    const [subs, setSubs] = useState<Submission[]>([])

    const [linkPage, setLinkPage] = useState(1);
    const [linkPages, setLinkPages] = useState(1);
    const [showBalanceModal, setShowBalanceModal] = useState(false);
    const [balanceToAdd, setBalanceToAdd] = useState('');
    const [notes, setNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const PAGE_SIZE = 5;
    /* ----------------------- fetch employees ---------------------------- */
    useEffect(() => {
        setLoading(true)
        api
            .get<Employee[]>('/admin/employees')
            .then(res => {
                setEmployees(res.data)
                setFiltered(res.data)
            })
            .catch(err => {
                if (err.response?.status === 401) router.replace('/admin')
                else setError('Failed to load employees.')
            })
            .finally(() => setLoading(false))
    }, [router])

    /* ----------------------- search filter ------------------------------ */
    useEffect(() => {
        if (!searchTerm) {
            setFiltered(employees)
        } else {
            const term = searchTerm.toLowerCase()
            setFiltered(
                employees.filter(
                    e =>
                        e.name.toLowerCase().includes(term) ||
                        e.email.toLowerCase().includes(term)
                )
            )
        }
    }, [searchTerm, employees])

    /* ----------------------- upload link ------------------------------- */
    const handleCreateLink = () => {
        setCreatingLink(true)
        setLinkSuccess(null)
        setError('')
        const adminId = localStorage.getItem('adminId') || ''

        api
            .post<{ link: string }>('/admin/links', {
                title: linkTitle, adminId, target: Number(linkTarget),
                amount: Number(linkAmount)
            })
            .then(res => {
                setLinkSuccess(res.data.link)
                setUploadOpen(false)
                router.push('/admin/link-history')
            })
            .catch(() => setError('Failed to create link.'))
            .finally(() => setCreatingLink(false))
    }


    const fetchLinks = (emp: Employee, page = 1) => {
        setLinksLoading(true);
        api.post('/admin/employees/links', {
            employeeId: emp.employeeId,
            page,
            limit: PAGE_SIZE,
        })
            .then(res => {
                console.log(res.data.links);

                setLinks(res.data.links);
                setLinkPage(res.data.page);
                setLinkPages(res.data.pages);
            })
            .catch(() => setError('Failed to load links.'))
            .finally(() => setLinksLoading(false));
    };


    // ----------------------- view links --------------------------
    const handleViewLinks = (emp: Employee) => {
        setSelectedEmp(emp);
        setShowLinksModal(true);
        fetchLinks(emp, 1);       // first page
    };

    const handleAddBalance = (emp: Employee) => {
        setSelectedEmp(emp);
        setShowBalanceModal(true);
        setBalanceToAdd('');
    };

    const handleSubmitBalance = async () => {
        if (isSubmitting) return;

        if (!selectedEmp || !balanceToAdd) return;

        const adminId = localStorage.getItem('adminId');
        const amount = parseFloat(balanceToAdd);

        if (!adminId || isNaN(amount) || amount <= 0) {
            Swal.fire('Invalid input', 'Please enter a valid amount.', 'error');
            return;
        }

        setIsSubmitting(true);

        try {
            await api.post('/admin/employees/add-balance', {
                employeeId: selectedEmp.employeeId,
                amount,
                adminId,
                note: notes,
            });

            Swal.fire('Success', 'Balance added successfully!', 'success');

            setEmployees(prev =>
                prev.map(emp =>
                    emp._id === selectedEmp._id
                        ? { ...emp, balance: (emp.balance || 0) + amount }
                        : emp
                )
            );
            setFiltered(prev =>
                prev.map(emp =>
                    emp._id === selectedEmp._id
                        ? { ...emp, balance: (emp.balance || 0) + amount }
                        : emp
                )
            );

            setShowBalanceModal(false);
            setBalanceToAdd('');
            setNotes('');
        } catch (error) {
            Swal.fire('Error', 'Failed to add balance', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // -------------------- view submissions ------------------------
    const handleViewSubmissions = (link: LinkEntry) => {
        if (!link._id || !selectedEmp?.employeeId) return
        router.push(`/admin/dashboard/view?linkid=${link._id}&empid=${selectedEmp.employeeId}`)
    }

    const handleViewHistory = (emp: Employee) => {
        router.push(`/admin/dashboard/history?id=${emp.employeeId}&name=${emp.name}`);
    };

    /* logout handler */
    const handleLogout = async () => {
        localStorage.clear()
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'Logged out',
            showConfirmButton: false,
            timer: 1200,
        })
        router.push('/admin/login')
    }

    const Pager = ({
        page,
        pages,
        onChange,
    }: {
        page: number;
        pages: number;
        onChange: (n: number) => void;
    }) => (
        <div className="flex items-center justify-center gap-2 py-3">
            <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => onChange(page - 1)}
            >
                Prev
            </Button>
            <span className="text-sm">
                Page {page} / {pages}
            </span>
            <Button
                size="sm"
                variant="outline"
                disabled={page === pages}
                onClick={() => onChange(page + 1)}
            >
                Next
            </Button>
        </div>
    );

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-8 space-y-6">
            {/* ----------------------- Header ------------------------------- */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                {/* Left – title */}
                <h1 className="text-3xl sm:text-4xl font-bold shrink-0">
                    Admin Dashboard
                </h1>

                {/* Center & right actions wrap to new line on mobile */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">

                    {/* 🔍 search */}
                    <div className="relative w-full sm:w-64 lg:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            placeholder="Search employees..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 w-full"
                        />
                    </div>

                    {/* ➕ new link */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUploadOpen(true)}
                        className="flex items-center gap-1"
                    >
                        <PlusIcon className="h-4 w-4" />
                        New Link
                    </Button>

                    {/* 🕑 history */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/admin/link-history')}
                        className="flex items-center gap-1"
                    >
                        <Clock className="h-4 w-4" />
                        Link History
                    </Button>

                    {/* 🔓 logout – always last, pushes to far right on wider screens */}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleLogout}
                        className="flex items-center gap-1 sm:ml-auto"
                    >
                        <LogOutIcon className="h-4 w-4" />
                        Logout
                    </Button>
                </div>
            </div>


            {/* ----------------------- Upload Link Modal -------------------- */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogPortal>
                    <DialogOverlay className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm" />
                    <DialogContent className={modalContainer}>
                        <DialogHeader>
                            <DialogTitle>Create new shareable link</DialogTitle>
                            <DialogDescription>
                                Give the link a short, descriptive title and fill in target & amount.
                            </DialogDescription>
                        </DialogHeader>

                        {/* Title Input */}
                        <Input
                            placeholder="Link title"
                            value={linkTitle}
                            onChange={e => setLinkTitle(e.target.value)}
                            className="w-full mt-4"
                        />

                        {/* Target Input */}
                        <Input
                            type="number"
                            placeholder="Target (e.g. 100)"
                            value={linkTarget}
                            onChange={e => setLinkTarget(e.target.value)}
                            className="w-full mt-4"
                        />

                        {/* Amount Input */}
                        <Input
                            type="number"
                            placeholder="Amount per person (e.g. 10)"
                            value={linkAmount}
                            onChange={e => setLinkAmount(e.target.value)}
                            className="w-full mt-4"
                        />

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="ghost">Cancel</Button>
                            </DialogClose>
                            <Button
                                onClick={handleCreateLink}
                                disabled={creatingLink || !linkTitle || !linkTarget || !linkAmount}
                            >
                                {creatingLink && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                                Create
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </DialogPortal>
            </Dialog>

            {/* ----------------------- Employee Table ----------------------- */}
            <Card>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin" />
                        </div>
                    ) : error ? (
                        <p className="text-center text-red-500">{error}</p>
                    ) : filtered.length === 0 ? (
                        <p className="text-center text-gray-500">No employees found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="w-full min-w-[36rem] table-auto">
                                <colgroup>
                                    <col className="w-2/6" />
                                    <col className="w-2/6" />
                                    <col className="w-2/6" />
                                </colgroup>
                                <TableHeader className="bg-gray-100">
                                    <TableRow>
                                        <TH>Name</TH>
                                        <TH>Email</TH>
                                        <TH>Balance</TH>
                                        <TH className="text-right">Actions</TH>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map(emp => (
                                        <TableRow key={emp._id} className="even:bg-gray-50">
                                            <TableCell>{emp.name}</TableCell>
                                            <TableCell className="break-all">{emp.email}</TableCell>
                                            <TableCell className="break-all">{emp.balance || 0}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-col space-y-2 items-justify-end">
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-100 text-green-800 hover:bg-green-200"
                                                        onClick={() => handleViewLinks(emp)}
                                                    >
                                                        View Links
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="bg-blue-100 text-blue-800 hover:bg-blue-200"
                                                        onClick={() => handleAddBalance(emp)}
                                                    >
                                                        Add Balance
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                                        onClick={() => handleViewHistory(emp)}
                                                    >
                                                        View History
                                                    </Button>
                                                </div>
                                            </TableCell>

                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ----------------------- Links Modal -------------------------- */}
            {selectedEmp && (
                <Dialog
                    open={showLinksModal}
                    onOpenChange={() => {
                        setSelectedEmp(null)
                        setLinks([])
                        setSelectedLink(null)
                        setSubs([])
                    }}
                >
                    <DialogPortal>
                        {/* ▲ flex‑centred overlay */}
                        <DialogOverlay className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm" />
                        <DialogContent className={modalContainer}>
                            <DialogHeader>
                                <DialogTitle>Links for {selectedEmp.name}</DialogTitle>
                                <DialogDescription>
                                    Click a link title to see its submissions.
                                </DialogDescription>
                            </DialogHeader>

                            <CardContent className="p-0">
                                {linksLoading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="animate-spin text-gray-500" />
                                    </div>
                                ) : links.length === 0 ? (
                                    <p className="text-center p-4 text-gray-500">
                                        No links created.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table className="w-full min-w-[32rem] table-auto">
                                            <colgroup>
                                                <col className="w-1/2" />
                                                <col className="w-1/4" />
                                                <col className="w-1/4" />
                                            </colgroup>
                                            <TableHeader className="bg-gray-100">
                                                <TableRow>
                                                    <TH>Title</TH>
                                                    <TH>Created</TH>
                                                    <TH>Actions</TH>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {links.map(link => (
                                                    <TableRow
                                                        key={link._id}
                                                        className="even:bg-gray-50"
                                                    >
                                                        <TableCell className="break-words">
                                                            {link.title}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {format(new Date(link.createdAt), 'PPpp')}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleViewSubmissions(link)}
                                                            >
                                                                View Entries
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        {links.length > 0 && (
                                            <Pager
                                                page={linkPage}
                                                pages={linkPages}
                                                onChange={p => fetchLinks(selectedEmp!, p)}
                                            />
                                        )}

                                    </div>

                                )}

                            </CardContent>

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button size="sm">Close</Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </DialogPortal>
                </Dialog>
            )}

            <Dialog open={showBalanceModal} onOpenChange={setShowBalanceModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Balance</DialogTitle>
                        <DialogDescription>
                            Add balance for {selectedEmp?.name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div>
                            <label className="block text-sm font-medium mb-1">Current Balance</label>
                            <input
                                type="text"
                                disabled
                                value={selectedEmp?.balance ?? 0}
                                className="w-full rounded border px-3 py-2 bg-gray-100 text-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Add Balance</label>
                            <input
                                type="number"
                                value={balanceToAdd}
                                onChange={(e) => setBalanceToAdd(e.target.value)}
                                className="w-full rounded border px-3 py-2"
                                placeholder="Enter amount"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full rounded border px-3 py-2"
                                placeholder="Enter any notes"
                                rows={4}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSubmitBalance} disabled={isSubmitting}>
                            {isSubmitting ? 'Submitting...' : 'Submit'}
                        </Button>

                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default AdminDashboardPage
