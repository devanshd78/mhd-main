'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead as TH,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import api from '@/lib/axios'

interface Submission {
  name: string
  upiId: string
  amount: number
  notes: string
  createdAt: string
}

const PAGE_SIZE = 10

export default function SubmissionsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const linkId = searchParams.get('linkid')
  const empId = searchParams.get('empid')

  const [subs, setSubs] = useState<Submission[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [error, setError] = useState('')

  const fetchSubmissions = (p: number) => {
    if (!linkId) return
    setLoading(true)
    api.post('/admin/employees/links/entries', {
      linkId,
      employeeId:empId,
      page: p,
      limit: PAGE_SIZE,
    })
      .then(res => {
        setSubs(res.data.entries)
        setTotalAmount(res.data.totalAmount)
        setPage(res.data.page)
        setPages(res.data.pages)
      })
      .catch(() => setError('Failed to load submissions.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchSubmissions(1)
  }, [linkId])

  return (
    <div className="px-4 py-6">
      <Button variant="ghost" onClick={() => router.back()}>
        ← Back
      </Button>

      <h2 className="text-2xl font-semibold mt-4 mb-2">
        Entries for Link
      </h2>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : subs.length === 0 ? (
        <p className="text-gray-500">No submissions found.</p>
      ) : (
        <Card className="mt-4">
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader className="bg-gray-100">
                <TableRow>
                  <TH>Name</TH>
                  <TH>UPI ID</TH>
                  <TH>Notes</TH>
                  <TH className="text-right">Amount &amp; Date</TH>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s, i) => (
                  <TableRow key={i} className="even:bg-gray-50">
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="break-all">{s.upiId}</TableCell>
                    <TableCell className='text-center'>{s.notes || '-'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      ₹{s.amount.toFixed(2)}
                      <br />
                      {format(new Date(s.createdAt), 'PPpp')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>

          <div className="flex items-center justify-between p-4">
            <span className="font-semibold">
              Total: ₹{totalAmount.toFixed(2)}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => fetchSubmissions(page - 1)}
              >
                Prev
              </Button>
              <span className="text-sm">
                {page} / {pages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page === pages}
                onClick={() => fetchSubmissions(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
