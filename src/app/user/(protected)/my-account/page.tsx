"use client";

import React, { useEffect, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserIcon } from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import api from '@/lib/axios';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface Entry {
  linkId: string;
  entryId: string;
  linkTitle: string;
  noOfPersons: number;
  linkAmount: number;
  totalAmount: number;
  createdAt: string;
  status: number;
}

interface UserProfile {
  _id: string;
  userId: string;
  name: string;
  phone: number;
  email: string;
  worksUnder?: string;
  upiId: string;
  worksUnderName: string;
  entries: Entry[];
}

export default function MyAccount() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // editable fields
  const [editName, setEditName] = useState('');
  const [editUpi, setEditUpi] = useState('');

  // load count for entries
  const [visibleEntries, setVisibleEntries] = useState(5);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      setError('User not logged in');
      setLoading(false);
      return;
    }
    api
      .get<{ user: UserProfile }>(`/user/getbyuserId/${userId}`, { withCredentials: true })
      .then(res => {
        const u = res.data.user;
        setProfile(u);
        setEditName(u.name);
        setEditUpi(u.upiId);
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load profile.'))
      .finally(() => setLoading(false));
  }, []);

  const handleProfileUpdate = async () => {
    if (!profile) return;
    try {
      await api.post(
        `/user/update`,
        { userId: profile.userId, name: editName, upiId: editUpi },
        { withCredentials: true }
      );
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Profile updated',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
      setProfile({ ...profile, name: editName, upiId: editUpi });
    } catch (err: any) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: err.response?.data?.error || 'Update failed',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <p>Loading profile...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-center text-red-600 py-10">
        {error}
      </div>
    );
  }
  if (!profile) return null;

  const entriesToShow = profile.entries.slice(0, visibleEntries);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 md:px-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Profile Card */}
        <Card className="shadow-md rounded-lg">
          <CardHeader className="flex flex-col items-center bg-white p-6 border-b">
            <Avatar className="mb-4 h-16 w-16">
              <AvatarFallback>
                <UserIcon className="h-8 w-8 text-gray-400" />
              </AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl font-semibold">My Account</CardTitle>
          </CardHeader>

          <CardContent className="bg-white p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Name (editable) */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Name</label>
              <Input
                value={editName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
              />
            </div>

            {/* Phone (read-only) */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Phone</label>
              <Input value={profile.phone.toString()} disabled />
            </div>

            {/* Email (read-only) */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input value={profile.email} disabled />
            </div>

            {/* Works Under (read-only) */}
            {profile.worksUnderName && (
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Works Under</label>
                <Input value={profile.worksUnderName} disabled />
              </div>
            )}

            {/* UPI ID (editable) */}
            <div className="flex flex-col sm:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1">UPI ID</label>
              <Input
                value={editUpi}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEditUpi(e.target.value)}
              />
            </div>
          </CardContent>

          <CardFooter className="bg-white p-6 flex justify-between border-t">
            <Button variant="outline" onClick={() => router.back()} size="lg">
              Back
            </Button>
            <Button onClick={handleProfileUpdate} size="lg">
              Save Changes
            </Button>
          </CardFooter>
        </Card>

        {/* Entries Section */}
        <section>
          <CardHeader className="px-0">
            <CardTitle className="text-lg font-medium">My Entries</CardTitle>
          </CardHeader>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white shadow-md rounded-lg overflow-hidden">
            <Table className="w-full divide-y divide-gray-200">
              <TableHeader className="bg-gray-100">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left uppercase">Link</TableHead>
                  <TableHead className="px-4 py-3 text-center uppercase">Payment Status</TableHead>
                  <TableHead className="px-4 py-3 text-center uppercase">Persons</TableHead>
                  <TableHead className="px-4 py-3 text-center uppercase">Link Amount</TableHead>
                  <TableHead className="px-4 py-3 text-center uppercase">Total Amount</TableHead>
                  <TableHead className="px-4 py-3 text-right uppercase">Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesToShow.map(e => (
                  <TableRow key={e.entryId ?? e.linkId} className="hover:bg-gray-50">
                    <TableCell className="px-4 py-3">{e.linkTitle}</TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <Badge
                        className={`
      inline-flex items-center px-2 py-1 text-sm font-medium rounded-xl
      ${e.status === 1
                            ? 'border border-green-500 text-green-600 bg-transparent'
                            : e.status === 0
                              ? 'border border-red-500 text-red-600 bg-transparent'
                              : 'border border-yellow-500 text-yellow-600 bg-transparent'
                          }
    `}
                      >
                        {e.status === 1 ? 'Approved' : e.status === 0 ? 'Rejected' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">{e.noOfPersons}</TableCell>
                    <TableCell className="px-4 py-3 text-center">₹{e.linkAmount}</TableCell>
                    <TableCell className="px-4 py-3 text-center">₹{e.totalAmount}</TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {new Date(e.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden space-y-4">
            {entriesToShow.map(e => (
              <Card key={e.entryId ?? e.linkId} className="shadow rounded-lg">
                <CardContent className="p-4">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Link:</span>
                    <span>{e.linkTitle}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Payment Status:</span>
                    <Badge
                      className={`
      inline-flex items-center px-2 py-1 text-sm font-medium rounded-xl
      ${e.status === 1
                          ? 'border border-green-500 text-green-600 bg-transparent'
                          : e.status === 0
                            ? 'border border-red-500 text-red-600 bg-transparent'
                            : 'border border-yellow-500 text-yellow-600 bg-transparent'
                        }
    `}
                    >
                      {e.status === 1 ? 'Approved' : e.status === 0 ? 'Rejected' : 'Pending'}
                    </Badge>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Persons:</span>
                    <span>{e.noOfPersons}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Link Amount:</span>
                    <span>₹{e.linkAmount}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Total Amount:</span>
                    <span>₹{e.totalAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Submitted:</span>
                    <span>
                      {new Date(e.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load More Button */}
          {visibleEntries < profile.entries.length && (
            <div className="flex justify-center mt-4">
              <Button onClick={() => setVisibleEntries(vis => vis + 5)}>
                Load More
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
