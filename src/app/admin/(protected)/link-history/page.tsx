// app/admin/link-history/page.tsx
'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ClipboardCopyIcon, PlusIcon, HomeIcon } from 'lucide-react'
import api from '@/lib/axios'

interface LinkItem {
  _id: string
  title: string
}

export default function LinkHistory() {
  const router = useRouter()

  // link list state
  const [links, setLinks] = useState<LinkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // filter & copy
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () => links.filter((l) => l.title.toLowerCase().includes(query.toLowerCase())),
    [links, query]
  )
  const handleCopy = (url: string) => navigator.clipboard.writeText(url)

  // modal state
  const [isOpen, setIsOpen] = useState(false)
  const [linkTitle, setLinkTitle] = useState('')
  const [creatingLink, setCreatingLink] = useState(false)
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null)

  // fetch existing links
  useEffect(() => {
    async function fetchLinks() {
      try {
        const res = await api.get<LinkItem[]>('/admin/links', { withCredentials: true })
        setLinks(res.data.sort((a, b) => (b._id > a._id ? 1 : -1)))
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load link history.')
      } finally {
        setLoading(false)
      }
    }
    fetchLinks()
  }, [])

  // create link handler
  const handleCreateLink = () => {
    setCreatingLink(true)
    setLinkSuccess(null)

    const adminId = localStorage.getItem('adminId') || ''

    api
      .post<{ link: string }>('/admin/links', { title: linkTitle, adminId })
      .then((res) => {
        setLinkSuccess(res.data.link)
        setLinkTitle('')
        setIsOpen(false)
        return api.get<LinkItem[]>('/admin/links', { withCredentials: true })
      })
      .then((res) => {
        setLinks(res.data.sort((a, b) => (b._id > a._id ? 1 : -1)))
      })
      .catch(() => setError('Failed to create link.'))
      .finally(() => {
        setCreatingLink(false)
        setLinkSuccess(null)
      })
  }

  // derive created-at
  const getCreatedAt = (id: string) => {
    const ts = parseInt(id.substring(0, 8), 16) * 1000
    return new Date(ts).toLocaleString()
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // loading / error / empty states
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, idx) => (
          <div key={idx} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }
  if (error) {
    return <p className="text-red-500 text-center mt-8">{error}</p>
  }
  if (!links.length) {
    return <p className="text-center mt-8">No links created yet.</p>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <Input
          placeholder="Search links..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />

        <div className="flex items-center space-x-2">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2">
                <PlusIcon className="h-4 w-4" />
                <span>New Link</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Shareable Link</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <Input
                  placeholder="Link title"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  disabled={creatingLink}
                />
                {linkSuccess && (
                  <p className="text-sm text-green-600">Link created!</p>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  disabled={creatingLink}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateLink} disabled={!linkTitle || creatingLink}>
                  {creatingLink ? 'Creating…' : 'Create Link'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            className="flex items-center space-x-1"
            onClick={() => router.push('/admin/dashboard')}
          >
            <HomeIcon className="h-4 w-4" />
            <span>Go to Dashboard</span>
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto shadow-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map((link) => (
              <tr key={link._id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="font-medium">{link.title}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {getCreatedAt(link._id)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <Button
                    variant="outline"
                    className="flex items-center space-x-1"
                    onClick={() => router.push(`/admin/link-history/view-link?id=${link._id}`)}
                  > View Links
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
