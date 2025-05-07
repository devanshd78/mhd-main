'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Check if running on the client-side
    if (typeof window !== "undefined") {
      const employeeId = localStorage.getItem('employeeId')

      if (employeeId) {
        router.replace('/employee/dashboard')
      } else {
        router.replace('/employee/login')
      }
    }
  }, [router])

  // Render nothing while the redirect happens
  return null
}
