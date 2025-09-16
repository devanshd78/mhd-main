"use client";

import * as React from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { LayoutGrid as GridIcon, Mail as MailIcon } from "lucide-react";

// Your view components
import Dashboard from "@/app/user/(protected)/dashboard/Dashboard";
import EmailCollection from "@/app/user/(protected)/dashboard/EmailCollection";

export default function TaskTabs({
  className,
  defaultTab = "dashboard",
}: {
  className?: string;
  defaultTab?: "dashboard" | "email";
}) {
  const [value, setValue] = React.useState<"dashboard" | "email">(defaultTab);

  return (
    <div className={className}>
      <Tabs value={value} onValueChange={(v) => setValue(v as any)} className="w-full">
        <TabsList className="w-full max-w-md grid grid-cols-2 bg-black/5 dark:bg-white/5">
          <TabsTrigger value="dashboard" className="gap-2">
            <GridIcon className="h-4 w-4" />
            <span>Youtube Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <MailIcon className="h-4 w-4" />
            <span>Email Proof</span>
          </TabsTrigger>
        </TabsList>

        {/* Renders content without changing routes */}
        <div className="mt-6">
          <TabsContent value="dashboard">
            <Dashboard />
          </TabsContent>
          <TabsContent value="email">
            <EmailCollection/>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
