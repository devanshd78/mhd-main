'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead as TH,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import api from '@/lib/axios'
import Swal from 'sweetalert2'

interface Employee {
  _id: string
  name: string
  email: string
  employeeId: string
  balance: number
}

export default function BulkPaymentPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get<Employee[]>('/admin/employees')
      .then(res => setEmployees(res.data))
      .catch(() => setError('Failed to load employees.'))
      .finally(() => setLoading(false))
  }, [])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSubmit = async () => {
    if (loading || !amount || selectedIds.length === 0) return
    const adminId = localStorage.getItem('adminId') || ''
    const amt = parseFloat(amount)
    if (!adminId || isNaN(amt) || amt <= 0) {
      Swal.fire('Invalid input', 'Please enter a valid amount.', 'error')
      return
    }
    setLoading(true)
    try {
      await api.post('/admin/employees/bulk-add', { employeeIds: selectedIds, amount: amt, adminId, note: 'Bulk payment' })
      Swal.fire('Success', 'Balances updated.', 'success')
      router.push('/admin/dashboard')
    } catch {
      Swal.fire('Error', 'Bulk payment failed.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-8 space-y-6">
      <h1 className="text-3xl font-bold">Bulk Payment</h1>
      {error && <p className="text-red-500">{error}</p>}
      {loading && !employees.length ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <Card>
          <CardContent>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Amount to Add</label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount" />
            </div>
            <div className="overflow-x-auto ">
              <Table className="w-full">
                <colgroup>
                  <col className="w-1/12" />
                  <col className="w-5/12" />
                  <col className="w-6/12" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TH></TH>
                    <TH>Name</TH>
                    <TH>Email</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map(emp => (
                    <TableRow key={emp.employeeId} className="even:bg-gray-50">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(emp.employeeId)}
                          onChange={() => toggleSelect(emp.employeeId)}
                          className="mr-2"
                        />
                      </TableCell>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell>{emp.email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4">
              <Button onClick={handleSubmit} disabled={loading || !amount || selectedIds.length === 0}>
                {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : 'Submit Bulk Payment'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}