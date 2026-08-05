"use client";

import { useAuth } from "@/components/auth-provider";
import { AdminView } from "@/components/dashboard/admin-view";
import { TeacherView } from "@/components/dashboard/teacher-view";
import { StudentView } from "@/components/dashboard/student-view";
import { RrhhView } from "@/components/dashboard/rrhh-view";
import { Loader2 } from "lucide-react";

import { AnnouncementsPanel } from "@/components/dashboard/announcements-panel";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const role = user.roles[0];

  const renderView = () => {
    switch (role) {
      case "ADMIN": return <AdminView />;
      case "DOCENTE": return <TeacherView />;
      case "ESTUDIANTE": return <StudentView />;
      case "RRHH": return <RrhhView />;
      default: return <div>Rol no reconocido</div>;
    }
  };

  return (
    <div className="space-y-6">
      <AnnouncementsPanel />
      {renderView()}
    </div>
  );
}

