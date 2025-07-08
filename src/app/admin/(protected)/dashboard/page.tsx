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
import { Loader2, Search, PlusIcon, Clock, LogOutIcon, MoreVertical } from 'lucide-react'
import { format, set } from 'date-fns'
import api from '@/lib/axios'
import Swal from 'sweetalert2'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'

interface Employee {
    _id: string
    name: string
    email: string
    employeeId: string
    balance: number
    isApproved: number
}

interface LinkEntry {
    _id: string
    title: string
    createdBy: string
    createdAt: string
    target: number
    amount: number
    expireIn: number
    userEntries?: any[] // Add this property to fix the error
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
    const [expireIn, setExpireIn] = useState('');
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
    const [showUpdateBalanceModal, setShowUpdateBalanceModal] = useState(false);
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
                amount: Number(linkAmount), expireIn: Number(expireIn)
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

    const handleApprove = async (emp: Employee) => {
        try {
            await api.post('/admin/employees/approve', {
                employeeId: emp.employeeId,
            });
            Swal.fire('Approved!', `${emp.name} can now log in.`, 'success');

            // update in-place
            setEmployees(prev =>
                prev.map(e =>
                    e.employeeId === emp.employeeId ? { ...e, isApproved: 1 } : e
                )
            );
            setFiltered(prev =>
                prev.map(e =>
                    e.employeeId === emp.employeeId ? { ...e, isApproved: 1 } : e
                )
            );
        } catch {
            Swal.fire('Error', 'Could not approve employee.', 'error');
        }
    };

    const handleReject = async (emp: Employee) => {
        // 1️⃣ Ask for confirmation
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Reject ${emp.name}’s registration request?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, reject',
            cancelButtonText: 'Cancel',
        });

        if (!result.isConfirmed) return; // abort if they cancel

        // 2️⃣ Perform the reject
        try {
            await api.post('/admin/employees/reject', {
                employeeId: emp.employeeId,
            });

            Swal.fire(
                'Rejected!',
                `${emp.name}’s registration request has been rejected.`,
                'success'
            );

            // 3️⃣ Remove from pending lists
            setEmployees(prev =>
                prev.filter(e => e.employeeId !== emp.employeeId)
            );
            setFiltered(prev =>
                prev.filter(e => e.employeeId !== emp.employeeId)
            );
        } catch {
            Swal.fire('Error', 'Could not reject employee.', 'error');
        }
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
            Swal.fire({
                icon: 'error',
                title: 'Invalid input',
                text: 'Please enter a valid amount.',
                timer: 1500, // The alert will automatically close after 1500 ms (1.5 seconds)
                showConfirmButton: false, // Hides the "OK" button
            });
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

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Balance Added successfully!',
                timer: 1500, // The alert will automatically close after 1500 ms (1.5 seconds)
                showConfirmButton: false, // Hides the "OK" button
            });

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
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to update balance',
                timer: 1500, // Closes the alert after 1.5 seconds
                showConfirmButton: false, // Hides the "OK" button
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateBalance = (emp: Employee) => {
        setSelectedEmp(emp);
        setShowUpdateBalanceModal(true);
        setBalanceToAdd(emp.balance?.toString() ?? '');
    };

    const handleSubmitUpdateBalance = async () => {
        if (isSubmitting) return;

        if (!selectedEmp || !balanceToAdd) return;

        const adminId = localStorage.getItem('adminId');
        const amount = parseFloat(balanceToAdd);

        if (!adminId || isNaN(amount) || amount < 0) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid input',
                text: 'Please enter a valid amount.',
                timer: 1500, // The alert will automatically close after 1500 ms (1.5 seconds)
                showConfirmButton: false, // Hides the "OK" button
            });

            return;
        }

        setIsSubmitting(true);

        try {
            await api.post('/admin/employees/update-balance', {
                employeeId: selectedEmp.employeeId,
                newBalance: amount,
                adminId,
                note: notes,
            });

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Balance updated successfully!',
                timer: 1500, // The alert will automatically close after 1500 ms (1.5 seconds)
                showConfirmButton: false, // Hides the "OK" button
            });


            setEmployees(prev =>
                prev.map(emp =>
                    emp._id === selectedEmp._id
                        ? { ...emp, balance: amount } // Here we're updating the balance
                        : emp
                )
            );
            setFiltered(prev =>
                prev.map(emp =>
                    emp._id === selectedEmp._id
                        ? { ...emp, balance: amount }
                        : emp
                )
            );

            setShowUpdateBalanceModal(false);
            setBalanceToAdd('');
            setNotes('');
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to update balance',
                timer: 1500, // Closes the alert after 1.5 seconds
                showConfirmButton: false, // Hides the "OK" button
            });

        } finally {
            setIsSubmitting(false);
        }
    };

    // -------------------- view submissions ------------------------
const handleViewSubmissions = (link: LinkEntry) => {
  if (!link._id || !selectedEmp?.employeeId) return;

  const hasUserEntries = Array.isArray(link.userEntries) && link.userEntries.length > 0;
  const subpath       = hasUserEntries ? "user-view" : "view";

  router.push(
    `/admin/dashboard/${subpath}?linkid=${link._id}&empid=${selectedEmp.employeeId}`
  );
};


    const handleViewHistory = (emp: Employee) => {
        router.push(`/admin/dashboard/history?id=${emp.employeeId}&name=${emp.name}`);
    };

    const handleViewUsers = (emp: Employee) => {
        router.push(`/admin/dashboard/users?id=${emp.employeeId}&name=${emp.name}`);
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

                        <Input
                            type="number"
                            placeholder="Link Expiration (in hours)"
                            value={expireIn}
                            onChange={e => setExpireIn(e.target.value)}
                            className="w-full mt-4"
                        />

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="ghost">Cancel</Button>
                            </DialogClose>
                            <Button
                                onClick={handleCreateLink}
                                disabled={creatingLink || !linkTitle || !linkTarget || !linkAmount || !expireIn}
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
                        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
                    ) : error ? (
                        <p className="text-center text-red-500">{error}</p>
                    ) : filtered.length === 0 ? (
                        <p className="text-center text-gray-500">No employees found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="w-full table-auto">
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
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" className="p-2">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => handleViewLinks(emp)}>View Links</DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => handleAddBalance(emp)}>Add Balance</DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => handleUpdateBalance(emp)}>Update Balance</DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => handleViewHistory(emp)}>View History</DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => handleViewUsers(emp)}>View Users</DropdownMenuItem>
                                                        {!emp.isApproved && <>
                                                            <DropdownMenuItem onSelect={() => handleApprove(emp)}>Approve</DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => handleReject(emp)}>Reject</DropdownMenuItem>
                                                        </>}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
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

            <Dialog open={showUpdateBalanceModal} onOpenChange={setShowUpdateBalanceModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Balance</DialogTitle>
                        <DialogDescription>
                            Update balance for {selectedEmp?.name}
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
                            <label className="block text-sm font-medium mb-1">New Balance</label>
                            <input
                                type="number"
                                value={balanceToAdd}
                                onChange={(e) => setBalanceToAdd(e.target.value)}
                                className="w-full rounded border px-3 py-2"
                                placeholder="Enter new balance"
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
                        <Button onClick={handleSubmitUpdateBalance} disabled={isSubmitting}>
                            {isSubmitting ? 'Submitting...' : 'Submit'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}

export default AdminDashboardPage
