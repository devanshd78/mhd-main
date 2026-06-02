'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  HomeIcon,
  IndianRupeeIcon,
  Loader2,
  PlusIcon,
  RefreshCcwIcon,
  TrashIcon,
  TrophyIcon,
  UsersIcon,
  HelpCircleIcon
} from 'lucide-react'
import api from '@/lib/axios'
import Swal from 'sweetalert2'
import { createPortal } from 'react-dom'

type ViewMode = 'videos' | 'employees' | 'users'
type UserStatusFilter = 'all' | 'Approved' | 'Partial' | 'Pending' | 'Not Started'
type UserSortKey =
  | 'status'
  | 'nameAsc'
  | 'verifiedDesc'
  | 'accountsDesc'
  | 'failedDesc'

interface AdminEmployee {
  _id: string
  name: string
  email: string
  employeeId: string
  balance?: number
  isApproved?: number
}

interface LikeTaskVideo {
  likeLinkId: string
  videoTitle: string
  videoUrl?: string
  thumbnail?: string
  totalTaskCount: number
  totalEmployeesWorking: number
  approvedCount: number
  pendingCount: number
  partialCount: number
  notStartedCount: number
  createdAt?: string
  expireAt?: string
}

interface LikeTaskEmployeeRow {
  employeeId: string
  employeeName: string
  email?: string
  totalUsers: number
  approvedCount: number
  pendingCount: number
  partialCount: number
  notStartedCount: number
}

interface LikeTaskUserRow {
  userId: string
  userName: string
  email?: string
  phone?: string | number
  accountsLinked: number
  verificationCount: number
  requiredLikes: number
  failedLikes: number
  status: 'Approved' | 'Pending' | 'Partial' | 'Not Started' | string
}

interface PerformanceResponse {
  employee: {
    employeeId: string
    employeeName: string
    email?: string
  }
  period: {
    startDate: string
    endDate: string
  }
  totalVideos: number
  totalApprovedActiveUsers: number
  averageActiveUsers: number
  applicableBonusSlab: string
  bonusRate: number
  totalBonus: number
  videoBreakdown?: {
    likeLinkId: string
    videoTitle: string
    videoUrl?: string
    thumbnail?: string
    approvedActiveUsers: number
  }[]
}

/**
 * If your backend mounted these under /admin, change these paths to:
 * /admin/like-task/videos
 * /admin/like-task/video/employees
 * /admin/like-task/video/employee/users
 * /admin/like-task/performance
 */
const ENDPOINTS = {
  videos: '/like-task/videos',
  videoEmployees: '/like-task/video/employees',
  employeeUsers: '/like-task/video/employee/users',
  performance: '/like-task/performance',
}

const fmtINR = (n: number | string | undefined | null) =>
  `₹${Number(n || 0).toLocaleString('en-IN')}`

const fmtDate = (value?: string) => {
  if (!value) return '-'

  const d = new Date(value)

  if (Number.isNaN(d.getTime())) return '-'

  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const toDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const getDefaultBonusRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)

  return {
    startDate: toDateInput(start),
    endDate: toDateInput(now),
  }
}

const normalizeUserStatus = (
  status?: string
): 'Approved' | 'Partial' | 'Pending' | 'Not Started' => {
  if (status === 'Approved') return 'Approved'
  if (status === 'Partial') return 'Partial'
  if (status === 'Pending') return 'Pending'
  return 'Not Started'
}

const getUserStatusRank = (status?: string) => {
  const normalized = normalizeUserStatus(status)

  if (normalized === 'Approved') return 0
  if (normalized === 'Partial') return 1
  if (normalized === 'Pending') return 2
  return 3
}

const getUserStatusFilterLabel = (filter: UserStatusFilter) => {
  if (filter === 'Approved') return 'Approved'
  if (filter === 'Partial') return 'Partial'
  if (filter === 'Pending') return 'Pending'
  if (filter === 'Not Started') return 'Not Started'
  return 'All'
}

