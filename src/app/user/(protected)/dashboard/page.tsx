// app/user/(protected)/dashboard/page.tsx

import TaskTabs from "@/components/TaskTabs";

export default function DashboardPage() {
  return (
    <main className="p-4">
      <TaskTabs defaultTab="dashboard" />
    </main>
  );
}
