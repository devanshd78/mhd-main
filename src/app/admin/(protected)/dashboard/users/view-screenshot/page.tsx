'use client'

import React, { useEffect, useState } from 'react'
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
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

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
  linkAmount: number
  totalAmount: number
  createdAt: string
  status: number | null
  screenshotId?: string
  history?: HistoryItem[]
  isUpdated?: number
  // New (present in ssUser entries payload)
  name?: string
}

// ---------------- Screenshots Types ----------------
interface ScreenshotRow {
  screenshotId: string
  userId: string
  linkId?: string
  verified: boolean
  analysis?: any
  createdAt: string
}

// Unified ssUser response (examples include entries + screenshots)
interface SsUserResponse {
  screenshots: ScreenshotRow[]
  entries: Entry[]
  totalScreenshots?: number
  total?: number
  page?: number
  pages?: number
}

// Backend endpoint for screenshots+entries
const SCREENSHOTS_ENDPOINT = '/admin/ssUser'

function shortId(id?: string, head = 6, tail = 4) {
  if (!id) return '—'
  if (id.length <= head + tail) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
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

  // screenshots map (by screenshotId)
  const [shotById, setShotById] = useState<Record<string, ScreenshotRow>>({})

  // analysis viewer
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [analysisForId, setAnalysisForId] = useState<string>('')

  useEffect(() => {
    if (!userId) {
      setError('No user specified')
      setLoading(false)
      return
    }

    // Single call: fetch entries + screenshots from ssUser
    api
      .post<SsUserResponse>(
        SCREENSHOTS_ENDPOINT,
        { userId, page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' },
        { withCredentials: true }
      )
      .then(({ data }) => {
        const entriesData = data.entries ?? []
        setEntries(entriesData)
        // Derive user name from first entry (payload includes `name`)
        setUserName(entriesData[0]?.name || '')

        const shotMap: Record<string, ScreenshotRow> = {}
        ;(data.screenshots || []).forEach(s => {
          if (s.screenshotId) shotMap[s.screenshotId] = s
        })
        setShotById(shotMap)
      })
      .catch(err => {
        setError(err?.response?.data?.error || 'Failed to load data')
      })
      .finally(() => setLoading(false))
  }, [userId])

  const startHistoryView = (entry: Entry) => {
    setHistoryEntry(entry)
    setShowHistory(true)
  }

  const openAnalysis = (screenshotId: string, analysis: any) => {
    setAnalysisForId(screenshotId)
    setAnalysisData(analysis)
    setAnalysisOpen(true)
  }

  if (loading) return <p className="text-center mt-10">Loading entries…</p>
  if (error) return <p className="text-center text-red-500 mt-10">{error}</p>

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">
          Entries{userName ? ` for ${userName}` : ''}
        </h2>
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
                {historyEntry.history?.length
                  ? historyEntry.history.map(item => (
                      <div key={item._id} className="p-2 border rounded">
                        <div className="text-sm font-medium">{item.field}</div>
                        <div className="text-xs">
                          from {item.from} to {item.to}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(item.updatedAt), 'PPpp')}
                        </div>
                      </div>
                    ))
                  : <div className="text-sm text-gray-500">No updates</div>}
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

      {/* ONE TABLE: merged entries + screenshots (only screenshotId & analysis) */}
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <Table className="w-full">
          <TableHeader className="bg-gray-100">
            <TableRow>
              <TableHead>Link</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Amt/Person</TableHead>
              <TableHead className="text-center">Total Amount</TableHead>
              <TableHead>Analysis</TableHead>
              <TableHead>Submitted At</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(e => {
              const shot = e.screenshotId ? shotById[e.screenshotId] : undefined
              const statusLabel = e.status === 1 ? 'Approved' : e.status === 0 ? 'Rejected' : 'Pending'
              const statusColor = e.status === 1 ? 'text-green-600' : e.status === 0 ? 'text-red-600' : 'text-yellow-600'

              return (
                <TableRow key={e.entryId} className="hover:bg-gray-50">
                  <TableCell className="max-w-[280px] truncate" title={e.linkTitle}>
                    {e.linkTitle?.startsWith('http') ? (
                      <a
                        href={e.linkTitle}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {e.linkTitle}
                      </a>
                    ) : (
                      e.linkTitle || '—'
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    <span className={statusColor}>{statusLabel}</span>
                  </TableCell>

                  <TableCell className="text-center">₹{e.linkAmount ?? '—'}</TableCell>

                  <TableCell className="text-center">₹{e.totalAmount ?? '—'}</TableCell>

                  {/* Analysis (only field from screenshots besides ID) */}
                  <TableCell>
                    {shot?.analysis ? (
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-700">
                          <span className="mr-2">
                            Liked: <b>{shot.analysis.liked ? 'Yes' : 'No'}</b>
                          </span>
                          <span className="mr-2">
                            Verified: <b>{shot.analysis.verified ? 'Yes' : 'No'}</b>
                          </span>
                          <span className="mr-2">
                            Comments:{' '}
                            <b>{Array.isArray(shot.analysis.comment) ? shot.analysis.comment.length : 0}</b>
                          </span>
                          <span>
                            Replies:{' '}
                            <b>{Array.isArray(shot.analysis.replies) ? shot.analysis.replies.length : 0}</b>
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAnalysis(shot.screenshotId, shot.analysis)}
                        >
                          View
                        </Button>
                      </div>
                    ) : (
                      // Fallback: show top-level verified if analysis is not present
                      shot ? (
                        <div className="text-xs text-gray-700">
                          Verified: <b>{shot.verified ? 'Yes' : 'No'}</b>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )
                    )}
                  </TableCell>

                  {/* Submitted */}
                  <TableCell>
                    {e.createdAt ? format(new Date(e.createdAt), 'PPpp') : '—'}
                  </TableCell>

                  {/* Updated history */}
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
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Analysis JSON Modal */}
      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-black/50" />
          <DialogContent className="fixed top-1/2 left-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-2xl shadow-lg">
            <DialogHeader>
              <DialogTitle>
                Analysis {analysisForId ? `— ${shortId(analysisForId, 8, 6)}` : ''}
              </DialogTitle>
            </DialogHeader>
            <pre className="mt-2 bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
              {analysisData ? JSON.stringify(analysisData, null, 2) : '—'}
            </pre>
            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setAnalysisOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
