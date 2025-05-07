'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    const employeeId = localStorage.getItem('employeeId')
    if (!employeeId) {
      router.replace('/employee/login')       // employee login page
    } else {
      setOk(true)
    }
  }, [router])

  if (!ok) return null
  return <>{children}</>
}
