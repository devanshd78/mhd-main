'use client'

import React, { useEffect, useState } from 'react'
import api from '@/lib/axios'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { UserIcon } from 'lucide-react'

interface Employee {
  _id: string
  userId: string
  name: string
  email: string
  phone: number
  upiId: string
}

export default function Employees() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const employeeId = localStorage.getItem('employeeId')
    if (!employeeId) {
      setError('Not logged in')
      setLoading(false)
      return
    }

    api
      .get<{ users: Employee[] }>(`/user/getbyemployeeId/${employeeId}`, { withCredentials: true })
      .then(res => setEmployees(res.data.users))
      .catch(err => setError(err.response?.data?.error || 'Failed to load employees'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-center mt-10">Loading...</p>
  if (error) return <p className="text-center text-red-500 mt-10">{error}</p>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h2 className="text-2xl font-semibold mb-4">My Team</h2>
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <Table className="w-full">
          <TableHeader className="bg-gray-100">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>UPI ID</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map(emp => (
              <TableRow key={emp._id} className="hover:bg-gray-50">
                <TableCell className="flex items-center">
                  <UserIcon className="h-5 w-5 text-gray-600 mr-2" />
                  {emp.name}
                </TableCell>
                <TableCell>{emp.email}</TableCell>
                <TableCell>{emp.phone}</TableCell>
                <TableCell>{emp.upiId}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`users/view?userId=${emp.userId}`)}
                  >
                    View Entries
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
