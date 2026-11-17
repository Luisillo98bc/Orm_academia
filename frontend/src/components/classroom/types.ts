export interface Question { id?: string; prompt: string; options: string[]; correctIndex: number; points: number }
export interface Criterion { title: string; points: number }
export interface Grade { score: number; feedback?: string | null; status: string; rubricScores?: number[] }
export interface Submission {
  id: string; studentId: string; fileUrl: string; fileName: string; comment?: string; status: string; submittedAt: string;
  student: { firstName: string; lastName: string }; grade: Grade | null; returnFeedback?: string | null;
  revisions: { id: string; fileUrl: string; submittedAt: string; gradeSnapshot: Grade | null }[];
}
export interface Activity {
  id: string; title: string; description?: string; moduleId?: string | null; kind: 'ASSIGNMENT' | 'QUIZ'; weight: number; maxScore: number;
  dueDate?: string | null; isPublished: boolean; allowLate: boolean; allowResubmit: boolean; maxAttempts: number; timeLimitMinutes: number;
  rubric: Criterion[]; questions?: Question[]; questionCount: number; deliverables: Submission[];
  quizAttempts: { id: string; studentId: string; number: number; score: number | null; expiresAt: string; submittedAt: string | null }[];
}
export interface ClassroomPost { id: string; title: string; content: string; pinned: boolean; publishedAt: string; author: { firstName: string; lastName: string } }
export interface Attempt { id: string; number: number; questions: Omit<Question, 'correctIndex'>[]; answers: number[]; expiresAt: string; serverTime: string; submittedAt: string | null; score: number | null }
export function localDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export const dateLabel = (date: string) => new Date(date).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
