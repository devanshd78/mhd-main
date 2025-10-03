'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead as TH,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Search, ChevronDown, ChevronUp, Eye, Plus } from 'lucide-react'
import { format } from 'date-fns'
import api from '@/lib/axios'

// Types mirrored from your backend selection
interface EmailTaskRow {
  _id: string
  createdBy: string
  platform: string
  targetUser?: string | number
  targetPerEmployee: number
  amountPerPerson: number
  maxEmails: number
  expireIn: number
  expiresAt: string
  createdAt: string
  status: 'active' | 'expired'
}

interface ListResponse {
  tasks: EmailTaskRow[]
  total: number
  page: number
  pages: number
}

const PAGE_SIZE_DEFAULT = 20

type SortKey =
  | 'createdAt'
  | 'platform'
  | 'amountPerPerson'
  | 'maxEmails'
  | 'expireIn'
  | 'targetPerEmployee'
  | 'expiresAt'

type SortOrder = 'asc' | 'desc'

const ActiveOptions = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'true' },
  { label: 'Expired', value: 'false' },
]

const PlatformOptions = [
  { label: 'All', value: '' },
  { label: 'Instagram', value: 'Instagram' },
  { label: 'TikTok', value: 'TikTok' },
  { label: 'YouTube', value: 'YouTube' },
]

