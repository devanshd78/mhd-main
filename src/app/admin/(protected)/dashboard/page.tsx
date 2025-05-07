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
}

interface LinkEntry {
    _id: string
    title: string
    createdBy: string
    createdAt: string
}

interface Submission {
    name: string
    upiId: string
    amount: number
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
    const [linkTitle, setLinkTitle] = useState('')
    const [creatingLink, setCreatingLink] = useState(false)
    const [linkSuccess, setLinkSuccess] = useState<string | null>(null)

    /* ----------------------- drill‑down modals --------------------------- */
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
    const [links, setLinks] = useState<LinkEntry[]>([])
    const [linksLoading, setLinksLoading] = useState(false)
    const [totalAmount, setTotalAmount] = useState<number>(0)
    const [selectedLink, setSelectedLink] = useState<LinkEntry | null>(null)
    const [subs, setSubs] = useState<Submission[]>([])
    const [subsLoading, setSubsLoading] = useState(false)

    const [linkPage, setLinkPage] = useState(1);
    const [linkPages, setLinkPages] = useState(1);

    const [subPage, setSubPage] = useState(1);
    const [subPages, setSubPages] = useState(1);

    const PAGE_SIZE = 2;
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
        const adminId = localStorage.getItem('adminId') || ''

        api
            .post<{ link: string }>('/admin/links', { title: linkTitle, adminId })
            .then(res => setLinkSuccess(res.data.link))
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

    const fetchSubs = (link: LinkEntry, page = 1) => {
        setSubsLoading(true);
        api.post('/admin/employees/links/entries', {
            linkId: link._id,
            employeeId: selectedEmp?.employeeId,
            page,
            limit: PAGE_SIZE,
        })
            .then(res => {
                setSubs(res.data.entries);
                setTotalAmount(res.data.totalAmount);
                setSubPage(res.data.page);
                setSubPages(res.data.pages);
            })
            .catch(() => setError('Failed to load submissions.'))
            .finally(() => setSubsLoading(false));
    };


    // ----------------------- view links --------------------------
    const handleViewLinks = (emp: Employee) => {
        setSelectedEmp(emp);
        fetchLinks(emp, 1);       // first page
    };

    // -------------------- view submissions ------------------------
    const handleViewSubmissions = (link: LinkEntry) => {
        setSelectedLink(link);
        fetchSubs(link, 1);       // first page
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
                    {/* ▲ flex‑centred overlay */}
                    <DialogOverlay className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm" />
                    <DialogContent className={modalContainer}>
                        <DialogHeader>
                            <DialogTitle>Create new shareable link</DialogTitle>
                            <DialogDescription>
                                Give the link a short, descriptive title.
                            </DialogDescription>
                        </DialogHeader>

                        <Input
                            placeholder="Link title"
                            value={linkTitle}
                            onChange={e => setLinkTitle(e.target.value)}
                            className="w-full mt-4"
                        />

                        {linkSuccess && (
                            <p className="mt-2 text-sm text-green-600 break-all">
                                Link:&nbsp;
                                <a
                                    href={linkSuccess}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                >
                                    {linkSuccess}
                                </a>
                            </p>
                        )}

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="ghost">Cancel</Button>
                            </DialogClose>
                            <Button
                                onClick={handleCreateLink}
                                disabled={creatingLink || !linkTitle}
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
                                        <TH className="text-right">Actions</TH>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map(emp => (
                                        <TableRow key={emp._id} className="even:bg-gray-50">
                                            <TableCell>{emp.name}</TableCell>
                                            <TableCell className="break-all">{emp.email}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleViewLinks(emp)}
                                                >
                                                    View Links
                                                </Button>
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
                    open={!!selectedEmp}
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
                                                                View Links
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

            {/* ----------------------- Submissions Modal -------------------- */}
            {selectedLink && (
                <Dialog
                    open={!!selectedLink}
                    onOpenChange={() => {
                        setSelectedLink(null)
                        setSubs([])
                        setTotalAmount(0)
                    }}
                >
                    <DialogPortal>
                        {/* ▲ flex‑centred overlay (transparent bg) */}
                        <DialogOverlay className="fixed inset-0 flex items-center justify-center bg-transparent" />
                        <DialogContent className={modalContainer}>
                            <DialogHeader>
                                <DialogTitle>
                                    Submissions for “{selectedLink.title}”
                                </DialogTitle>
                            </DialogHeader>

                            <CardContent className="p-0">
                                {subsLoading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="animate-spin text-gray-500" />
                                    </div>
                                ) : subs.length === 0 ? (
                                    <p className="text-center p-4 text-gray-500">
                                        No submissions found.
                                    </p>
                                ) : (
                                    <div className="overflow-y-auto max-h-[60vh] px-4">
                                        <Table className="w-full table-auto">
                                            <colgroup>
                                                <col className="w-2/5" />
                                                <col className="w-2/5" />
                                                <col className="w-1/5" />
                                            </colgroup>
                                            <TableHeader className="bg-gray-100">
                                                <TableRow>
                                                    <TH>Name</TH>
                                                    <TH>UPI&nbsp;ID</TH>
                                                    <TH className="text-right">Amount&nbsp;& Date</TH>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {subs.map((s, idx) => (
                                                    <TableRow key={idx} className="even:bg-gray-50">
                                                        <TableCell>{s.name}</TableCell>
                                                        <TableCell className="break-all">{s.upiId}</TableCell>
                                                        <TableCell className="text-right whitespace-nowrap">
                                                            ₹{s.amount.toFixed(2)}
                                                            <br />
                                                            {format(new Date(s.createdAt), 'PPpp')}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        {subs.length > 0 && (
                                            <Pager
                                                page={subPage}
                                                pages={subPages}
                                                onChange={p => fetchSubs(selectedLink!, p)}
                                            />
                                        )}

                                    </div>
                                )}
                            </CardContent>

                            {/* Footer with Total and Close */}
                            <DialogFooter className="flex items-center justify-between">
                                <span className="text-lg font-semibold">
                                    Total:&nbsp;₹{totalAmount.toFixed(2)}
                                </span>
                                <DialogClose asChild>
                                    <Button size="sm">Close</Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </DialogPortal>
                </Dialog>
            )}
        </div>
    )
}

export default AdminDashboardPage
