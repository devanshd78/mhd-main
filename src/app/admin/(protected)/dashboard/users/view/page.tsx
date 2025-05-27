'use client'

import React, { useEffect, useState, ChangeEvent } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import api from '@/lib/axios'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

interface HistoryItem {
  field: string
  from: number
  to: number
  updatedAt: string
  _id: string
}

interface Entry {
  linkId: string
  entryId: string
  linkTitle: string
  noOfPersons: number
  linkAmount: number
  totalAmount: number
  createdAt: string
  telegramLink: string
  status: number
  history?: HistoryItem[]
  isUpdated?: number
}

interface UserWithEntries {
  name: string
  entries: Entry[]
}

export default function ViewEntries() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const userId = searchParams.get('id')

  const [entries, setEntries] = useState<Entry[]>([])
  const [userName, setUserName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // history modal states
  const [showHistory, setShowHistory] = useState(false)
  const [historyEntry, setHistoryEntry] = useState<Entry | null>(null)

  useEffect(() => {
    if (!userId) {
      setError('No user specified')
      setLoading(false)
      return
    }
    api
      .get<{ user: UserWithEntries }>(`/user/getbyuserId/${userId}`, { withCredentials: true })
      .then(res => {
        setEntries(res.data.user.entries)
        setUserName(res.data.user.name)
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load entries'))
      .finally(() => setLoading(false))
  }, [userId])

  const startHistoryView = (entry: Entry) => {
    setHistoryEntry(entry)
    setShowHistory(true)
  }

  if (loading) return <p className="text-center mt-10">Loading entries…</p>
  if (error) return <p className="text-center text-red-500 mt-10">{error}</p>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Entries for {userName}</h2>
        <Button variant="ghost" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      {/* History Modal */}
      {historyEntry && (
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 bg-black/50" />
            <DialogContent className="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-2xl shadow-lg">
              <DialogHeader>
                <DialogTitle>Update History</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {historyEntry.history?.map(item => (
                  <div key={item._id} className="p-2 border rounded">
                    <div className="text-sm font-medium">{item.field}</div>
                    <div className="text-xs">from {item.from} to {item.to}</div>
                    <div className="text-xs text-gray-500">{format(new Date(item.updatedAt), 'PPpp')}</div>
                  </div>
                ))}
              </div>
              <DialogFooter className="flex justify-end mt-4">
                <Button size="sm" variant="outline" onClick={() => setShowHistory(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      )}

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <Table className="w-full">
          <TableHeader className="bg-gray-100">
            <TableRow>
              <TableHead>Link</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Persons</TableHead>
              <TableHead className="text-center">Amt/Person</TableHead>
              <TableHead className="text-center">Total Amount</TableHead>
              <TableHead className="text-center">Telegram Link</TableHead>
              <TableHead>Submitted At</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(e => (
              <TableRow key={e.entryId} className="hover:bg-gray-50">
                <TableCell>{e.linkTitle}</TableCell>
                <TableCell className="text-center">
                  {e.status === 1 ? (
                    <span className="text-green-600">Approved</span>
                  ) : e.status === 0 ? (
                    <span className="text-red-600">Rejected</span>
                  ) : (
                    <span className="text-yellow-600">Pending</span>
                  )}
                </TableCell>
                <TableCell className="text-center">{e.noOfPersons}</TableCell>
                <TableCell className="text-center">₹{e.linkAmount}</TableCell>
                <TableCell className="text-center">₹{e.totalAmount}</TableCell>
                <TableCell className="text-center">
                  {e.telegramLink ? (
                    <a
                      href={
                        e.telegramLink.startsWith('http')
                          ? e.telegramLink
                          : `https://t.me/${e.telegramLink.replace(/^@/, '')}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Open Telegram
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {new Date(e.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </TableCell>
                <TableCell>
                  {e.isUpdated ? (
                    <Button size="sm" variant="outline" onClick={() => startHistoryView(e)}>
                      View
                    </Button>
                  ) : (
                    '-'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}