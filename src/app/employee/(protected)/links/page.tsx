'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import api from '@/lib/axios'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Loader2, PlusIcon } from 'lucide-react'

interface Submission {
  _id: string
  name: string
  upiId: string
  notes: string
  amount: number
  createdAt: string
}

const PAGE_SIZE = 10

export default function LinkEntriesPage() {
  const params = useSearchParams()
  const router = useRouter()
  const linkId = params.get('id')
  const employeeId =
    (typeof window !== 'undefined' && localStorage.getItem('employeeId')) || ''

  const [subs, setSubs] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totalAmount, setTotalAmount] = useState(0)
  const [isLatest, setIsLatest] = useState(false)

  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    qrFile: File | null
    upiId: string
    notes: string
    amount: string
  }>({
    name: '',
    qrFile: null,
    upiId: '',
    notes: '',
    amount: '',
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false) // State to handle button disable

  // Fetch a given page of entries
  const fetchEntries = async (p = 1) => {
    if (!linkId || !employeeId) return

    setLoading(true)
    setError('')
    try {
      const { data } = await api.post<{
        entries: Submission[]
        totalAmount: number
        isLatest: boolean
        page: number
        pages: number
      }>(
        '/employee/links/entries',
        { linkId, employeeId, page: p, limit: PAGE_SIZE },
        { withCredentials: true }
      )

      setSubs(data.entries)
      setTotalAmount(data.totalAmount)
      setIsLatest(data.isLatest)
      setPage(data.page)
      setPages(data.pages)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load entries.')
    } finally {
      setLoading(false)
    }
  }

  // Load on mount and when linkId changes
  useEffect(() => {
    fetchEntries(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId, employeeId])

  // Handle text inputs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Handle form submit with QR image
  const handleSubmit = async () => {
    if (!linkId || !employeeId) return
    setError('')
    if (isSubmitting) return // Prevent submission if already submitting

    if (!formData.qrFile && !formData.upiId.trim()) {
      setError('Please upload a QR image or enter a UPI ID.')
      return
    }

    const fd = new FormData()
    fd.append('name', formData.name)
    fd.append('amount', formData.amount)
    fd.append('employeeId', employeeId)

    if (formData.qrFile) {
      fd.append('qrImage', formData.qrFile)
    } else {
      fd.append('upiId', formData.upiId.trim())
    }

    if (formData.notes) {
      fd.append('notes', formData.notes)
    }

    setIsSubmitting(true) // Disable the submit button

    try {
      await api.post(`/employee/links/${linkId}/entries`, fd, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setFormData({ name: '', qrFile: null, upiId: '', notes: '', amount: '' })
      setShowForm(false)
      fetchEntries(page)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit entry.')
    } finally {
      setIsSubmitting(false) // Enable submit button after completion
    }
  }

  // Simple pager UI
  const Pager = () =>
    pages > 1 ? (
      <div className="flex items-center justify-center gap-4 py-4">
        <Button
          size="sm"
          variant="outline"
          disabled={page === 1}
          onClick={() => fetchEntries(page - 1)}
        >
          Prev
        </Button>
        <span className="text-sm">
          Page {page} of {pages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page === pages}
          onClick={() => fetchEntries(page + 1)}
        >
          Next
        </Button>
      </div>
    ) : null

  if (!linkId) {
    return (
      <p className="text-red-500 text-center mt-10">
        No link selected.
      </p>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Entries for Link</h2>
        <Button
          variant="outline"
          onClick={() => router.push('/employee/dashboard')}
        >
          Go Home
        </Button>
      </div>

      {/* Add entry button (latest link only) */}
      {isLatest && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="h-4 w-4" />
              Add Entry
            </Button>
          </DialogTrigger>

          <DialogPortal>
            <DialogOverlay className="fixed inset-0 bg-black/50" />
            <DialogContent className="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-2xl shadow-lg">
              <DialogHeader>
                <DialogTitle>New Submission</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Name */}
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="User Name"
                />

                {/* QR Code Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload QR Code (optional)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer text-sm text-gray-600 hover:bg-gray-100 transition">
                      <span className="block truncate">
                        {formData.qrFile ? formData.qrFile.name : 'Choose QR image...'}
                      </span>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0] || null
                          setFormData(f => ({ ...f, qrFile: file }))
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    OR enter UPI ID manually below.
                  </p>
                </div>

                {/* Manual UPI ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    UPI ID (if no QR)
                  </label>
                  <Input
                    name="upiId"
                    value={formData.upiId}
                    onChange={handleChange}
                    placeholder="example@upi"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <Input
                    name="amount"
                    type="number"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="Enter amount"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <Input
                    name="notes"
                    value={formData.notes}
                    onChange={e => {
                      if (e.target.value.length <= 50) {
                        setFormData(f => ({ ...f, notes: e.target.value }))
                      }
                    }}
                    placeholder="Additional comments or remarks (max 50 characters)"
                  />
                </div>

                {/* Error Display */}
                {error && <p className="text-red-500 text-sm">{error}</p>}
              </div>

              <DialogFooter className="mt-6 flex justify-end space-x-2">
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </Button>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      )}

      {/* Entries table or loader/error */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <>
          <Table>
            <TableHeader className="bg-gray-100">
              <TableRow>
                <TH>Name</TH>
                <TH>UPI ID</TH>
                <TH>Notes</TH>
                <TH className="text-right">Amount &amp; Date</TH>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map(s => (
                <TableRow key={s._id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.upiId}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-gray-700">
                    {s.notes || '-'}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    ₹{s.amount.toFixed(2)}
                    <br />
                    {format(new Date(s.createdAt), 'PPpp')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pager />

          <div className="text-right text-lg font-semibold pt-2">
            Paid Total: ₹{totalAmount.toFixed(2)}
          </div>
        </>
      )}
    </div>
  )
}
