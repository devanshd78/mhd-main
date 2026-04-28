'use client'

import React, { useEffect, useMemo, useState } from 'react'
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
import { PlusIcon, HomeIcon, TrashIcon, ExternalLinkIcon } from 'lucide-react'
import api from '@/lib/axios'
import Swal from 'sweetalert2'

interface LikeLinkItem {
    _id: string
    title: string
    videoUrl: string
    createdBy?: string
    createdAt?: string
    target: number
    amount: number
    expireIn: number
    requireLike?: boolean
}

export default function LikeLinkHistoryPage() {
    const router = useRouter()

    const [links, setLinks] = useState<LikeLinkItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [query, setQuery] = useState('')

    const [isOpen, setIsOpen] = useState(false)
    const [creatingLink, setCreatingLink] = useState(false)

    const [linkTitle, setLinkTitle] = useState('')
    const [videoUrl, setVideoUrl] = useState('')
    const [target, setTarget] = useState('')
    const [amount, setAmount] = useState('')
    const [expireIn, setExpireIn] = useState('')

    const filtered = useMemo(() => {
        const q = query.toLowerCase()
        return links.filter(
            (l) =>
                l.title.toLowerCase().includes(q) ||
                (l.videoUrl || '').toLowerCase().includes(q)
        )
    }, [links, query])

    const resetModal = () => {
        setLinkTitle('')
        setVideoUrl('')
        setTarget('')
        setAmount('')
        setExpireIn('')
    }

    const fetchLikeLinks = async () => {
        try {
            setLoading(true)
            const res = await api.get('/admin/likelinks', { withCredentials: true })
            const rows = Array.isArray(res.data)
                ? res.data
                : Array.isArray(res.data?.tasks)
                    ? res.data.tasks
                    : []

            setLinks(rows)
            setError('')
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Failed to load like link history.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLikeLinks()
    }, [])

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
                await fetchLikeLinks()
                Swal.fire('Created', 'Like link created successfully.', 'success')
            })
            .catch((err) => {
                setError(
                    err?.response?.data?.error ||
                    err?.response?.data?.message ||
                    'Failed to create like link.'
                )
            })
            .finally(() => {
                setCreatingLink(false)
            })
    }

    const handleDeleteLikeLink = (linkId: string) => {
        Swal.fire({
            title: 'Are you sure?',
            text: 'This will delete the like link and its task entries.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
        }).then((result) => {
            if (!result.isConfirmed) return

            api
                .post('/admin/likelinks/delete', { linkId })
                .then(() => {
                    setLinks((prev) => prev.filter((item) => item._id !== linkId))
                    Swal.fire({
                        title: 'Deleted!',
                        text: 'The like link has been deleted.',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false,
                    })
                })
                .catch(() => {
                    Swal.fire('Error!', 'Failed to delete like link.', 'error')
                })
        })
    }

    const getCreatedAt = (link: LikeLinkItem) => {
        if (link.createdAt) return new Date(link.createdAt).toLocaleString()

        const ts = parseInt(link._id.substring(0, 8), 16) * 1000
        return new Date(ts).toLocaleString()
    }

    const getExpireAt = (link: LikeLinkItem) => {
        const createdAt = new Date(getCreatedAt(link)).getTime()
        return new Date(createdAt + Number(link.expireIn || 0) * 3600 * 1000).toLocaleString()
    }

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
        return <p className="text-center mt-8">No like links created yet.</p>
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
                <Input
                    placeholder="Search like links..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="max-w-sm"
                />

                <div className="flex items-center space-x-2">
                    <Dialog
                        open={isOpen}
                        onOpenChange={(open) => {
                            setIsOpen(open)
                            if (!open) resetModal()
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button variant="outline" className="flex items-center space-x-2">
                                <PlusIcon className="h-4 w-4" />
                                <span>New Like Link</span>
                            </Button>
                        </DialogTrigger>

                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Like Link</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                                <Input
                                    placeholder="Like link title"
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
                                    placeholder="Target (e.g. 100)"
                                    value={target}
                                    onChange={(e) => setTarget(e.target.value)}
                                    disabled={creatingLink}
                                />

                                <Input
                                    type="number"
                                    placeholder="Amount per person (e.g. 10)"
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
                                        This task always uses <span className="font-semibold">requireLike: true</span>
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
                                    {creatingLink ? 'Creating…' : 'Create Like Link'}
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
                                Video URL
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
                                <td className="px-6 py-4 align-top">
                                    <p className="font-medium">{link.title}</p>
                                    <p className="text-xs text-gray-500">
                                        Target: {link.target} | Amount: ₹{link.amount} | Like={String(link.requireLike ?? true)}
                                    </p>
                                </td>

                                <td className="px-6 py-4 align-top text-sm text-gray-600 max-w-[320px]">
                                    <a
                                        href={link.videoUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 underline break-all inline-flex items-center gap-1"
                                    >
                                        Open Video
                                        <ExternalLinkIcon className="h-3 w-3" />
                                    </a>
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {getCreatedAt(link)}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => router.push(`/admin/like-history/view-link?id=${link._id}`)}
                                        >
                                            View Entries
                                        </Button>

                                        <Button
                                            variant="outline"
                                            className="text-red-500"
                                            onClick={() => handleDeleteLikeLink(link._id)}
                                        >
                                            <TrashIcon className="h-4 w-4 mr-1" />
                                            Delete
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    )
}