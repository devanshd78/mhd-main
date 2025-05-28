"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/axios';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Swal from 'sweetalert2';

interface Employee {
  employeeId: string;
  name: string;
}

interface FormData {
  name: string;
  phone: string;
  email: string;
  password: string;
  communityLeader: string;
  upiId: string;
}

enum TabOption {
  Login = 'login',
  Register = 'register',
}

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<TabOption>(TabOption.Login);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
    email: '',
    password: '',
    communityLeader: '',
    upiId: '',
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (activeTab === TabOption.Register) {
      get<Employee[]>('/admin/employees')
        .then(response => setEmployees(response.data))
        .catch(err => console.error('Failed to fetch employees', err));
    }
  }, [activeTab]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelect = (value: string) => {
    setFormData(prev => ({ ...prev, communityLeader: value }));
  };

const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      let response;
      if (activeTab === TabOption.Login) {
        response = await post('/user/login', {
          phone: formData.phone,
          password: formData.password,
        });
      } else {
        response = await post('/user/register', {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          password: formData.password,
          worksUnder: formData.communityLeader,
          upiId: formData.upiId,
        });
      }
      const data = response.data;
      const userId = data.userId ?? data.user?.userId;
      if (userId) localStorage.setItem('userId', userId);
      router.push('/user/dashboard');
    } catch (err: any) {
      console.error('API error:', err);
      const msg =
        err.response?.data?.message ||
        'Something went wrong. Please try again.';
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: "User Already Exists",
        timerProgressBar: true,
        timer: 3000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {activeTab === TabOption.Login ? 'Login' : 'Register'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={val => setActiveTab(val as TabOption)}>
            <TabsList>
              <TabsTrigger value={TabOption.Login}>Login</TabsTrigger>
              <TabsTrigger value={TabOption.Register}>Register</TabsTrigger>
            </TabsList>

            {/* --- LOGIN --- */}
            <TabsContent value={TabOption.Login}>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* +91 prefix */}
                <div className="flex">
                  <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 bg-gray-100 text-gray-600 rounded-l-md">
                    +91
                  </span>
                  <Input
                    name="phone"
                    type="tel"
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    disabled={submitting}
                    className="rounded-none rounded-r-md"
                  />
                </div>

                <Input
                  name="password"
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={submitting}
                />

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && activeTab === TabOption.Login ? 'Logging in...' : 'Login'}
                </Button>
              </form>
            </TabsContent>


            {/* --- REGISTER --- */}
            <TabsContent value={TabOption.Register}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  name="name"
                  type="text"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={submitting}
                />

                {/* +91 prefix */}
                <div className="flex">
                  <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 bg-gray-100 text-gray-600 rounded-l-md">
                    +91
                  </span>
                  <Input
                    name="phone"
                    type="tel"
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    disabled={submitting}
                    className="rounded-none rounded-r-md"
                  />
                </div>

                <Input
                  name="email"
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={submitting}
                />

                <Input
                  name="password"
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={submitting}
                />

                <Select
                  onValueChange={handleSelect}
                  value={formData.communityLeader}
                  disabled={submitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Community Leader" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.employeeId} value={emp.employeeId}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  name="upiId"
                  type="text"
                  placeholder="UPI ID"
                  value={formData.upiId}
                  onChange={handleChange}
                  required
                  disabled={submitting}
                />

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Registering...' : 'Register'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}