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
import { ClipboardCopyIcon, PlusIcon, HomeIcon, TrashIcon } from 'lucide-react'
import api from '@/lib/axios'
import Swal from 'sweetalert2'  // Import SweetAlert2

interface LinkItem {
  _id: string
  title: string
  target: number
  amount: number
  expireIn: number
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
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState('');
  const [expireIn, setExpireIn] = useState('')

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
      .post<{ link: string }>('/admin/links', {
        title: linkTitle, adminId,
        target: Number(target), amount: Number(amount), expireIn: Number(expireIn)
      })
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

  // delete link handler with SweetAlert2
  const handleDeleteLink = (linkId: string) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to revert this!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
    }).then((result) => {
      if (result.isConfirmed) {
        api
          .post('/admin/links/delete', { linkId })
          .then(() => {
            // Remove the deleted link from the state
            setLinks((prevLinks) => prevLinks.filter((link) => link._id !== linkId))
            Swal.fire({
              title: 'Deleted!',
              text: 'The link has been deleted.',
              icon: 'success',
              timer: 1500,
              showConfirmButton: false,
            })
          })
          .catch(() => {
            setError('Failed to delete link.')
            Swal.fire('Error!', 'There was an issue deleting the link.', 'error')
          })
      }
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
                <Input
                  type="number"
                  placeholder="Target (e.g. 100)"
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  className="w-full mt-4"
                />

                {/* Amount Input */}
                <Input
                  type="number"
                  placeholder="Amount per person (e.g. 10)"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full mt-4"
                />

                <Input
                  type="number"
                  placeholder="Link Expiration (in hours)"
                  value={expireIn}
                  onChange={e => setExpireIn(e.target.value)}
                  className="w-full mt-4"
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
                <Button
                  onClick={handleCreateLink}
                  disabled={!linkTitle || !target || !amount || creatingLink || !expireIn}
                >
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
                Expiring At
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
                  {link.expireIn
                    ? new Date(
                      new Date(getCreatedAt(link._id)).getTime() + link.expireIn * 3600 * 1000
                    ).toLocaleString()
                    : 'Expired'}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 flex gap-2">
                  <Button
                    variant="outline"
                    className="flex items-center space-x-1"
                    onClick={() => router.push(`/admin/link-history/view-link?id=${link._id}`)}
                  >
                    View Entries
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center space-x-1 text-red-500"
                    onClick={() => handleDeleteLink(link._id)}
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span>Delete</span>
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
