'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import api from '@/lib/axios'
import Swal from 'sweetalert2'

const EmailChangePage: React.FC = () => {
  const router = useRouter()
  const [newEmail, setNewEmail] = useState('')
  const [otpOld, setOtpOld] = useState('')
  const [otpNew, setOtpNew] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)

  const adminId = typeof window !== 'undefined'
    ? localStorage.getItem('adminId')
    : null

  const handleRequest = async () => {
    if (!adminId) {
      Swal.fire('Error', 'You must be logged in', 'error')
      return
    }
    if (!newEmail.trim()) {
      Swal.fire('Error', 'Please enter a valid new email address', 'error')
      return
    }
    setLoading(true)
    try {
      await api.post('/admin/request-email-change', { adminId, newEmail: newEmail.trim() })
      Swal.fire('OTP Sent', 'Check both your current and new email inboxes.', 'success')
      setStep(2)
    } catch (err: any) {
      Swal.fire('Error', err.response?.data?.error || 'Could not send OTP', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!adminId) return
    if (!otpOld.trim() || !otpNew.trim()) {
      Swal.fire('Error', 'Please enter both OTP codes.', 'error')
      return
    }
    setLoading(true)
    try {
      await api.post('/admin/confirm-email-change', {
        adminId,
        otpOld: otpOld.trim(),
        otpNew: otpNew.trim(),
      })
      Swal.fire('Success', 'Your email has been updated.', 'success')
      router.push('/admin')
    } catch (err: any) {
      Swal.fire('Error', err.response?.data?.error || 'Confirmation failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {step === 1 ? 'Change Your Email' : 'Enter Verification Codes'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 ? (
            <>
              <Label htmlFor="new-email">New Email Address</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="you@example.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="mt-1"
              />
              <p className="text-sm text-gray-500">
                We’ll send one code to your current email and one to this new address.
              </p>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="otp-old">Code to Current Email</Label>
                <Input
                  id="otp-old"
                  type="text"
                  placeholder="123456"
                  value={otpOld}
                  onChange={e => setOtpOld(e.target.value.replace(/\D/, ''))}
                  maxLength={6}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="otp-new">Code to New Email</Label>
                <Input
                  id="otp-new"
                  type="text"
                  placeholder="654321"
                  value={otpNew}
                  onChange={e => setOtpNew(e.target.value.replace(/\D/, ''))}
                  maxLength={6}
                  className="mt-1"
                />
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          {step === 1 ? (
            <Button
              onClick={handleRequest}
              disabled={loading || !newEmail.trim()}
              className="w-full flex justify-center items-center"
            >
              {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Send Verification Codes
            </Button>
          ) : (
            <>
              <Button
                onClick={handleConfirm}
                disabled={loading || !otpOld.trim() || !otpNew.trim()}
                className="w-full flex justify-center items-center"
              >
                {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                Confirm Email Change
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={loading}
                className="w-full"
              >
                Start Over
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

export default EmailChangePage
