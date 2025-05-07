'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/** Blocks rendering until adminId exists in localStorage. */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [ok, setOk] = useState(false)   // allows SSR‑compatible “gate”

  useEffect(() => {
    const adminId = localStorage.getItem('adminId')
    if (!adminId) {
      router.replace('/admin/login')
    } else {
      setOk(true)
    }
  }, [router])

  if (!ok) return null
  return <>{children}</>
}
