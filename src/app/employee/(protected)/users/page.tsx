'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '@/lib/axios';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Employee {
  _id: string;
  userId: string;
  name: string;
  email: string;
  phone: number;
  upiId: string;
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const employeeId = localStorage.getItem('employeeId');
    if (!employeeId) {
      setError('Not logged in');
      setLoading(false);
      return;
    }

    api
      .get<{ users: Employee[] }>(`/user/getbyemployeeId/${employeeId}`, { withCredentials: true })
      .then(res => setEmployees(res.data.users))
      .catch(err => setError(err.response?.data?.error || 'Failed to load employees'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return employees;
    const qq = q.toLowerCase();
    return employees.filter(e =>
      [e.name, e.email, e.upiId, String(e.phone)].some(v => String(v).toLowerCase().includes(qq))
    );
  }, [employees, q]);

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-muted-foreground">
        Loading team…
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">My Team</h2>
          <p className="text-sm text-muted-foreground">Users under your employee account.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name, email, phone, UPI…"
            className="w-[260px]"
          />
          <span className="text-xs text-muted-foreground">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No users match your search.
        </Card>
      ) : (
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
              {filtered.map(emp => (
                <TableRow key={emp._id} className="hover:bg-gray-50">
                  <TableCell className="flex items-center">
                    <UserIcon className="h-5 w-5 text-gray-600 mr-2" />
                    <div className="flex flex-col">
                      <span className="font-medium">{emp.name}</span>
                      <span className="text-xs text-muted-foreground">ID: {emp.userId}</span>
                    </div>
                  </TableCell>
                  <TableCell>{emp.email}</TableCell>
                  <TableCell>{emp.phone}</TableCell>
                  <TableCell className="font-mono">{emp.upiId}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.location.assign(`users/view?userId=${emp.userId}`)}
                    >
                      View Entries
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
