"use client";

import { useParams } from 'next/navigation';
import { ClassroomWorkspace } from '@/components/classroom/classroom-workspace';

export default function ClassroomPage() {
  const params = useParams<{ id: string }>();
  return <ClassroomWorkspace key={params.id} cohortId={params.id} />;
}