const getUserSortLabel = (sort: UserSortKey) => {
  if (sort === 'nameAsc') return 'Name A-Z'
  if (sort === 'verifiedDesc') return 'Verified High-Low'
  if (sort === 'accountsDesc') return 'Accounts High-Low'
  if (sort === 'failedDesc') return 'Failed High-Low'
  return 'Status: Approved → Partial → Pending → Not Started'
}

const statusBadge = (status: string) => {
  if (status === 'Approved') {
    return <Badge className="bg-green-600 text-white">Approved</Badge>
  }

  if (status === 'Partial') {
    return <Badge className="bg-amber-500 text-white">Partial</Badge>
  }

  if (status === 'Pending') {
    return (
      <Badge variant="outline" className="bg-yellow-400 text-black">
        Pending
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="bg-gray-100 text-gray-700">
      Not Started
    </Badge>
  )
}

const getPerformanceLabel = (performance?: PerformanceResponse | null) => {
  if (!performance) return 'No performance data yet'

  const avg = Number(performance.averageActiveUsers || 0)

  if (avg < 90) return 'Below target'
  if (avg <= 120) return 'Eligible for ₹20/user bonus'

  return 'Eligible for ₹25/user bonus'
}

export default function LikeTaskModulePage() {
  const router = useRouter()
  const defaultRange = useMemo(() => getDefaultBonusRange(), [])

  const [viewMode, setViewMode] = useState<ViewMode>('videos')
  const [loading, setLoading] = useState(false)
  const [performanceLoading, setPerformanceLoading] = useState(false)
  const [error, setError] = useState('')

  const [videos, setVideos] = useState<LikeTaskVideo[]>([])
  const [employees, setEmployees] = useState<LikeTaskEmployeeRow[]>([])
  const [users, setUsers] = useState<LikeTaskUserRow[]>([])

  const [selectedVideo, setSelectedVideo] = useState<LikeTaskVideo | null>(null)
  const [selectedEmployee, setSelectedEmployee] =
    useState<LikeTaskEmployeeRow | null>(null)

  const [adminEmployees, setAdminEmployees] = useState<AdminEmployee[]>([])
  const [dashboardEmployeeId, setDashboardEmployeeId] = useState('')
  const [bonusStartDate, setBonusStartDate] = useState(defaultRange.startDate)
  const [bonusEndDate, setBonusEndDate] = useState(defaultRange.endDate)
  const [performance, setPerformance] = useState<PerformanceResponse | null>(
    null
  )
  const [performanceError, setPerformanceError] = useState('')

  const [query, setQuery] = useState('')
  const [userStatusFilter, setUserStatusFilter] =
    useState<UserStatusFilter>('all')
  const [userSortKey, setUserSortKey] = useState<UserSortKey>('status')

  const [isOpen, setIsOpen] = useState(false)
  const [creatingLink, setCreatingLink] = useState(false)

  const [linkTitle, setLinkTitle] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [target, setTarget] = useState('')
  const [amount, setAmount] = useState('')
  const [expireIn, setExpireIn] = useState('')

  const selectedDashboardEmployee = useMemo(() => {
    return (
      adminEmployees.find((emp) => emp.employeeId === dashboardEmployeeId) ||
      null
    )
  }, [adminEmployees, dashboardEmployeeId])

  const resetModal = () => {
    setLinkTitle('')
    setVideoUrl('')
    setTarget('')
    setAmount('')
    setExpireIn('')
  }

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return videos

    return videos.filter((video) =>
      [
        video.videoTitle,
        video.videoUrl || '',
        String(video.totalTaskCount),
        String(video.approvedCount),
        String(video.pendingCount),
        String(video.partialCount),
        String(video.notStartedCount || 0),
      ].some((v) => String(v).toLowerCase().includes(q))
    )
  }, [videos, query])

  const filteredEmployees = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return employees

    return employees.filter((emp) =>
      [
        emp.employeeName,
        emp.email || '',
        emp.employeeId,
        String(emp.totalUsers),
        String(emp.approvedCount),
        String(emp.pendingCount),
        String(emp.partialCount),
        String(emp.notStartedCount || 0),
      ].some((v) => String(v).toLowerCase().includes(q))
    )
  }, [employees, query])

  const userStatusCounts = useMemo<Record<UserStatusFilter, number>>(() => {
    return users.reduce(
      (acc, user) => {
        const status = normalizeUserStatus(user.status)

        acc.all += 1

        if (status === 'Approved') acc.Approved += 1
        else if (status === 'Partial') acc.Partial += 1
        else if (status === 'Pending') acc.Pending += 1
        else acc['Not Started'] += 1

        return acc
      },
      {
        all: 0,
        Approved: 0,
        Partial: 0,
        Pending: 0,
        'Not Started': 0,
      }
    )
  }, [users])

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()

    const searched = users.filter((user) => {
      const matchesSearch = !q
        ? true
        : [
          user.userName,
          user.email || '',
          user.userId,
          String(user.phone || ''),
          String(user.accountsLinked),
          String(user.verificationCount),
          String(user.requiredLikes),
          String(user.failedLikes),
          user.status,
        ].some((v) => String(v).toLowerCase().includes(q))

      const normalizedStatus = normalizeUserStatus(user.status)

      const matchesStatus =
        userStatusFilter === 'all' || normalizedStatus === userStatusFilter

      return matchesSearch && matchesStatus
    })

    return [...searched].sort((a, b) => {
      const statusDiff =
        getUserStatusRank(a.status) - getUserStatusRank(b.status)

      if (userSortKey === 'status') {
        if (statusDiff !== 0) return statusDiff

        return String(a.userName || a.email || a.userId || '').localeCompare(
          String(b.userName || b.email || b.userId || '')
        )
      }

      if (userSortKey === 'nameAsc') {
        return String(a.userName || a.email || a.userId || '').localeCompare(
          String(b.userName || b.email || b.userId || '')
        )
      }

      if (userSortKey === 'verifiedDesc') {
        const diff =
          Number(b.verificationCount || 0) - Number(a.verificationCount || 0)

        if (diff !== 0) return diff
        return statusDiff
      }

      if (userSortKey === 'accountsDesc') {
        const diff =
          Number(b.accountsLinked || 0) - Number(a.accountsLinked || 0)

        if (diff !== 0) return diff
        return statusDiff
      }

      if (userSortKey === 'failedDesc') {
        const diff = Number(b.failedLikes || 0) - Number(a.failedLikes || 0)

        if (diff !== 0) return diff
        return statusDiff
      }

      return statusDiff
    })
  }, [users, query, userStatusFilter, userSortKey])

  const loadAdminEmployees = async () => {
    try {
      const res = await api.get<AdminEmployee[]>('/admin/employees', {
        withCredentials: true,
      })

      const rows = Array.isArray(res.data) ? res.data : []

      setAdminEmployees(rows)
    } catch (err) {
      console.error('Failed to load employees', err)
    }
  }

  const loadVideos = async () => {
    try {
      setLoading(true)
      setError('')

      const res = await api.post(ENDPOINTS.videos, {}, { withCredentials: true })

      setVideos(res.data?.videos || [])
      setViewMode('videos')
      setSelectedVideo(null)
      setSelectedEmployee(null)
      setEmployees([])
      setUsers([])
      setUserStatusFilter('all')
      setUserSortKey('status')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load like task videos.')
    } finally {
      setLoading(false)
    }
  }

  const loadPerformance = async (
    employeeIdValue = dashboardEmployeeId,
    startDateValue = bonusStartDate,
    endDateValue = bonusEndDate
  ) => {
    if (!employeeIdValue) {
      Swal.fire('Missing employee', 'Please select employee.', 'warning')
      return
    }

    if (!startDateValue || !endDateValue) {
      Swal.fire('Missing date range', 'Please select both start and end dates.', 'warning')
      return
    }

    const start = new Date(startDateValue)
    const end = new Date(endDateValue)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      Swal.fire('Invalid date range', 'Please select a valid date range.', 'error')
      return
    }

    if (start.getTime() > end.getTime()) {
      Swal.fire('Invalid date range', 'Start date cannot be after end date.', 'error')
      return
    }

    try {
      setPerformanceLoading(true)
      setPerformanceError('')

      const res = await api.post(
        ENDPOINTS.performance,
        {
          employeeId: employeeIdValue,
          startDate: startDateValue,
          endDate: endDateValue,
        },
        { withCredentials: true }
      )

      setPerformance(res.data)
    } catch (err: any) {
      setPerformance(null)
      setPerformanceError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Failed to calculate employee performance.'
      )
    } finally {
      setPerformanceLoading(false)
    }
  }

  useEffect(() => {
    loadVideos()
    loadAdminEmployees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (dashboardEmployeeId) {
      loadPerformance(dashboardEmployeeId, bonusStartDate, bonusEndDate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardEmployeeId])

  const openVideoEmployees = async (video: LikeTaskVideo) => {
    try {
      setLoading(true)
      setError('')

      const res = await api.post(
        ENDPOINTS.videoEmployees,
        { likeLinkId: video.likeLinkId },
        { withCredentials: true }
      )

      setSelectedVideo(video)
      setSelectedEmployee(null)
      setEmployees(res.data?.employees || [])
      setUsers([])
      setUserStatusFilter('all')
      setUserSortKey('status')
      setViewMode('employees')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load employees for video.')
    } finally {
      setLoading(false)
    }
  }

  const openEmployeeUsers = async (employee: LikeTaskEmployeeRow) => {
    if (!selectedVideo) return

    try {
      setLoading(true)
      setError('')

      const res = await api.post(
        ENDPOINTS.employeeUsers,
        {
          likeLinkId: selectedVideo.likeLinkId,
          employeeId: employee.employeeId,
        },
        { withCredentials: true }
      )

      setSelectedEmployee(employee)
      setUsers(res.data?.users || [])
      setUserStatusFilter('all')
      setUserSortKey('status')
      setViewMode('users')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load users for employee.')
    } finally {
      setLoading(false)
    }
  }

  const applyBonusDateRange = () => {
    loadPerformance(dashboardEmployeeId, bonusStartDate, bonusEndDate)
  }

  const resetBonusDateRange = () => {
    const range = getDefaultBonusRange()

    setBonusStartDate(range.startDate)
    setBonusEndDate(range.endDate)

    loadPerformance(dashboardEmployeeId, range.startDate, range.endDate)
  }

  const handleCreateLikeLink = () => {
    setCreatingLink(true)
    setError('')

    const adminId = localStorage.getItem('adminId') || ''

    api
      .post('/admin/likelinks', {
        title: linkTitle,
        videoUrl: videoUrl.trim(),
        adminId,
        target: Number(target),
        amount: Number(amount),
        expireIn: Number(expireIn),
        requireLike: true,
      })
      .then(async () => {
        setIsOpen(false)
        resetModal()
        await loadVideos()
        Swal.fire('Created', 'Like task created successfully.', 'success')
      })
      .catch((err) => {
        setError(
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          'Failed to create like task.'
        )
      })
      .finally(() => {
        setCreatingLink(false)
      })
  }

  const handleDeleteLikeLink = (likeLinkId: string) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will delete the like task and related entries.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
    }).then((result) => {
      if (!result.isConfirmed) return

      api
        .post('/admin/likelinks/delete', { linkId: likeLinkId })
        .then(async () => {
          await loadVideos()
          Swal.fire({
            title: 'Deleted!',
            text: 'The like task has been deleted.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
          })
        })
        .catch(() => {
          Swal.fire('Error!', 'Failed to delete like task.', 'error')
        })
    })
  }

  const goBackOneLevel = () => {
    if (viewMode === 'users') {
      setViewMode('employees')
      setUsers([])
      setSelectedEmployee(null)
      setUserStatusFilter('all')
      setUserSortKey('status')
      return
    }

    if (viewMode === 'employees') {
      setViewMode('videos')
      setEmployees([])
      setSelectedVideo(null)
      setUsers([])
      setSelectedEmployee(null)
      setUserStatusFilter('all')
      setUserSortKey('status')
    }
  }

  const InfoTooltip = ({ text }: { text: string }) => {
    const iconRef = useRef<HTMLSpanElement | null>(null)
    const [open, setOpen] = useState(false)
    const [style, setStyle] = useState<React.CSSProperties>({})

    const updatePosition = () => {
      if (!iconRef.current) return

      const rect = iconRef.current.getBoundingClientRect()
      const tooltipWidth = 280
      const gap = 10

      let left = rect.left + rect.width / 2 - tooltipWidth / 2
      let top = rect.bottom + gap

      if (left < 12) left = 12
      if (left + tooltipWidth > window.innerWidth - 12) {
        left = window.innerWidth - tooltipWidth - 12
      }

      const estimatedHeight = 90
      if (top + estimatedHeight > window.innerHeight - 12) {
        top = rect.top - estimatedHeight - gap
      }

      setStyle({
        position: 'fixed',
        top,
        left,
        width: tooltipWidth,
        zIndex: 999999,
      })
    }

    const showTooltip = () => {
      updatePosition()
      setOpen(true)
    }

    const hideTooltip = () => {
      setOpen(false)
    }

    useEffect(() => {
      if (!open) return

      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)

      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }, [open])

    return (
      <>
        <span
          ref={iconRef}
          className="inline-flex"
          onMouseEnter={showTooltip}
          onMouseLeave={hideTooltip}
          onFocus={showTooltip}
          onBlur={hideTooltip}
        >
          <HelpCircleIcon className="h-4 w-4 text-gray-400 cursor-help hover:text-gray-600" />
        </span>

        {open &&
          createPortal(
            <div
              style={style}
              className="pointer-events-none rounded-lg border bg-white px-3 py-2 text-xs leading-relaxed text-gray-700 shadow-2xl"
            >
              {text}
            </div>,
            document.body
          )}
      </>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Like Task Module</h1>
          <p className="text-sm text-gray-500 mt-1">
            Like Tasks
            {selectedVideo ? ` / ${selectedVideo.videoTitle}` : ''}
            {selectedEmployee ? ` / ${selectedEmployee.employeeName}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewMode !== 'videos' && (
            <Button variant="outline" onClick={goBackOneLevel}>
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}

          <Button variant="outline" onClick={loadVideos}>
            <RefreshCcwIcon className="h-4 w-4 mr-1" />
            Refresh
          </Button>

          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open)
              if (!open) resetModal()
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <PlusIcon className="h-4 w-4 mr-1" />
                New Like Task
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Like Task</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <Input
                  placeholder="Like task title"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  disabled={creatingLink}
                />

                <Input
                  type="url"
                  placeholder="YouTube video URL"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  disabled={creatingLink}
                />

                <Input
                  type="number"
                  placeholder="Required linked accounts / likes, e.g. 5 or 10"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  disabled={creatingLink}
                />

                <Input
                  type="number"
                  placeholder="Amount per user, e.g. 20 or 40"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={creatingLink}
                />

                <Input
                  type="number"
                  placeholder="Expire in hours"
                  value={expireIn}
                  onChange={(e) => setExpireIn(e.target.value)}
                  disabled={creatingLink}
                />

                <div className="border rounded-xl p-3 bg-gray-50">
                  <p className="text-sm font-semibold">Like rule</p>
                  <p className="text-xs text-gray-500 mt-1">
                    A user is active only when all required linked account likes are Approved.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsOpen(false)
                    resetModal()
                  }}
                  disabled={creatingLink}
                >
                  Cancel
                </Button>

                <Button
                  onClick={handleCreateLikeLink}
                  disabled={
                    !linkTitle ||
                    !videoUrl ||
                    !target ||
                    !amount ||
                    !expireIn ||
                    creatingLink
                  }
                >
                  {creatingLink ? 'Creating…' : 'Create Like Task'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={() => router.push('/admin/dashboard')}>
            <HomeIcon className="h-4 w-4 mr-1" />
            Dashboard
          </Button>
        </div>
      </div>

      {/* Performance Dashboard */}
      <Card className="p-5 space-y-5 border bg-white shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Employee
              </label>

              <select
                value={dashboardEmployeeId}
                onChange={(e) => {
                  setDashboardEmployeeId(e.target.value)
                  setPerformance(null)
                  setPerformanceError('')
                }}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select employee</option>

                {adminEmployees.map((emp) => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                From Date
              </label>

              <Input
                type="date"
                value={bonusStartDate}
                onChange={(e) => {
                  setBonusStartDate(e.target.value)
                  setPerformance(null)
                  setPerformanceError('')
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                To Date
              </label>

              <Input
                type="date"
                value={bonusEndDate}
                onChange={(e) => {
                  setBonusEndDate(e.target.value)
                  setPerformance(null)
                  setPerformanceError('')
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={applyBonusDateRange}
              disabled={performanceLoading || !dashboardEmployeeId}
            >
              {performanceLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : null}
              Apply Date Range
            </Button>
          </div>
        </div>

        {performanceLoading ? (
          <Card className="p-8 border bg-gray-50 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-500" />
            <p className="text-sm text-gray-500 mt-2">
              Calculating performance...
            </p>
          </Card>
        ) : performanceError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {performanceError}
          </div>
        ) : performance ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-1 xl:grid-cols-3 2xl:grid-cols-3 gap-4">
              <Card className="p-5 border bg-gray-50 gap-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-muted-foreground">
                      Average Active Users
                    </p>
                    <InfoTooltip text="Average active users = total approved active users divided by total videos counted in the selected date range." />
                  </div>
                  <UsersIcon className="h-4 w-4 text-gray-500" />
                </div>

                <p className="text-3xl font-semibold mt-2">
                  {performance.averageActiveUsers}
                </p>
              </Card>

              <Card className="p-5 border bg-white gap-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-muted-foreground">Videos Counted</p>
                    <InfoTooltip text="Total like-task videos included in the selected date range for this employee." />
                  </div>
                  <UsersIcon className="h-4 w-4 text-gray-500" />
                </div>

                <p className="text-2xl font-semibold mt-2">
                  {performance.totalVideos}
                </p>
              </Card>

              <Card className="p-5 border bg-green-50 border-green-200 gap-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-green-700">Total Bonus</p>
                    <InfoTooltip text="Total bonus is calculated by multiplying average active users with the applicable bonus rate." />
                  </div>
                  <IndianRupeeIcon className="h-4 w-4 text-green-700" />
                </div>

                <p className="text-3xl font-semibold text-green-700 mt-2">
                  {fmtINR(performance.totalBonus)}
                </p>

                <div className="rounded-lg border border-green-200 bg-white/70 px-3 py-2 text-xs text-green-800 space-y-1">
                  <p className="text-green-700">
                    {performance.applicableBonusSlab}
                  </p>
                </div>
              </Card>
            </div>

            {performance.videoBreakdown?.length ? (
              <Card className="p-4 border bg-gray-50 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      Video Performance Breakdown
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Approved active users counted per like task video.
                    </p>
                  </div>

                  <Badge variant="outline" className="bg-white">
                    {performance.videoBreakdown.length} video
                    {performance.videoBreakdown.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className="max-h-56 overflow-y-auto divide-y rounded-lg border bg-white">
                  {performance.videoBreakdown.map((video) => (
                    <div
                      key={video.likeLinkId}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {video.videoTitle}
                        </p>

                        {video.videoUrl ? (
                          <a
                            href={video.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 underline inline-flex items-center gap-1"
                          >
                            Open Video
                            <ExternalLinkIcon className="h-3 w-3" />
                          </a>
                        ) : null}
                      </div>

                      <Badge className="bg-green-600 text-white shrink-0">
                        {video.approvedActiveUsers} active
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}
      </Card>

      {/* Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Input
          placeholder="Search current table..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      )}

      {/* Level 1 — Video List */}
      {!loading && viewMode === 'videos' && (
        <Card className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[70%]">
                  Video
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVideos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                    No like task videos found.
                  </td>
                </tr>
              ) : (
                filteredVideos.map((video) => (
                  <tr key={video.likeLinkId} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3 min-w-[300px]">
                        {video.thumbnail ? (
                          <img
                            src={video.thumbnail}
                            alt={video.videoTitle}
                            className="w-24 h-14 rounded object-cover border"
                          />
                        ) : (
                          <div className="w-24 h-14 rounded bg-gray-100 border" />
                        )}

                        <div className="min-w-0">
                          <p className="font-medium break-words">
                            {video.videoTitle}
                          </p>

                          {video.videoUrl && (
                            <a
                              href={video.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 underline inline-flex items-center gap-1 break-all"
                            >
                              Open Video
                              <ExternalLinkIcon className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {fmtDate(video.createdAt)}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openVideoEmployees(video)}
                        >
                          View Employees
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500"
                          onClick={() => handleDeleteLikeLink(video.likeLinkId)}
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Level 2 — Employee List */}
      {!loading && viewMode === 'employees' && selectedVideo && (
        <Card className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Employee
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Total Users
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Approved
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Pending
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Partial
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Not Started
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    No employees found for this video.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <p className="font-medium">{emp.employeeName}</p>
                      {emp.email && (
                        <p className="text-xs text-gray-500">{emp.email}</p>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center">{emp.totalUsers}</td>

                    <td className="px-4 py-4 text-center text-green-700 font-medium">
                      {emp.approvedCount}
                    </td>

                    <td className="px-4 py-4 text-center text-yellow-700 font-medium">
                      {emp.pendingCount}
                    </td>

                    <td className="px-4 py-4 text-center text-amber-700 font-medium">
                      {emp.partialCount}
                    </td>

                    <td className="px-4 py-4 text-center text-gray-600 font-medium">
                      {emp.notStartedCount || 0}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEmployeeUsers(emp)}
                      >
                        View Users
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Level 3 — User Filters */}
      {!loading && viewMode === 'users' && selectedVideo && selectedEmployee && (
        <Card className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                Users for {selectedEmployee.employeeName}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {(['all', 'Approved', 'Partial', 'Pending', 'Not Started'] as UserStatusFilter[]).map(
                (filter) => (
                  <Button
                    key={filter}
                    size="sm"
                    variant={userStatusFilter === filter ? 'default' : 'outline'}
                    onClick={() => setUserStatusFilter(filter)}
                  >
                    {getUserStatusFilterLabel(filter)}
                    <Badge
                      variant={userStatusFilter === filter ? 'secondary' : 'outline'}
                      className={
                        userStatusFilter === filter
                          ? 'ml-2 bg-white/20 text-current'
                          : 'ml-2 bg-white'
                      }
                    >
                      {userStatusCounts[filter]}
                    </Badge>
                  </Button>
                )
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Level 3 — User List */}
      {!loading && viewMode === 'users' && selectedVideo && selectedEmployee && (
        <Card className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  User
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Accounts Linked
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Approved
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Required
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Failed
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    No users found for this filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <p className="font-medium">
                        {user.userName || user.email || 'Unknown User'}
                      </p>

                      {user.email && (
                        <p className="text-xs text-gray-500 break-all mt-1">
                          {user.email}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {user.accountsLinked}
                    </td>

                    <td className="px-4 py-4 text-center text-green-700 font-medium">
                      {user.verificationCount}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {user.requiredLikes}
                    </td>

                    <td className="px-4 py-4 text-center text-red-700 font-medium">
                      {user.failedLikes}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {statusBadge(user.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
