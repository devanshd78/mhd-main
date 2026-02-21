'use client'

import React, { useEffect, useMemo, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  Search,
  PlusIcon,
  Clock,
  LogOutIcon,
  LinkIcon,
  PlusCircle,
  Edit3,
  Users,
  XCircle,
  CheckCircle,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import api from '@/lib/axios'
import Swal from 'sweetalert2'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ChevronsUpDown, Check } from 'lucide-react'

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
  minComments?: number
  minReplies?: number
  requireLike?: boolean
  userEntries?: { screenshotId?: string; entryId?: string }[]
}

type CountryOption = { value: string; label: string }
type PlatformValue = 'youtube' | 'instagram' | 'tiktok'

type SelectOption = { value: string; label: string }

const SearchableAddSelect: React.FC<{
  options: SelectOption[]
  selected: string[]
  onSelectValue: (value: string) => void
  buttonPlaceholder: string
  searchPlaceholder: string
}> = ({ options, selected, onSelectValue, buttonPlaceholder, searchPlaceholder }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const isSelected = (val: string) => selected.includes(val)

  // Small optimization for large lists
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)
    )
  }, [query, options])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" type="button" className="w-full justify-between">
          <span className="text-left truncate">{buttonPlaceholder}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />

          <CommandList className="max-h-64">
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup>
              {filtered.map((opt) => (
                <CommandItem
                  key={opt.value}
                  // important: make the "searchable string" include both label + code
                  value={`${opt.label} ${opt.value}`}
                  onSelect={() => {
                    onSelectValue(opt.value)
                    setQuery('')
                    setOpen(false)
                  }}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected(opt.value) && <Check className="h-4 w-4 opacity-80" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
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

const PAGE_SIZE = 5

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'ANY', label: 'Any Category' },
  { value: 'tech', label: 'Tech' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'travel', label: 'Travel' },
  { value: 'food', label: 'Food' },
  { value: 'finance', label: 'Finance' },
  { value: 'education', label: 'Education' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'entertainment', label: 'Entertainment' },
]

function uniquePush(list: string[], v: string) {
  const s = new Set(list)
  s.add(v)
  return Array.from(s)
}

export default function AdminDashboardPage() {
  const router = useRouter()

  /* Employees */
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filtered, setFiltered] = useState<Employee[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /* Link modal */
  const [uploadOpen, setUploadOpen] = useState(false)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkTarget, setLinkTarget] = useState('')
  const [linkAmount, setLinkAmount] = useState('')
  const [expireIn, setExpireIn] = useState('')
  const [creatingLink, setCreatingLink] = useState(false)

  const [minComments, setMinComments] = useState<'0' | '1' | '2'>('2')
  const [minReplies, setMinReplies] = useState<'0' | '1' | '2'>('2')
  const [requireLike, setRequireLike] = useState<boolean>(false)
  const [linkRuleErrors, setLinkRuleErrors] = useState<{ rules?: string }>({})

  /* Email Task modal */
  const [emailTaskOpen, setEmailTaskOpen] = useState(false)
  const [creatingEmailTask, setCreatingEmailTask] = useState(false)

  const [emailTargetUser, setEmailTargetUser] = useState('')
  const [emailTargetPerEmployee, setEmailTargetPerEmployee] = useState('')
  const [emailPlatform, setEmailPlatform] = useState<PlatformValue>('youtube')
  const [emailAmountPerPerson, setEmailAmountPerPerson] = useState('')
  const [emailMaxCount, setEmailMaxCount] = useState('')
  const [emailExpireIn, setEmailExpireIn] = useState('')
  const [emailErrors, setEmailErrors] = useState<{
    platform?: string
    amountPerPerson?: string
    maxEmails?: string
    expireIn?: string
    targetPerEmployee?: string
  }>({})

  // Countries via /admin/countries
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([
    { value: 'ANY', label: 'Any Country' },
  ])
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['ANY'])
  const [countrySelectKey, setCountrySelectKey] = useState(0)

  // Categories (static)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['ANY'])
  const [categorySelectKey, setCategorySelectKey] = useState(0)

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

  const adminId = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('adminId') || '' : ''), [])

  /* Fetch employees */
  useEffect(() => {
    setLoading(true)
    api
      .get<Employee[]>('/admin/employees')
      .then((res) => {
        setEmployees(res.data)
        setFiltered(res.data)
      })
      .catch((err) => {
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
          (e) => e.name.toLowerCase().includes(term) || e.email.toLowerCase().includes(term)
        )
      )
    }
  }, [searchTerm, employees])

  /* Fetch countries when email modal opens */
  useEffect(() => {
    if (!emailTaskOpen) return

    // reset defaults on open (optional)
    setSelectedCountries(['ANY'])
    setSelectedCategories(['ANY'])
    setCountrySelectKey((k) => k + 1)
    setCategorySelectKey((k) => k + 1)

    api
      .get('/admin/countries?format=select&includeAny=1')
      .then((res) => {
        const list = (res.data?.data || []) as CountryOption[]
        if (Array.isArray(list) && list.length) setCountryOptions(list)
      })
      .catch(() => {
        setCountryOptions([{ value: 'ANY', label: 'Any Country' }])
      })
  }, [emailTaskOpen])

  /* Helpers: badges */
  const countryLabel = useMemo(() => {
    const m = new Map(countryOptions.map((c) => [c.value, c.label]))
    return (v: string) => m.get(v) || v
  }, [countryOptions])

  const categoryLabel = useMemo(() => {
    const m = new Map(CATEGORY_OPTIONS.map((c) => [c.value, c.label]))
    return (v: string) => m.get(v) || v
  }, [])

  const addCountry = (v: string) => {
    if (!v) return
    if (v === 'ANY') {
      setSelectedCountries(['ANY'])
      return
    }
    setSelectedCountries((prev) => uniquePush(prev.filter((x) => x !== 'ANY'), v))
  }
  const removeCountry = (v: string) => {
    setSelectedCountries((prev) => {
      const next = prev.filter((x) => x !== v)
      return next.length ? next : ['ANY']
    })
  }

  const addCategory = (v: string) => {
    if (!v) return
    if (v === 'ANY') {
      setSelectedCategories(['ANY'])
      return
    }
    setSelectedCategories((prev) => uniquePush(prev.filter((x) => x !== 'ANY'), v))
  }
  const removeCategory = (v: string) => {
    setSelectedCategories((prev) => {
      const next = prev.filter((x) => x !== v)
      return next.length ? next : ['ANY']
    })
  }

  /* Create Link */
  const handleCreateLink = () => {
    setCreatingLink(true)
    setError('')
    setLinkRuleErrors({})

    const rules = {
      minComments: Number(minComments),
      minReplies: Number(minReplies),
      requireLike: !!requireLike,
    }

    if (rules.minComments === 0 && rules.minReplies === 0) {
      setLinkRuleErrors({ rules: 'minComments and minReplies cannot both be 0.' })
      setCreatingLink(false)
      return
    }

    api
      .post('/admin/links', {
        title: linkTitle,
        adminId,
        target: Number(linkTarget),
        amount: Number(linkAmount),
        expireIn: Number(expireIn),
        ...rules,
      })
      .then(() => {
        setUploadOpen(false)
        setLinkTitle('')
        setLinkTarget('')
        setLinkAmount('')
        setExpireIn('')
        setMinComments('2')
        setMinReplies('2')
        setRequireLike(false)

        Swal.fire('Created', 'Link task created successfully.', 'success')
        router.push('/admin/link-history')
      })
      .catch(() => setError('Failed to create link.'))
      .finally(() => setCreatingLink(false))
  }

  /* Create Email Task (with Country + Category) */
  const handleCreateEmailTask = () => {
    setCreatingEmailTask(true)
    setError('')

    const errors: typeof emailErrors = {}

    const amountNum = Number(emailAmountPerPerson)
    const maxEmailsNum = Number(emailMaxCount)
    const expireNum = Number(emailExpireIn)
    const targetPerEmpNum = Number(emailTargetPerEmployee)

    if (!emailPlatform) errors.platform = 'Platform is required.'
    if (!emailTargetPerEmployee || isNaN(targetPerEmpNum) || targetPerEmpNum <= 0) {
      errors.targetPerEmployee = 'Enter a valid number (> 0).'
    }
    if (!emailAmountPerPerson || isNaN(amountNum) || amountNum <= 0) {
      errors.amountPerPerson = 'Enter a valid amount (> 0).'
    }
    if (!emailMaxCount || isNaN(maxEmailsNum) || maxEmailsNum <= 0) {
      errors.maxEmails = 'Enter a valid max email count (> 0).'
    }
    if (!emailExpireIn || isNaN(expireNum) || expireNum <= 0) {
      errors.expireIn = 'Enter a valid expiration in hours (> 0).'
    }

    setEmailErrors(errors)

    if (Object.keys(errors).length > 0) {
      setCreatingEmailTask(false)
      return
    }

    const countriesPayload = selectedCountries?.length ? selectedCountries : ['ANY']
    const categoriesPayload = selectedCategories?.length ? selectedCategories : ['ANY']

    api
      .post('/admin/emailtasks', {
        adminId,
        targetUser: emailTargetUser,
        targetPerEmployee: targetPerEmpNum,
        platform: emailPlatform, // 'youtube' | 'instagram' | 'tiktok'
        amountPerPerson: amountNum,
        maxEmails: maxEmailsNum,
        expireIn: expireNum,

        // ✅ NEW
        countries: countriesPayload,     // ['ANY'] or ['US','IN']
        categories: categoriesPayload,   // ['ANY'] or ['tech','beauty']
      })
      .then(() => {
        setEmailTaskOpen(false)
        setEmailTargetUser('')
        setEmailTargetPerEmployee('')
        setEmailAmountPerPerson('')
        setEmailMaxCount('')
        setEmailExpireIn('')
        setEmailPlatform('youtube')
        setSelectedCountries(['ANY'])
        setSelectedCategories(['ANY'])
        Swal.fire('Created', 'Email task has been created.', 'success')
      })
      .catch(() => setError('Failed to create email task.'))
      .finally(() => setCreatingEmailTask(false))
  }

  /* Fetch links for employee */
  const fetchLinks = (emp: Employee, page = 1) => {
    setLinksLoading(true)
    api
      .post('/admin/employees/links', { employeeId: emp.employeeId, page, limit: PAGE_SIZE })
      .then((res) => {
        setLinks(res.data.links || [])
        setLinkPage(res.data.page || 1)
        setLinkPages(res.data.pages || 1)
      })
      .catch(() => setError('Failed to load links.'))
      .finally(() => setLinksLoading(false))
  }

  /* Approve / Reject */
  const handleApprove = async (emp: Employee) => {
    try {
      await api.post('/admin/employees/approve', { employeeId: emp.employeeId })
      Swal.fire('Approved!', `${emp.name} can now log in.`, 'success')
      setEmployees((prev) => prev.map((e) => (e.employeeId === emp.employeeId ? { ...e, isApproved: 1 } : e)))
      setFiltered((prev) => prev.map((e) => (e.employeeId === emp.employeeId ? { ...e, isApproved: 1 } : e)))
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
      await api.post('/admin/employees/reject', { employeeId: emp.employeeId })
      Swal.fire('Rejected!', `${emp.name}’s registration request has been rejected.`, 'success')
      setEmployees((prev) => prev.filter((e) => e.employeeId !== emp.employeeId))
      setFiltered((prev) => prev.filter((e) => e.employeeId !== emp.employeeId))
    } catch {
      Swal.fire('Error', 'Could not reject employee.', 'error')
    }
  }

  /* Navigation handlers */
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
    const aId = localStorage.getItem('adminId')
    const amount = parseFloat(balanceToAdd)
    if (!aId || isNaN(amount) || amount <= 0) {
      Swal.fire('Invalid input', 'Please enter a valid amount.', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await api.post('/admin/employees/add-balance', {
        employeeId: selectedEmp.employeeId,
        amount,
        adminId: aId,
        note: notes,
      })
      Swal.fire('Success', 'Balance added!', 'success')
      setEmployees((prev) => prev.map((e) => (e._id === selectedEmp._id ? { ...e, balance: e.balance + amount } : e)))
      setFiltered((prev) => prev.map((e) => (e._id === selectedEmp._id ? { ...e, balance: e.balance + amount } : e)))
      setShowBalanceModal(false)
    } catch {
      Swal.fire('Error', 'Failed to update balance', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitUpdateBalance = async () => {
    if (isSubmitting || !selectedEmp || balanceToAdd === '') return
    const aId = localStorage.getItem('adminId')
    const amount = parseFloat(balanceToAdd)
    if (!aId || isNaN(amount) || amount < 0) {
      Swal.fire('Invalid input', 'Please enter a valid amount.', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await api.post('/admin/employees/update-balance', {
        employeeId: selectedEmp.employeeId,
        newBalance: amount,
        adminId: aId,
        note: notes,
      })
      Swal.fire('Success', 'Balance updated!', 'success')
      setEmployees((prev) => prev.map((e) => (e._id === selectedEmp._id ? { ...e, balance: amount } : e)))
      setFiltered((prev) => prev.map((e) => (e._id === selectedEmp._id ? { ...e, balance: amount } : e)))
      setShowUpdateBalanceModal(false)
    } catch {
      Swal.fire('Error', 'Failed to update balance', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const buildEntriesHref = (link: LinkEntry, empId: string) => {
    const base = `/admin/dashboard/${
      Array.isArray(link.userEntries) && link.userEntries.length > 0 ? 'user-view' : 'view'
    }?linkid=${link._id}&empid=${empId}`

    const ssId = Array.isArray(link.userEntries)
      ? link.userEntries.find((u) => !!u?.screenshotId)?.screenshotId
      : undefined

    return ssId ? `${base}&ssId=${encodeURIComponent(ssId)}` : base
  }

  const handleViewHistory = (emp: Employee) => {
    router.push(`/admin/dashboard/history?id=${emp.employeeId}&name=${encodeURIComponent(emp.name)}`)
  }

  const handleViewUsers = (emp: Employee) => {
    router.push(`/admin/dashboard/users?id=${emp.employeeId}&name=${encodeURIComponent(emp.name)}`)
  }

  const handleLogout = () => {
    localStorage.clear()
    Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Logged out', timer: 1200 })
    router.push('/admin/login')
  }

  const Pager: React.FC<{ page: number; pages: number; onChange: (n: number) => void }> = ({
    page,
    pages,
    onChange,
  }) => (
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

  const linkFormValid =
    !!linkTitle &&
    !!linkTarget &&
    !!linkAmount &&
    !!expireIn &&
    !(Number(minComments) === 0 && Number(minReplies) === 0)

  const emailFormValid =
    !!emailTargetPerEmployee && !!emailAmountPerPerson && !!emailMaxCount && !!emailExpireIn

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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>

          <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)} className="flex items-center gap-1">
            <PlusIcon className="h-4 w-4" /> New Link
          </Button>

          <Button variant="outline" size="sm" onClick={() => setEmailTaskOpen(true)} className="flex items-center gap-1">
            <PlusIcon className="h-4 w-4" /> New Email Task
          </Button>

          <Button variant="ghost" size="sm" onClick={handleLogout} className="flex items-center gap-1">
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
              <DialogDescription>Give the link a short title and set target, amount, and expiry.</DialogDescription>
            </DialogHeader>

            <Input placeholder="Link title" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} className="w-full mt-4" />
            <Input type="number" placeholder="Target (e.g. 100)" value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)} className="w-full mt-4" />
            <Input type="number" placeholder="Amount per person (e.g. 10)" value={linkAmount} onChange={(e) => setLinkAmount(e.target.value)} className="w-full mt-4" />
            <Input type="number" placeholder="Expire in (hours)" value={expireIn} onChange={(e) => setExpireIn(e.target.value)} className="w-full mt-4" />

            {/* Verification rules */}
            <div className="mt-4 border rounded-xl p-4 bg-gray-50">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm">Verification Rules</p>
                <span className="text-xs text-gray-500">0–2 only</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Min Comments</label>
                  <Select value={minComments} onValueChange={(v) => setMinComments(v as '0' | '1' | '2')}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Min Replies</label>
                  <Select value={minReplies} onValueChange={(v) => setMinReplies(v as '0' | '1' | '2')}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Require Like</label>
                  <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={requireLike} onChange={(e) => setRequireLike(e.target.checked)} />
                    <span className="text-sm text-gray-700">Yes</span>
                  </div>
                </div>
              </div>

              {Number(minComments) === 0 && Number(minReplies) === 0 && (
                <p className="text-xs text-red-600 mt-2">Min Comments and Min Replies cannot both be 0.</p>
              )}
              {linkRuleErrors.rules && <p className="text-xs text-red-600 mt-2">{linkRuleErrors.rules}</p>}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreateLink} disabled={creatingLink || !linkFormValid}>
                {creatingLink && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Create Email Task Modal (with Countries + Categories) */}
      <Dialog open={emailTaskOpen} onOpenChange={setEmailTaskOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm" />
          <DialogContent className={modalContainer}>
            <DialogHeader>
              <DialogTitle>Create new email task</DialogTitle>
              <DialogDescription>Define target user, platform, payout, cap, expiration, country + category rules.</DialogDescription>
            </DialogHeader>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Target user handle (optional)</label>
              <Input
                placeholder="e.g. @brand or domain"
                value={emailTargetUser}
                onChange={(e) => setEmailTargetUser(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Target per employee (number of users)</label>
              <Input
                type="number"
                placeholder="e.g. 5"
                value={emailTargetPerEmployee}
                onChange={(e) => setEmailTargetPerEmployee(e.target.value)}
                className={`w-full ${emailErrors.targetPerEmployee ? 'border-red-500' : ''}`}
              />
              {emailErrors.targetPerEmployee && <p className="text-xs text-red-600 mt-1">{emailErrors.targetPerEmployee}</p>}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Platform</label>
              <Select value={emailPlatform} onValueChange={(v) => setEmailPlatform(v as PlatformValue)}>
                <SelectTrigger className={`w-full ${emailErrors.platform ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                </SelectContent>
              </Select>
              {emailErrors.platform && <p className="text-xs text-red-600 mt-1">{emailErrors.platform}</p>}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Amount per person</label>
              <Input
                type="number"
                placeholder="e.g. 10"
                value={emailAmountPerPerson}
                onChange={(e) => setEmailAmountPerPerson(e.target.value)}
                className={`w-full ${emailErrors.amountPerPerson ? 'border-red-500' : ''}`}
              />
              {emailErrors.amountPerPerson && <p className="text-xs text-red-600 mt-1">{emailErrors.amountPerPerson}</p>}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Max no. of emails in task</label>
              <Input
                type="number"
                placeholder="e.g. 100"
                value={emailMaxCount}
                onChange={(e) => setEmailMaxCount(e.target.value)}
                className={`w-full ${emailErrors.maxEmails ? 'border-red-500' : ''}`}
              />
              {emailErrors.maxEmails && <p className="text-xs text-red-600 mt-1">{emailErrors.maxEmails}</p>}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Expiration (hours)</label>
              <Input
                type="number"
                placeholder="e.g. 24"
                value={emailExpireIn}
                onChange={(e) => setEmailExpireIn(e.target.value)}
                className={`w-full ${emailErrors.expireIn ? 'border-red-500' : ''}`}
              />
              {emailErrors.expireIn && <p className="text-xs text-red-600 mt-1">{emailErrors.expireIn}</p>}
            </div>

            {/* Countries (multi by repeated Select add) */}
            <div className="mt-5">
              <label className="block text-sm font-medium mb-1">Countries</label>

              <div className="flex flex-wrap gap-2 mb-2">
                {selectedCountries.map((c) => (
                  <Badge key={c} variant="secondary" className="flex items-center gap-1">
                    {countryLabel(c)}
                    {c !== 'ANY' && (
                      <button type="button" onClick={() => removeCountry(c)} className="ml-1 hover:opacity-80">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>

<SearchableAddSelect
  options={countryOptions}
  selected={selectedCountries}
  buttonPlaceholder="Add a country (or Any Country)"
  searchPlaceholder="Search country (name or code)..."
  onSelectValue={(v) => {
    addCountry(v)
  }}
/>

              <p className="text-xs text-gray-500 mt-1">
                Tip: select multiple countries one-by-one. Choosing “Any Country” clears restrictions.
              </p>
            </div>

            {/* Categories (multi by repeated Select add) */}
            <div className="mt-5">
              <label className="block text-sm font-medium mb-1">Categories</label>

              <div className="flex flex-wrap gap-2 mb-2">
                {selectedCategories.map((c) => (
                  <Badge key={c} variant="secondary" className="flex items-center gap-1">
                    {categoryLabel(c)}
                    {c !== 'ANY' && (
                      <button type="button" onClick={() => removeCategory(c)} className="ml-1 hover:opacity-80">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>

<SearchableAddSelect
  options={CATEGORY_OPTIONS}
  selected={selectedCategories}
  buttonPlaceholder="Add a category (or Any Category)"
  searchPlaceholder="Search category..."
  onSelectValue={(v) => {
    addCategory(v)
  }}
/>

              <p className="text-xs text-gray-500 mt-1">
                Tip: select multiple categories one-by-one. Choosing “Any Category” clears restrictions.
              </p>
            </div>

            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreateEmailTask} disabled={creatingEmailTask || !emailFormValid}>
                {creatingEmailTask && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
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
                  {filtered.map((emp) => (
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
                        {links.map((link) => (
                          <TableRow key={link._id} className="even:bg-gray-50">
                            <TableCell className="break-words">{link.title}</TableCell>
                            <TableCell className="text-right">{format(new Date(link.createdAt), 'PPpp')}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push(buildEntriesHref(link, selectedEmp.employeeId))}
                              >
                                View Entries
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <Pager page={linkPage} pages={linkPages} onChange={(p) => fetchLinks(selectedEmp, p)} />
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