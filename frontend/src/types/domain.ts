export interface Role {
  id?: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePicture?: string | null;
  profileImage?: string | null;
  dni?: string | null;
  phone?: string | null;
  address?: string | null;
  district?: string | null;
  province?: string | null;
  department?: string | null;
  position?: string | null;
  profileComplete?: boolean;
  bio?: string | null;
  isActive?: boolean;
  roles?: Array<string | Role>;
  createdAt?: string;
  deletedAt?: string | null;
  workerProfile?: Worker | null;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  promotionalVideoUrl?: string | null;
  whatYouWillLearn?: string | null;
  requirements?: string | null;
  targetAudience?: string | null;
  level: string;
  durationHours: number;
  imageUrl?: string | null;
  isPublished: boolean;
  deletedAt?: string | null;
  cohorts?: Cohort[];
}

export interface Cohort {
  id: string;
  courseId: string;
    name: string;
    modality?: string | null;
    schedule?: string | null;
    googleMeetLink?: string | null;
  price: Money;
  installments?: number;
  discountPercentage: number;
  discountEndsAt?: string | null;
  imageUrl?: string | null;
  maxStudents: number;
  maxCapacity: number;
  enrolledCount: number;
  enrollmentCount?: number;
  courseName?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt?: string;
  deletedAt?: string | null;
  course: Course;
  teachers?: User[];
  students?: User[];
  enrollments?: Enrollment[];
  syllabusModules?: SyllabusModule[];
  evaluations?: Evaluation[];
  enrollment?: Enrollment;
  teacherId?: string;
  _count?: { enrollments?: number; students?: number };
}

export interface Enrollment {
  id: string;
  userId: string;
  cohortId: string;
  status: string;
  enrolledAt?: string;
  completedAt?: string | null;
  reservationExpiresAt?: string | null;
  user?: User;
  cohort?: Cohort;
  payment?: Payment | null;
  certificate?: Certificate | null;
}

export interface Material {
  id: string;
  moduleId: string;
  title: string;
  type: string;
  fileUrl: string;
  createdAt?: string;
}

export interface ClassSession {
  durationMinutes?: number;
  timeZone?: string;
  id: string;
  moduleId: string;
  title: string;
  date: string;
  meetLink?: string | null;
  recordingUrl?: string | null;
}

export interface SyllabusModule {
  id: string;
  cohortId: string;
  title: string;
  description?: string | null;
  order: number;
  materials?: Material[];
  sessions?: ClassSession[];
  evaluations?: Evaluation[];
}

export interface Grade {
  id?: string;
  score: number;
  feedback?: string | null;
  status?: string;
  gradedAt?: string;
}

export interface Deliverable {
  id: string;
  evaluationId: string;
  studentId: string;
  fileUrl?: string | null;
  comment?: string | null;
  status: string;
  submittedAt?: string;
  student?: User;
  grade?: Grade | null;
  score?: number | null;
  feedback?: string | null;
  evaluationTitle?: string;
  courseName?: string;
  cohortName?: string;
  cohortId?: string;
}

export interface Evaluation {
  kind?: 'ASSIGNMENT' | 'QUIZ';
  rubric?: { title: string; points: number }[];
  id: string;
  cohortId: string;
  moduleId?: string | null;
  title: string;
  description?: string | null;
  dueDate: string;
  maxScore: number;
  weight: number;
  type?: string;
  deliverables?: Deliverable[];
}

export interface Certificate {
  id: string;
  code: string;
  enrollmentId: string;
  issueDate: string;
  createdAt?: string;
  enrollment: Enrollment;
  issuer?: User | null;
}

export interface Payment {
  id: string;
  chargeAttemptKey?: string | null;
  chargeStartedAt?: string | null;
  operationNumber?: string;
  enrollmentId: string;
  amount: Money;
  method: string;
  status: string;
  installmentNumber?: number;
  totalInstallments?: number;
  paidInstallments?: number;
  nextDueDate?: string | null;
  installmentHistory?: Array<{
    installmentNumber: number;
    amount: string;
    method: string;
    voucherUrl?: string | null;
    validatedAt?: string;
    status: string;
    operationNumber?: string;
  }> | null;
  voucherUrl?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  validatedAt?: string | null;
  createdAt: string;
  enrollment?: Enrollment;
}

