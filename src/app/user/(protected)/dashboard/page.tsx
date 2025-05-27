"use client";

import React, { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  UserIcon,
  ClipboardCopyIcon,
  PlusIcon,
  LogOutIcon,
} from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

interface LinkItem {
  _id: string;
  title: string;
  isLatest: boolean;
  target?: number;
  amount?: number;
  createdAt: string;
  expireIn?: number;
  isCompleted: number;
}

interface UserProfile {
  _id: string;
  userId: string;
  name: string;
  phone: number;
  email: string;
  upiId: string;
  worksUnder: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LinkItem | null>(null);

  const [entryName, setEntryName] = useState('');
  const [persons, setPersons] = useState<string>('');
  const [userUpi, setUserUpi] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userTelegram, setUserTelegram] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [worksUnder, setWorksUnder] = useState<string>('');
  // force re-render for timers
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // load user profile
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId) {
      api
        .get<{ user: UserProfile }>(`/user/getbyuserId/${userId}`, { withCredentials: true })
        .then(res => {
          const prof = res.data.user;
          setUserProfile(prof);
          setEntryName(prof.name);
          setUserUpi(prof.upiId);
          setUserPhone(String(prof.phone));
          setUserEmail(prof.email);
          setWorksUnder(prof.worksUnder)
        })
        .catch(console.error);
    }
  }, []);

  // load all links
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      setError('User not logged in');
      setLoading(false);
      return;
    }

    api
      .post<LinkItem[]>('/user/link', { userId }, { withCredentials: true })
      .then(res => setLinks(res.data))
      .catch(err => setError(err.response?.data?.error || 'Unable to load links.'))
      .finally(() => setLoading(false));
  }, []);

  const getTimeLeft = (createdAt: string, expireIn: number = 0) => {
    const expiry = new Date(new Date(createdAt).getTime() + expireIn * 3600 * 1000);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    if (diff <= 0) return { expired: true, label: 'Expired' };
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return { expired: false, label: `${hrs}h ${mins}m` };
  };

  const handleCopy = (text: string) =>
    navigator.clipboard.writeText(text).then(() =>
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Link copied',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      })
    );

  const handleLogout = () => {
    localStorage.clear();
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: 'Logged out',
      showConfirmButton: false,
      timer: 1500,
      timerProgressBar: true,
    });
    router.push('/user/login');
  };

  const openEntryModal = (link: LinkItem) => {
    setSelectedLink(link);
    if (userProfile) {
      setEntryName(userProfile.name);
      setUserUpi(userProfile.upiId);
      setUserPhone(String(userProfile.phone));
      setUserEmail(userProfile.email);
    }
    setPersons('');
    setModalOpen(true);
  };

  const handleEntrySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLink || !userProfile) return;
    const payload = {
      userId: userProfile.userId,
      name: entryName,
      upiId: userUpi,
      telegramLink: userTelegram,    // ← include the edited Telegram link
      linkId: selectedLink._id,
      noOfPersons: Number(persons),
      type: 1,
      worksUnder: worksUnder
    };
    try {
      await api.post('/entry/user', payload, { withCredentials: true });
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Entry submitted!',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
      setModalOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Submission failed';
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: msg,
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
    } finally {
      window.location.reload();
      setSelectedLink(null);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-full">Loading...</div>;
  if (error) return <div className="text-center text-red-600 py-10">{error}</div>;

  return (
    <>
      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Available Links</h1>
        <div className="flex items-center space-x-4">
          <Avatar className="cursor-pointer" onClick={() => router.push('/user/my-account')}>
            <AvatarFallback><UserIcon className="h-6 w-6" /></AvatarFallback>
          </Avatar>
          <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-1">
            <LogOutIcon className="h-4 w-4" /> Logout
          </Button>
        </div>
      </header>

      <main className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {links.map(link => {
          const { expired, label } = getTimeLeft(link.createdAt, link.expireIn || 0);
          return (
            <Card
              key={link._id}
              className={`
    group
    rounded-lg
    hover:shadow-lg transition-shadow
    bg-white
    border
    shadow-lg
    ${link.isLatest ? 'border-green-500' : 'border-gray-200'}
  `}
            >
              <CardHeader className="flex justify-between items-start p-4">
                <CardTitle className="text-lg font-medium line-clamp-2 text-gray-800">
                  {link.title}
                </CardTitle>
                {link.isCompleted === 1 ? (
                  <Badge variant="outline" className="border-green-500 text-green-600 bg-transparent">
                    Completed
                  </Badge>
                ) : link.isLatest ? (
                  <Badge variant="outline" className="border-green-500 text-green-600 bg-transparent">
                    Latest
                  </Badge>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-2 p-4 text-sm text-gray-600">
                {link.target != null && (
                  <div className="flex justify-between">
                    <span>Target:</span>
                    <span>{link.target}</span>
                  </div>
                )}
                {link.amount != null && (
                  <div className="flex justify-between">
                    <span>Amount/Person:</span>
                    <span>₹{link.amount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Expires:</span>
                  <span className={expired ? 'text-gray-400' : 'text-green-600'}>
                    {label}
                  </span>
                </div>
              </CardContent>

              <CardFooter className="flex justify-end space-x-2 p-4">
                {link.isCompleted === 0 && link.isLatest && !expired && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleCopy(link.title)}>
                      <ClipboardCopyIcon className="h-4 w-4" /> Copy
                    </Button>
                    <Button size="sm" onClick={() => openEntryModal(link)}>
                      <PlusIcon className="h-4 w-4" /> Add Entry
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </main>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEntrySubmit} className="space-y-4 p-4">
            <label className="block">
              <span className="text-sm text-gray-700">Name</span>
              <Input value={entryName} disabled />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Phone</span>
              <Input value={userPhone} disabled />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Email</span>
              <Input value={userEmail} disabled />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Telegram Link</span>
              <Input
                value={userTelegram}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUserTelegram(e.target.value)}
                placeholder="Enter your Telegram link"
              />
            </label>
            {selectedLink?.amount != null && (
              <label className="block">
                <span className="text-sm text-gray-700">Amount</span>
                <Input value={`₹${selectedLink.amount}`} disabled />
              </label>
            )}
            <label className="block">
              <span className="text-sm text-gray-700">Number of Persons</span>
              <Input
                type="number"
                value={persons}
                min={1}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const raw = e.target.value;
                  if (raw === '' || raw === '0') {
                    setPersons('');
                  } else {
                    setPersons(raw);
                  }
                }}
                required
              />
            </label>
            {selectedLink?.amount != null && (
              <label className="block">
                <span className="text-sm text-gray-700">Total Amount</span>
                <Input value={`₹${selectedLink.amount * Number(persons)}`} disabled />
              </label>
            )}
            <label className="block">
              <span className="text-sm text-gray-700">UPI ID</span>
              <Input value={userUpi} disabled />
            </label>
            <DialogFooter className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit">Submit Entry</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