const AdminEmailTaskListPage: React.FC = () => {
  const router = useRouter()

  const [rows, setRows] = useState<EmailTaskRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [limit, setLimit] = useState(PAGE_SIZE_DEFAULT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState('')
  const [active, setActive] = useState('') // '', 'true', 'false'
  const [sortBy, setSortBy] = useState<SortKey>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Admin ID from localStorage
  const adminId = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('adminId') || ''
  }, [])

  // ---- Create Dialog State ----
  const [openCreate, setOpenCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [cPlatform, setCPlatform] = useState('YouTube')
  const [cTargetUser, setCTargetUser] = useState<string>('')
  const [cTargetPerEmployee, setCTargetPerEmployee] = useState('')
  const [cAmountPerPerson, setCAmountPerPerson] = useState('')
  const [cMaxEmails, setCMaxEmails] = useState('')
  const [cExpireIn, setCExpireIn] = useState('')
  const [createError, setCreateError] = useState('')

  const resetCreateForm = () => {
    setCPlatform('YouTube')
    setCTargetUser('')
    setCTargetPerEmployee('')
    setCAmountPerPerson('')
    setCMaxEmails('')
    setCExpireIn('')
    setCreateError('')
  }

  const validateCreate = () => {
    if (!adminId) return 'Missing adminId (not found in localStorage).'
    if (!cPlatform.trim()) return 'Platform is required.'
    if (Number(cTargetPerEmployee) < 0) return 'Target per employee must be ≥ 0.'
    if (Number(cAmountPerPerson) < 0) return 'Amount per person must be ≥ 0.'
    if (Number(cMaxEmails) < 0) return 'Max emails must be ≥ 0.'
    if ( Number(cExpireIn) < 1) return 'Expire (hrs) must be ≥ 1.'
    return ''
  }

  const handleCreate = async () => {
    setCreateError('')
    const msg = validateCreate()
    if (msg) {
      setCreateError(msg)
      return
    }
    try {
      setCreating(true)
      setNotice('')
      const payload: any = {
        adminId,
        platform: cPlatform,
        targetPerEmployee: Number(cTargetPerEmployee),
        amountPerPerson: Number(cAmountPerPerson),
        maxEmails: Number(cMaxEmails),
        expireIn: Number(cExpireIn),
      }
      if (cTargetUser.trim()) payload.targetUser = cTargetUser.trim()

      await api.post('/admin/emailtasks', payload)
      setOpenCreate(false)
      resetCreateForm()
      setNotice('Email task created.')
      // refresh to page 1 to surface the new task
      await fetchData({ page: 1 })
    } catch (e: any) {
      const em = e?.response?.data?.error || e?.message || 'Failed to create task.'
      setCreateError(em)
    } finally {
      setCreating(false)
    }
  }

  // ---- List Fetch ----
  const fetchData = async (opts?: Partial<{ page: number }>) => {
    const p = opts?.page ?? page
    setLoading(true)
    setError('')
    try {
      const body: any = {
        page: p,
        limit,
        sortBy,
        sortOrder,
      }
      if (adminId) body.adminId = adminId
      if (search.trim() !== '') body.search = search.trim()
      if (platform) body.platform = platform
      if (active !== '') body.active = active === 'true'

      const res = await api.post<ListResponse>('/admin/emailtasks/list', body)
      setRows(res.data.tasks)
      setTotal(res.data.total)
      setPage(res.data.page)
      setPages(res.data.pages)
    } catch (e: any) {
      setError('Failed to load email tasks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData({ page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, sortBy, sortOrder, platform, active])

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortOrder('asc')
    }
  }

  const SortIcon: React.FC<{ column: SortKey }> = ({ column }) => {
    if (sortBy !== column) return <ChevronDown className="inline h-4 w-4 opacity-30" />
    return sortOrder === 'asc' ? (
      <ChevronUp className="inline h-4 w-4" />
    ) : (
      <ChevronDown className="inline h-4 w-4" />
    )
  }

  const Pager: React.FC<{ page: number; pages: number; onChange: (n: number) => void }> = ({ page, pages, onChange }) => (
    <div className="flex items-center justify-center gap-2 py-3">
      <Button size="sm" variant="outline" disabled={page === 1} onClick={() => onChange(page - 1)}>
        Prev
      </Button>
      <span className="text-sm">Page {page} / {pages}</span>
      <Button size="sm" variant="outline" disabled={page === pages} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </div>
  )

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl sm:text-4xl font-bold">Email Tasks</h1>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64 lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search tasks (platform, creator, id, numbers)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') fetchData({ page: 1 })
              }}
              className="pl-10 w-full"
            />
          </div>

          <select
            className="rounded border px-3 py-2"
            value={platform}
            onChange={e => setPlatform(e.target.value)}
            aria-label="Platform"
          >
            {PlatformOptions.map(opt => (
              <option key={opt.label} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            className="rounded border px-3 py-2"
            value={active}
            onChange={e => setActive(e.target.value)}
            aria-label="Status"
          >
            {ActiveOptions.map(opt => (
              <option key={opt.label} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            className="rounded border px-3 py-2"
            value={String(limit)}
            onChange={e => setLimit(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {[10, 20, 50].map(n => (
              <option key={n} value={n}>{n}/page</option>
            ))}
          </select>

          <Button onClick={() => setOpenCreate(true)} className="whitespace-nowrap">
            <Plus className="h-4 w-4 mr-1" />
            Add Task
          </Button>
        </div>
      </div>

      {notice && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          {notice}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="text-center text-gray-500">No tasks found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full table-auto">
                <TableHeader className="bg-gray-100">
                  <TableRow>
                    <TH onClick={() => toggleSort('createdAt')} className="cursor-pointer">
                      Created <SortIcon column="createdAt" />
                    </TH>
                    <TH onClick={() => toggleSort('platform')} className="cursor-pointer">
                      Platform <SortIcon column="platform" />
                    </TH>
                    <TH>Target user handle</TH>
                    <TH onClick={() => toggleSort('targetPerEmployee')} className="cursor-pointer">
                      Target/Employee <SortIcon column="targetPerEmployee" />
                    </TH>
                    <TH onClick={() => toggleSort('amountPerPerson')} className="cursor-pointer">
                      Amount/Person <SortIcon column="amountPerPerson" />
                    </TH>
                    <TH onClick={() => toggleSort('maxEmails')} className="cursor-pointer">
                      Max Emails <SortIcon column="maxEmails" />
                    </TH>
                    <TH onClick={() => toggleSort('expireIn')} className="cursor-pointer">
                      Expire (hrs) <SortIcon column="expireIn" />
                    </TH>
                    <TH onClick={() => toggleSort('expiresAt')} className="cursor-pointer">
                      Expires At <SortIcon column="expiresAt" />
                    </TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((t) => (
                    <TableRow key={t._id} className="even:bg-gray-50">
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(t.createdAt), 'PPpp')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{t.platform}</TableCell>
                      <TableCell className="break-all">{t.targetUser ?? '—'}</TableCell>
                      <TableCell className="text-right">{t.targetPerEmployee}</TableCell>
                      <TableCell className="text-right">{t.amountPerPerson}</TableCell>
                      <TableCell className="text-right">{t.maxEmails}</TableCell>
                      <TableCell className="text-right">{t.expireIn}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(t.expiresAt), 'PPpp')}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            t.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {t.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/admin/email-tasks/view-task?id=${t._id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" /> View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pager page={page} pages={pages} onChange={(n) => fetchData({ page: n })} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={openCreate} onOpenChange={(o) => { setOpenCreate(o); if (!o) resetCreateForm() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Email Task</DialogTitle>
            <DialogDescription>Fill the details and create a new task.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            {!adminId && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Admin ID not found in localStorage. Creation will fail until it’s present.
              </div>
            )}

            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">Platform</label>
              <select
                className="rounded border px-3 py-2"
                value={cPlatform}
                onChange={(e) => setCPlatform(e.target.value)}
              >
                {PlatformOptions.filter(p => p.value !== '').map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">Target User (optional)</label>
              <Input
                placeholder="@handle or id"
                value={cTargetUser}
                onChange={(e) => setCTargetUser(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Target / Employee</label>
                <Input
                  type="number"
                  min={0}
                  value={cTargetPerEmployee}
                  onChange={(e) => setCTargetPerEmployee(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Amount / Person</label>
                <Input
                  type="number"
                  min={0}
                  value={cAmountPerPerson}
                  onChange={(e) => setCAmountPerPerson(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Max Emails</label>
                <Input
                  type="number"
                  min={0}
                  value={cMaxEmails}
                  onChange={(e) => setCMaxEmails(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Expire (hours)</label>
                <Input
                  type="number"
                  min={1}
                  value={cExpireIn}
                  onChange={(e) => setCExpireIn(e.target.value)}
                />
              </div>
            </div>

            {createError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {createError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenCreate(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminEmailTaskListPage
