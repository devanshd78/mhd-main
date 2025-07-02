'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { post } from '@/lib/axios'

interface AuthResponse {
  message: string
  employeeId: string
}

export default function EmployeeAuth() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' })
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleAction = async () => {
    if (loading) return
    setError('')
    setSuccessMessage('')
    setLoading(true)
    try {
      const endpoint = isSignUp ? '/employee/register' : '/employee/login'
      const payload = isSignUp
        ? { name: formData.name, email: formData.email, password: formData.password }
        : { email: formData.email, password: formData.password }

      const { data } = await post<AuthResponse>(endpoint, payload)

      if (isSignUp) {
        // Show verification message instead of redirect
        setSuccessMessage('Your account is pending verification by an administrator.')
      } else {
        // Login flow
        localStorage.setItem('employeeId', data.employeeId)
        router.replace('/employee/dashboard')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-tr from-red-50 to-red-100 p-6">
      <Card className="w-full max-w-md p-8 bg-white rounded-2xl shadow-md">
        <CardContent>
          <h1 className="text-3xl font-semibold text-center text-[#800000] mb-6">
            {isSignUp ? 'Employee Register' : 'Employee Login'}
          </h1>

          {/* Success message after sign-up */}
          {successMessage && (
            <p className="text-center text-green-600 mb-4">
              {successMessage}
            </p>
          )}

          {isSignUp && (
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Full Name"
              className="w-full mb-4"
              disabled={!!successMessage}
            />
          )}

          <Input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="employee@example.com"
            className="w-full mb-4"
            disabled={!!successMessage}
          />
          <Input
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            className="w-full mb-6"
            disabled={!!successMessage}
          />

          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

          <Button
            onClick={handleAction}
            className="w-full bg-[#800000] text-white py-2 rounded-md hover:bg-[#B53B56] transition"
            disabled={loading || !!successMessage}
          >
            {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Login'}
          </Button>

          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsSignUp(prev => !prev)
                setError('')
                setSuccessMessage('')
              }}
              className="text-sm text-[#800000] hover:underline"
            >
              {isSignUp
                ? 'Already have an account? Log in'
                : "Don't have an account? Register"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
