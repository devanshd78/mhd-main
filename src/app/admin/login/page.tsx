'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import axios, { post } from '@/lib/axios'

interface LoginResponse {
  message: string
  adminId: string
  adminName?: string
}

export default function AdminAuth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async () => {
    setError('')
    try {
      const { data } = await post<LoginResponse>(
        '/admin/login',
        { email, password },
        { withCredentials: true }
      )
      localStorage.setItem('adminId', data.adminId)
      router.replace('/admin/dashboard')
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          'Login failed. Please check your credentials.'
      )
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-tr from-blue-50 to-blue-100 p-6">
      <Card className="w-full max-w-md p-8 bg-white rounded-2xl shadow-md">
        <CardContent>
          <h1 className="text-3xl font-semibold text-center text-blue-600 mb-6">
            Admin Login
          </h1>

          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@example.com"
            className="w-full mb-4"
          />

          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full mb-6"
          />

          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

          <Button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
          >
            Sign In
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
