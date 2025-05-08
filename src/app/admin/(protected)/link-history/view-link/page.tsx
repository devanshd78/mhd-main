'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import api from '@/lib/axios'
import {
  Table, TableHeader, TableBody, TableRow,
  TableHead as TH, TableCell,
} from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Row {
  employeeId: string
  name: string
  entryCount: number
  employeeTotal: number
}

export default function ViewLinkPage() {
  const params = useSearchParams()
  const router = useRouter()
  const linkId = params.get('id')

  const [rows, setRows] = useState<Row[]>([])
  const [grand, setGrand] = useState(0)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [buttonLoadingId, setButtonLoadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!linkId) return
    setLoading(true)
    api.post<{ rows: Row[]; grandTotal: number; title: string }>(
      '/admin/links/summary', { linkId }, { withCredentials: true })
      .then(r => { setRows(r.data.rows); setGrand(r.data.grandTotal); setTitle(r.data.title) })
      .catch(e => setError(e.response?.data?.error || 'Failed to load data.'))
      .finally(() => setLoading(false))
  }, [linkId])

  if (!linkId) return <p className="text-red-500 p-8">No link selected.</p>

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      {/* header stacks on mobile, row layout on ≥sm */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Summary for “{title || linkId}”
        </h1>
        <Button variant="outline" onClick={() => router.back()} className="mt-2 sm:mt-0">
          ← Back
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin h-10 w-10 text-gray-500" />
        </div>
      ) : error ? (
        <p className="text-red-500 text-center">{error}</p>
      ) : (
        <>
          {/* Table with horizontal scrolling on small screens */}
          <div className="overflow-x-auto rounded-md shadow-lg">
            <Table className="min-w-full bg-white">
              <TableHeader className="bg-gray-100">
                <TableRow>
                  <TH className="text-sm text-left px-4 py-2">Employee</TH>
                  <TH className="text-sm text-right px-4 py-2"># Entries</TH>
                  <TH className="text-sm text-right px-4 py-2">Total (₹)</TH>
                  <TH className="text-sm text-right px-4 py-2">Action</TH>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.employeeId}>
                    <TableCell className="px-4 py-2 text-sm font-medium">{r.name}</TableCell>
                    <TableCell className="px-4 py-2 text-sm text-right">{r.entryCount}</TableCell>
                    <TableCell className="px-4 py-2 text-sm text-right">{r.employeeTotal.toFixed(2)}</TableCell>
                    <TableCell className="px-4 py-2 text-sm text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={buttonLoadingId === r.employeeId}
                        onClick={() => {
                          setButtonLoadingId(r.employeeId)
                          router.push(`/admin/dashboard/view?linkid=${linkId}&empid=${r.employeeId}`)
                        }}
                      >
                        {buttonLoadingId === r.employeeId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'View Entries'
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>

            </Table>
          </div>

          {/* Grand Total */}
          <div className="text-right text-lg font-semibold pt-4 text-gray-900">
            Grand Total: ₹{grand.toFixed(2)}
          </div>
        </>
      )}
    </div>
  )
}
