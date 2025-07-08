'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '../components/adminSidebar'

/** Blocks rendering until adminId exists in localStorage, and wraps with Sidebar */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [ok, setOk] = useState(false)   // allows SSR-compatible “gate”

  useEffect(() => {
    const adminId = localStorage.getItem('adminId')
    if (!adminId) {
      router.replace('/admin/login')
    } else {
      setOk(true)
    }
  }, [router])

  if (!ok) return null
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
