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
import {
  Loader2,
  Search,
  PlusIcon,
  Clock,
  LogOutIcon,
  MoreVertical,
  LinkIcon,
  PlusCircle,
  Edit3,
  Users,
  XCircle,
  CheckCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import api from '@/lib/axios'
import Swal from 'sweetalert2'

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
  userEntries?: any[]
}

interface Submission {
  name: string
  upiId: string
  amount: number
  notes: string
  createdAt: string
}

/** ActionLink: accessible button with icon + label */
const ActionLink: React.FC<{
  title: string
  onClick: () => void
  children: React.ReactNode
}> = ({ title, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="p-2 flex items-center gap-1 rounded hover:bg-gray-100"
  >
    {children}
    <span className="text-sm text-gray-700">{title}</span>
  </button>
)

const modalContainer =
  'w-full sm:w-[90vw] md:w-full max-w-md sm:max-w-3xl ' +
  'bg-white shadow-lg p-6 sm:rounded-2xl ' +
  'max-h-[90vh] overflow-y-auto'

const AdminDashboardPage: React.FC = () => {
  const router = useRouter()

  /* Employees & search state */
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filtered, setFiltered] = useState<Employee[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /* New link modal */
  const [uploadOpen, setUploadOpen] = useState(false)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkTarget, setLinkTarget] = useState('')
  const [linkAmount, setLinkAmount] = useState('')
  const [expireIn, setExpireIn] = useState('')
  const [creatingLink, setCreatingLink] = useState(false)

  /* Drill-down modals */
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [links, setLinks] = useState<LinkEntry[]>([])
  const [linksLoading, setLinksLoading] = useState(false)
  const [linkPage, setLinkPage] = useState(1)
  const [linkPages, setLinkPages] = useState(1)
  const [showLinksModal, setShowLinksModal] = useState(false)
  const [showBalanceModal, setShowBalanceModal] = useState(false)
  const [showUpdateBalanceModal, setShowUpdateBalanceModal] = useState(false)
  const [balanceToAdd, setBalanceToAdd] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const PAGE_SIZE = 5

  /* Fetch employees */
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

  /* Filter on searchTerm */
  useEffect(() => {
    if (!searchTerm) setFiltered(employees)
    else {
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

  /* Create shareable link */
  const handleCreateLink = () => {
    setCreatingLink(true)
    setError('')
    const adminId = localStorage.getItem('adminId') || ''
    api
      .post<{ link: string }>('/admin/links', {
        title: linkTitle,
        adminId,
        target: Number(linkTarget),
        amount: Number(linkAmount),
        expireIn: Number(expireIn),
      })
      .then(res => {
        setUploadOpen(false)
        router.push('/admin/link-history')
      })
      .catch(() => setError('Failed to create link.'))
      .finally(() => setCreatingLink(false))
  }

  /* Fetch links for an employee */
  const fetchLinks = (emp: Employee, page = 1) => {
    setLinksLoading(true)
    api
      .post('/admin/employees/links', {
        employeeId: emp.employeeId,
        page,
        limit: PAGE_SIZE,
      })
      .then(res => {
        setLinks(res.data.links)
        setLinkPage(res.data.page)
        setLinkPages(res.data.pages)
      })
      .catch(() => setError('Failed to load links.'))
      .finally(() => setLinksLoading(false))
  }

  /* Approve / Reject */
  const handleApprove = async (emp: Employee) => {
    try {
      await api.post('/admin/employees/approve', {
        employeeId: emp.employeeId,
      })
      Swal.fire('Approved!', `${emp.name} can now log in.`, 'success')
      setEmployees(prev =>
        prev.map(e =>
          e.employeeId === emp.employeeId ? { ...e, isApproved: 1 } : e
        )
      )
      setFiltered(prev =>
        prev.map(e =>
          e.employeeId === emp.employeeId ? { ...e, isApproved: 1 } : e
        )
      )
    } catch {
      Swal.fire('Error', 'Could not approve employee.', 'error')
    }
  }
  const handleReject = async (emp: Employee) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Reject ${emp.name}’s registration request?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, reject',
    })
    if (!result.isConfirmed) return
    try {
      await api.post('/admin/employees/reject', {
        employeeId: emp.employeeId,
      })
      Swal.fire(
        'Rejected!',
        `${emp.name}’s registration request has been rejected.`,
        'success'
      )
      setEmployees(prev =>
        prev.filter(e => e.employeeId !== emp.employeeId)
      )
      setFiltered(prev =>
        prev.filter(e => e.employeeId !== emp.employeeId)
      )
    } catch {
      Swal.fire('Error', 'Could not reject employee.', 'error')
    }
  }

  /* Handlers for modals */
  const handleViewLinks = (emp: Employee) => {
    setSelectedEmp(emp)
    setShowLinksModal(true)
    fetchLinks(emp, 1)
  }
  const handleAddBalance = (emp: Employee) => {
    setSelectedEmp(emp)
    setShowBalanceModal(true)
    setBalanceToAdd('')
    setNotes('')
  }
  const handleUpdateBalance = (emp: Employee) => {
    setSelectedEmp(emp)
    setShowUpdateBalanceModal(true)
    setBalanceToAdd(emp.balance.toString())
    setNotes('')
  }

  const handleSubmitBalance = async () => {
    if (isSubmitting || !selectedEmp || !balanceToAdd) return
    const adminId = localStorage.getItem('adminId')
    const amount = parseFloat(balanceToAdd)
    if (!adminId || isNaN(amount) || amount <= 0) {
      Swal.fire('Invalid input', 'Please enter a valid amount.', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await api.post('/admin/employees/add-balance', {
        employeeId: selectedEmp.employeeId,
        amount,
        adminId,
        note: notes,
      })
      Swal.fire('Success', 'Balance added!', 'success')
      setEmployees(prev =>
        prev.map(emp =>
          emp._id === selectedEmp._id
            ? { ...emp, balance: emp.balance + amount }
            : emp
        )
      )
      setFiltered(prev =>
        prev.map(emp =>
          emp._id === selectedEmp._id
            ? { ...emp, balance: emp.balance + amount }
            : emp
        )
      )
      setShowBalanceModal(false)
    } catch {
      Swal.fire('Error', 'Failed to update balance', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitUpdateBalance = async () => {
    if (isSubmitting || !selectedEmp || !balanceToAdd) return
    const adminId = localStorage.getItem('adminId')
    const amount = parseFloat(balanceToAdd)
    if (!adminId || isNaN(amount) || amount < 0) {
      Swal.fire('Invalid input', 'Please enter a valid amount.', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await api.post('/admin/employees/update-balance', {
        employeeId: selectedEmp.employeeId,
        newBalance: amount,
        adminId,
        note: notes,
      })
      Swal.fire('Success', 'Balance updated!', 'success')
      setEmployees(prev =>
        prev.map(emp =>
          emp._id === selectedEmp._id ? { ...emp, balance: amount } : emp
        )
      )
      setFiltered(prev =>
        prev.map(emp =>
          emp._id === selectedEmp._id ? { ...emp, balance: amount } : emp
        )
      )
      setShowUpdateBalanceModal(false)
    } catch {
      Swal.fire('Error', 'Failed to update balance', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  /* Navigation handlers */
  const handleViewHistory = (emp: Employee) => {
    router.push(`/admin/dashboard/history?id=${emp.employeeId}&name=${emp.name}`)
  }
  const handleViewUsers = (emp: Employee) => {
    router.push(`/admin/dashboard/users?id=${emp.employeeId}&name=${emp.name}`)
  }
  const handleLogout = () => {
    localStorage.clear()
    Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Logged out', timer: 1200 })
    router.push('/admin/login')
  }

  /* Pagination component */
  const Pager: React.FC<{
    page: number
    pages: number
    onChange: (n: number) => void
  }> = ({ page, pages, onChange }) => (
    <div className="flex items-center justify-center gap-2 py-3">
      <Button size="sm" variant="outline" disabled={page === 1} onClick={() => onChange(page - 1)}>
        Prev
      </Button>
      <span className="text-sm">
        Page {page} / {pages}
      </span>
      <Button size="sm" variant="outline" disabled={page === pages} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </div>
  )

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl sm:text-4xl font-bold">Admin Dashboard</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64 lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1"
          >
            <PlusIcon className="h-4 w-4" /> New Link
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-1"
          >
            <LogOutIcon className="h-4 w-4" /> Logout
          </Button>
        </div>
      </div>

      {/* Create Link Modal */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm" />
          <DialogContent className={modalContainer}>
            <DialogHeader>
              <DialogTitle>Create new shareable link</DialogTitle>
              <DialogDescription>
                Give the link a short title and set target, amount, and expiry.
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Link title"
              value={linkTitle}
              onChange={e => setLinkTitle(e.target.value)}
              className="w-full mt-4"
            />
            <Input
              type="number"
              placeholder="Target (e.g. 100)"
              value={linkTarget}
              onChange={e => setLinkTarget(e.target.value)}
              className="w-full mt-4"
            />
            <Input
              type="number"
              placeholder="Amount per person (e.g. 10)"
              value={linkAmount}
              onChange={e => setLinkAmount(e.target.value)}
              className="w-full mt-4"
            />
            <Input
              type="number"
              placeholder="Expire in (hours)"
              value={expireIn}
              onChange={e => setExpireIn(e.target.value)}
              className="w-full mt-4"
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreateLink} disabled={creatingLink || !linkTitle || !linkTarget || !linkAmount || !expireIn}>
                {creatingLink && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Employee Table */}
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
                    <TableRow key={emp._id} className="even:bg-gray-50 group">
                      <TableCell>{emp.name}</TableCell>
                      <TableCell className="break-all">{emp.email}</TableCell>
                      <TableCell className="break-all">{emp.balance}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end flex-wrap gap-2">
                          <ActionLink title="View Links" onClick={() => handleViewLinks(emp)}>
                            <LinkIcon className="h-5 w-5 text-blue-600" />
                          </ActionLink>
                          <ActionLink title="Add Balance" onClick={() => handleAddBalance(emp)}>
                            <PlusCircle className="h-5 w-5 text-green-600" />
                          </ActionLink>
                          <ActionLink title="Update Balance" onClick={() => handleUpdateBalance(emp)}>
                            <Edit3 className="h-5 w-5 text-yellow-600" />
                          </ActionLink>
                          <ActionLink title="History" onClick={() => handleViewHistory(emp)}>
                            <Clock className="h-5 w-5 text-purple-600" />
                          </ActionLink>
                          <ActionLink title="Users" onClick={() => handleViewUsers(emp)}>
                            <Users className="h-5 w-5 text-indigo-600" />
                          </ActionLink>
                          {emp.isApproved === 0 && (
                            <>
                              <ActionLink title="Approve" onClick={() => handleApprove(emp)}>
                                <CheckCircle className="h-5 w-5 text-green-800" />
                              </ActionLink>
                              <ActionLink title="Reject" onClick={() => handleReject(emp)}>
                                <XCircle className="h-5 w-5 text-red-800" />
                              </ActionLink>
                            </>
                          )}
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

      {/* Links Modal */}
      {selectedEmp && (
        <Dialog
          open={showLinksModal}
          onOpenChange={() => {
            setShowLinksModal(false)
            setSelectedEmp(null)
            setLinks([])
          }}
        >
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm" />
            <DialogContent className={modalContainer}>
              <DialogHeader>
                <DialogTitle>Links for {selectedEmp.name}</DialogTitle>
                <DialogDescription>Click a link to view entries.</DialogDescription>
              </DialogHeader>
              <CardContent className="p-0">
                {linksLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-gray-500" />
                  </div>
                ) : links.length === 0 ? (
                  <p className="text-center p-4 text-gray-500">No links created.</p>
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
                          <TableRow key={link._id} className="even:bg-gray-50">
                            <TableCell className="break-words">{link.title}</TableCell>
                            <TableCell className="text-right">
                              {format(new Date(link.createdAt), 'PPpp')}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  router.push(
                                    `/admin/dashboard/${
                                      Array.isArray(link.userEntries) && link.userEntries.length > 0
                                        ? 'user-view'
                                        : 'view'
                                    }?linkid=${link._id}&empid=${selectedEmp.employeeId}`
                                  )
                                }
                              >
                                View Entries
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Pager page={linkPage} pages={linkPages} onChange={p => fetchLinks(selectedEmp, p)} />
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

      {/* Add Balance Modal */}
      <Dialog open={showBalanceModal} onOpenChange={setShowBalanceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Balance</DialogTitle>
            <DialogDescription>Add funds for {selectedEmp?.name}</DialogDescription>
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
              <label className="block text-sm font-medium mb-1">Amount to Add</label>
              <input
                type="number"
                value={balanceToAdd}
                onChange={e => setBalanceToAdd(e.target.value)}
                className="w-full rounded border px-3 py-2"
                placeholder="Enter amount"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full rounded border px-3 py-2"
                rows={4}
                placeholder="Enter any notes"
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

      {/* Update Balance Modal */}
      <Dialog open={showUpdateBalanceModal} onOpenChange={setShowUpdateBalanceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Balance</DialogTitle>
            <DialogDescription>Set new balance for {selectedEmp?.name}</DialogDescription>
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
                onChange={e => setBalanceToAdd(e.target.value)}
                className="w-full rounded border px-3 py-2"
                placeholder="Enter new balance"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full rounded border px-3 py-2"
                rows={4}
                placeholder="Enter any notes"
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
