'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/axios'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ClipboardCopyIcon,
  EyeIcon,
  PlusIcon,
  LogOutIcon,
} from 'lucide-react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

interface LinkItem {
  _id: string
  title: string
  isLatest: boolean
  target: number
  amount: number
}

export default function Dashboard() {
  const router = useRouter()
  const [links, setLinks] = useState<LinkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [navigatingId, setNavigatingId] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    const empId = localStorage.getItem('employeeId')
    if (!empId) return

    api
      .get(`/employee/balance?employeeId=${empId}`)
      .then((res) => setBalance(res.data.balance))
      .catch((err) => console.error('Failed to fetch balance', err))
  }, [])

  useEffect(() => {
    api
      .get<LinkItem[]>('/employee/links', { withCredentials: true })
      .then((res) => setLinks(res.data))
      .catch((e) =>
        setError(e.response?.data?.error || 'Failed to load links.')
      )
      .finally(() => setLoading(false))
  }, [])

  const goToLink = (id: string) => {
    setNavigatingId(id)
    router.push(`/employee/links?id=${id}`)
  }

  const copy = (txt: string) =>
    navigator.clipboard.writeText(txt).then(() =>
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Link copied',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      })
    )

  const handleLogout = async () => {
    localStorage.clear()
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: 'Logged out',
      showConfirmButton: false,
      timer: 1200,
    })
    router.push('/employee/login')
  }

  if (loading) return <p className="text-center mt-10">Loading links…</p>
  if (error) return <p className="text-red-500 text-center mt-10">{error}</p>

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-8">
      {/* title row */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl sm:text-4xl font-bold">Available Links</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {balance !== null && (
            <span className="text-sm sm:text-base font-medium text-green-700 bg-green-100 px-3 py-1 rounded-lg border border-green-300">
              Balance Left: ₹{balance.toLocaleString()}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-1"
          >
            <LogOutIcon className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* link cards */}
      <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {links.map((link) => {
          const latest = link.isLatest

          return (
            <Card
              key={link._id}
              className={`relative p-6 space-y-4 transition transform ${
                latest
                  ? 'bg-green-100 border-green-400 border-2 hover:shadow-xl'
                  : 'bg-white border border-gray-200 hover:shadow-md'
              }`}
            >
              {latest && (
                <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-green-600/90 px-3 py-[2px] text-xs font-medium text-white">
                  Latest
                </span>
              )}

              <div>
                <p className="text-lg font-semibold break-words">{link.title}</p>
                <p className="text-sm text-gray-700 mt-2">
                  🎯 <span className="font-medium">Target:</span> {link.target}
                </p>
                <p className="text-sm text-gray-700">
                  💰 <span className="font-medium">Amount/Person:</span> ₹{link.amount}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {latest ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copy(link.title)}
                      className="flex items-center gap-1 bg-white/70 backdrop-blur hover:bg-green-50"
                    >
                      <ClipboardCopyIcon className="h-4 w-4" />
                      Copy Link
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => goToLink(link._id)}
                      disabled={navigatingId === link._id}
                      className="flex items-center gap-1"
                    >
                      {navigatingId === link._id ? (
                        <span className="animate-spin h-4 w-4 border-t-2 border-gray-600 rounded-full" />
                      ) : (
                        <PlusIcon className="h-4 w-4" />
                      )}
                      Add Entry
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => goToLink(link._id)}
                    disabled={navigatingId === link._id}
                    className="flex items-center gap-1"
                  >
                    {navigatingId === link._id ? (
                      <span className="animate-spin h-4 w-4 border-t-2 border-gray-600 rounded-full" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                    View Entries
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
