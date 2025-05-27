'use client'

import React, { useEffect, useState, ChangeEvent } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

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
}

interface UserWithEntries {
  name: string
  entries: Entry[]
}

export default function ViewEntries() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const userId = searchParams.get('userId')
  const [entries, setEntries] = useState<Entry[]>([])
  const [userName, setUserName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingLink, setEditingLink] = useState<string | null>(null)
  const [editCount, setEditCount] = useState<number>(1)

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
      .catch(err =>
        setError(err.response?.data?.error || 'Failed to load entries')
      )
      .finally(() => setLoading(false))
  }, [userId])

  const startEdit = (entry: Entry) => {
    setEditingLink(entry.linkId)
    setEditCount(entry.noOfPersons)
  }

  const cancelEdit = () => {
    setEditingLink(null)
  }

  const saveEdit = async (entry: Entry) => {
    try {
      await api.post(
        '/entry/updateEntry',
        { entryId:entry.entryId, noOfPersons: editCount, type:1 },
        { withCredentials: true }
      )
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Entry updated',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      })
      // refresh entries
      const res = await api.get<{ user: UserWithEntries }>(
        `/user/getbyuserId/${userId}`,
        { withCredentials: true }
      )
      setEntries(res.data.user.entries)
      setEditingLink(null)
    } catch (err: any) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: err.response?.data?.error || 'Update failed',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      })
    }
  }

  const approveEntry = async (entry: Entry, isApprove: number) => {
    try {
      await api.post(
        '/entry/updateStatus',
        { entryId: entry.entryId, approve: isApprove },
        { withCredentials: true }
      )
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Entry approved',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      })
      // refresh entries
      const res = await api.get<{ user: UserWithEntries }>(
        `/user/getbyuserId/${userId}`,
        { withCredentials: true }
      )
      setEntries(res.data.user.entries)
    } catch (err: any) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: err.response?.data?.error || 'Approve failed',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      })
    }
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
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <Table className="w-full">
          <TableHeader className="bg-gray-100">
            <TableRow>
              <TableHead>Link</TableHead>
              <TableHead className="text-center">Approved/ Rejected</TableHead>
              <TableHead className="text-center">Persons</TableHead>
              <TableHead className="text-center">Amount/Person</TableHead>
              <TableHead className="text-center">Total Amount</TableHead>
              <TableHead className="text-center">Telegram Link</TableHead>
              <TableHead>Submitted At</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e, idx) => {
              const isEditing = editingLink === e.linkId
              const total = isEditing
                ? editCount * e.linkAmount
                : e.totalAmount

              return (
                <TableRow key={e.entryId ?? e.linkId} className="hover:bg-gray-50">
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
                  <TableCell className="text-center">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editCount}
                        min={1}
                        onChange={(ev: ChangeEvent<HTMLInputElement>) =>
                          setEditCount(Number(ev.target.value))
                        }
                      />
                    ) : (
                      e.noOfPersons
                    )}
                  </TableCell>
                  <TableCell className="text-center">₹{e.linkAmount}</TableCell>
                  <TableCell className="text-center">₹{total}</TableCell>
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

                  {/* Single Action Cell, buttons stacked vertically */}
                  <TableCell className="text-right align-top">
                    <div className="flex flex-col items-end space-y-2">
                      {isEditing ? (
                        <div className="flex justify-end space-x-2">
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => saveEdit(e)}>
                            Save
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end space-y-2">
                          <Button size="sm" variant="outline" className="w-50" onClick={() => startEdit(e)}>
                            Update
                          </Button>

                          <div className="flex space-x-2">
                            <Button size="sm" variant="default" className="w-24" onClick={() => approveEntry(e, 1)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="w-24" onClick={() => approveEntry(e, 0)}>
                              Reject
                            </Button>
                          </div>
                        </div>

                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