export interface LearningCourseOverview {
  cohortId: string;
  cohortName: string;
  course: Course;
  status: string;
  progressPercent: number;
  completedItems: number;
  totalItems: number;
  continueModuleId?: string | null;
  completionEligible?: boolean;
  completionCriteria?: {
    courseEnded: boolean;
    allRequiredItemsCompleted: boolean;
  };
}

export interface Contract {
  id: string;
  workerId?: string;
  type: string;
  startDate: string;
  endDate?: string | null;
  agreedSalary: Money;
  documentUrl?: string | null;
  status?: string;
  isActive: boolean;
  observations?: string | null;
  sentAt?: string | null;
  signedAt?: string | null;
  signedBy?: string | null;
  signatureName?: string | null;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
}

export interface Payroll {
  id: string;
  workerId: string;
  period: string;
  baseSalary: Money;
  bonuses: Money;
  deductions: Money;
  totalAmount: Money;
  status: string;
  paymentDate?: string | null;
  worker?: Worker;
}

export interface Worker {
  id: string;
  userId: string;
  dni: string;
  position: string;
  department: string;
  baseSalary: Money;
  hireDate: string;
  status: string;
  personalPhone?: string | null;
  documentNumber?: string;
  user: User;
  contracts?: Contract[];
  payrolls?: Payroll[];
}

export interface AttendanceRecord {
  id?: string;
  studentId: string;
  sessionId?: string | null;
  sessionTitle?: string | null;
  moduleTitle?: string | null;
  date: string;
  isPresent: boolean;
  isExcused: boolean;
  observation?: string | null;
  student?: User;
}

export interface ProgressGrade {
  evaluationId: string;
  title: string;
  score?: number | null;
  maxScore?: number;
  weight?: number;
  status?: string;
}

export interface StudentProgress {
  progressPercent: number;
  averageScore: number;
  completedModules: number;
  modules: number;
  grades: ProgressGrade[];
  materialProgress?: Array<{ materialId: string; completed: boolean }>;
  attendance: {
    rate: number;
    present?: number;
    total?: number;
    records: AttendanceRecord[];
  };
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  targetAudience?: string;
  imageUrl?: string | null;
  ctaText?: string | null;
    ctaUrl?: string | null;
    showOnLanding?: boolean;
    landingStartsAt?: string | null;
    landingEndsAt?: string | null;
    isActive?: boolean;
  createdAt: string;
  author?: User;
}

export interface Forum {
  id: string;
  cohortId: string;
  title: string;
  description?: string | null;
  isActive?: boolean;
  createdAt?: string;
  cohort?: Cohort;
  author?: User | null;
  messages?: ForumMessage[];
  _count?: { messages?: number };
}

export interface ForumMessage {
  id: string;
  forumId: string;
  authorId: string;
  content: string;
  parentId?: string | null;
  createdAt: string;
  author: User;
  replies?: ForumMessage[];
}

export interface PlatformSettings {
  academyName?: string;
  legalName?: string | null;
  taxId?: string | null;
  tagline?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  whatsappNumber?: string | null;
  supportEmail?: string | null;
  salesEmail?: string | null;
  address?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  xUrl?: string | null;
  heroEyebrow?: string | null;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  termsUrl?: string | null;
  privacyUrl?: string | null;
  certificateTemplate?: CertificateTemplateSettings | null;
}

export type PublicPlatformSettings = Omit<
  PlatformSettings,
  'taxId' | 'salesEmail' | 'address' | 'certificateTemplate'
>;

export interface CertificateTemplateSettings {
  version: string;
  primaryColor: string;
  academyLabel: string;
  completionTitle: string;
  gradesTitle: string;
  signatureLabel: string;
}

export interface ApiListResponse<T> {
  data: T[];
  total?: number;
}
import type { Money } from "@/lib/money";
