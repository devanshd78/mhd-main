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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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

// ---- NEW: Country type from /admin/countries ----
interface Country {
  name: string
  alpha2: string
  alpha3: string
  numeric: string
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
  const [countryOpen, setCountryOpen] = useState(false)
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

  // ---- NEW: Countries state ----
  const [countries, setCountries] = useState<Country[]>([])
  const [countriesLoading, setCountriesLoading] = useState(false)
  const [countriesError, setCountriesError] = useState('')
  const [countrySearch, setCountrySearch] = useState('')
  const [cCountries, setCCountries] = useState<string[]>([]) // store alpha2 codes

  const resetCreateForm = () => {
    setCPlatform('YouTube')
    setCTargetUser('')
    setCTargetPerEmployee('')
    setCAmountPerPerson('')
    setCMaxEmails('')
    setCExpireIn('')
    setCCountries([])
    setCountrySearch('')
    setCreateError('')
  }

const fetchCountries = async () => {
  try {
    setCountriesLoading(true)
    setCountriesError('')

    const res = await api.get('/admin/countries')

    // support: [..] OR { countries: [..] } OR { data: [..] }
    const list =
      (Array.isArray(res.data) && res.data) ||
      (Array.isArray((res.data as any)?.countries) && (res.data as any).countries) ||
      (Array.isArray((res.data as any)?.data) && (res.data as any).data) ||
      []

    setCountries(list)
  } catch (e: any) {
    setCountriesError(e?.response?.data?.error || 'Failed to load countries.')
    setCountries([])
  } finally {
    setCountriesLoading(false)
  }
}

  useEffect(() => {
      fetchCountries()
  }, [])

const toggleCountry = (alpha2: string) => {
  const code = (alpha2 || '').toLowerCase()
  setCCountries(prev =>
    prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
  )
}

const selectedCountryNames = useMemo(() => {
  const map = new Map(countries.map(c => [c.alpha2.toLowerCase(), c.name]))
  return cCountries.map(code => map.get(code) || code)
}, [countries, cCountries])

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase()
    if (!q) return countries
    return countries.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.alpha2.toLowerCase().includes(q) ||
      c.alpha3.toLowerCase().includes(q) ||
      c.numeric.toLowerCase().includes(q)
    )
  }, [countries, countrySearch])

  const validateCreate = () => {
    if (!adminId) return 'Missing adminId (not found in localStorage).'
    if (!cPlatform.trim()) return 'Platform is required.'
    if (cCountries.length === 0) return 'Select at least one country.'
    if (Number(cTargetPerEmployee) < 0) return 'Target per employee must be ≥ 0.'
    if (Number(cAmountPerPerson) < 0) return 'Amount per person must be ≥ 0.'
    if (Number(cMaxEmails) < 0) return 'Max emails must be ≥ 0.'
    if (Number(cExpireIn) < 1) return 'Expire (hrs) must be ≥ 1.'
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
        countries: cCountries, // <-- alpha2 list (e.g., ["IN","US"])
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
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t.status === 'active'
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

            {/* ---- Countries selector using Command (searchable) ---- */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs text-muted-foreground">Countries</label>
                <span className="text-[11px] text-muted-foreground">
                  Selected: {cCountries.length}
                </span>
              </div>

              {countriesLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading countries...
                </div>
              ) : countriesError ? (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {countriesError}{' '}
                  <button className="underline" type="button" onClick={fetchCountries}>
                    Retry
                  </button>
                </div>
              ) : (
                <>
<Popover open={countryOpen} onOpenChange={setCountryOpen}>
  <PopoverTrigger asChild>
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={countryOpen}
      className="w-full justify-between"
    >
      {cCountries.length === 0
        ? 'Select countries...'
        : `${selectedCountryNames[0]}${cCountries.length > 1 ? ` +${cCountries.length - 1}` : ''}`}
      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
    </Button>
  </PopoverTrigger>

  {/* IMPORTANT: z-index higher than Dialog overlay */}
  <PopoverContent className="z-[200] w-full p-0 sm:w-[420px]" align="start">
    <Command>
      <CommandInput placeholder="Search country (name / alpha2 / alpha3)..." />
      <CommandList className="max-h-60 overflow-y-auto">
        <CommandEmpty>No country found.</CommandEmpty>

        <CommandGroup heading="Countries">
          {cCountries.length > 0 && (
            <CommandItem
              value="__clear__"
              onSelect={() => setCCountries([])}
              className="text-red-600"
            >
              Clear selection
            </CommandItem>
          )}

          {countries.map((c) => {
            const code = c.alpha2.toLowerCase()
            const checked = cCountries.includes(code)

            return (
              <CommandItem
                key={c.alpha2}
                value={`${c.name} ${c.alpha2} ${c.alpha3} ${c.numeric}`}
                onSelect={() => toggleCountry(c.alpha2)}
              >
                <Check className={cn('mr-2 h-4 w-4', checked ? 'opacity-100' : 'opacity-0')} />
                <span className="flex-1">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.alpha2}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>

                  {/* Selected country chips */}
                  {cCountries.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {cCountries.map((code) => {
                        const name = countries.find((x) => x.alpha2 === code)?.name || code
                        return (
                          <Badge key={code} variant="secondary" className="gap-1">
                            {name} ({code})
                            <button
                              type="button"
                              onClick={() => toggleCountry(code)}
                              className="ml-1 rounded hover:opacity-70"
                              aria-label={`Remove ${name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
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
            <Button onClick={handleCreate} disabled={creating || countriesLoading}>
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