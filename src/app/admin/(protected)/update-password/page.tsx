'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import api from '@/lib/axios'
import Swal from 'sweetalert2'

const PasswordResetPage: React.FC = () => {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const adminId = typeof window !== 'undefined'
    ? localStorage.getItem('adminId')
    : null

  const handleRequest = async () => {
    if (!adminId) {
      Swal.fire('Error', 'You must be logged in', 'error')
      return
    }
    setLoading(true)
    try {
      await api.post('/admin/request-password-reset', { adminId })
      Swal.fire('OTP Sent', 'Please check your email for the code.', 'success')
      setStep(2)
    } catch (err: any) {
      Swal.fire('Error', err.response?.data?.error || 'Could not send OTP', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!adminId) return
    if (!otp.trim() || !newPassword.trim()) {
      Swal.fire('Error', 'Please enter both OTP and a new password', 'error')
      return
    }
    setLoading(true)
    try {
      await api.post('/admin/confirm-password-reset', {
        adminId,
        otp: otp.trim(),
        newPassword
      })
      Swal.fire('Success', 'Your password has been reset.', 'success')
      router.push('/admin/login')
    } catch (err: any) {
      Swal.fire('Error', err.response?.data?.error || 'Reset failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {step === 1 ? 'Reset Your Password' : 'Enter Verification Code'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 ? (
            <p className="text-center text-sm text-gray-600">
              Click below to get an OTP sent to your registered email.
            </p>
          ) : (
            <>
              <div>
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/, ''))}
                  maxLength={6}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="mt-1 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18}/> : <Eye size={18}/> }
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  At least 8 characters including letters & numbers.
                </p>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          {step === 1 ? (
            <Button
              onClick={handleRequest}
              disabled={loading}
              className="w-full flex justify-center items-center"
            >
              {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Send OTP
            </Button>
          ) : (
            <>
              <Button
                onClick={handleConfirm}
                disabled={loading || !otp || !newPassword}
                className="w-full flex justify-center items-center"
              >
                {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                Reset Password
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={loading}
                className="w-full"
              >
                Go Back
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

export default PasswordResetPage
