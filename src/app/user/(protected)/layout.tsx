'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      router.replace('/user/login')       // user login page
    } else {
      setOk(true)
    }
  }, [router])

  if (!ok) return null
  return <>{children}</>
}
