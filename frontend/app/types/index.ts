// app/types/index.ts
// Ported from frontend/types.ts. Deprecated aliases CivicPromise / PromiseStatus
// dropped per п. 3.9.5 (legacy org/infrastructure/promise architecture is not carried over).

// ── User ──────────────────────────────────────────────────────────────────────

export enum UserRole {
  CITIZEN = 'CITIZEN',
  ADMIN = 'ADMIN',
}

export function isAdminUser(user: User | null): boolean {
  if (!user) return false
  return user.role === UserRole.ADMIN || user.role.toUpperCase() === 'ADMIN'
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  blocked?: boolean
}

// ── Issue ─────────────────────────────────────────────────────────────────────

export enum IssueCategory {
  ROADS = 'Roads',
  WATER = 'Water & Sewage',
  ELECTRICITY = 'Electricity',
  EDUCATION = 'Schools & Kindergartens',
  HEALTH = 'Hospitals & Clinics',
  WASTE = 'Waste Management',
  OTHER = 'Other',
}

export enum IssueSubCategory {
  WATER = 'Water',
  ELECTRICITY = 'Electricity',
  GENERAL = 'General/Other',
}

export enum Severity {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical',
}

export interface Comment {
  id: string
  author: string
  text: string
  timestamp: number
}

export interface Issue {
  id: string
  lat: number
  lng: number
  title: string
  description: string
  category: IssueCategory
  subCategory?: string
  severity: Severity
  status: 'Open' | 'In Progress' | 'Resolved'
  // Links to the unified Object
  objectId?: string
  objectName?: string
  aiSummary?: string
  votes: number
  comments: Comment[]
  createdAt: number
}

export interface Coordinates {
  lat: number
  lng: number
}

// ── Facility Object ──────────────────

export type ObjectType = 'school' | 'kindergarten' | 'health_post'
export type SourceApi = 'ssv' | 'bogcha' | 'maktab44'

export interface ObjectDetails {
  materialSten?: string
  elektrKunDavomida?: string
  ichimlikSuviManbaa?: string
  internet?: string
  binoIchidaSuv?: string
  kapitalTamir?: string
  qurilishYili?: string
  sigimi?: number
  umumiyUquvchi?: number
  smena?: string
  sportZalHolati?: string
  aktivZalHolati?: string
  oshhonaHolati?: string
}

export interface FacilityObject {
  id: string
  uid?: number
  inn?: string
  code?: number
  parentCode?: number
  sourceApi: SourceApi
  objectType: ObjectType
  name: string
  nameRu?: string
  nameEn?: string
  viloyat?: string
  tuman?: string
  regionCode?: number
  districtId?: string
  lat: number
  lng: number
  details?: ObjectDetails
  sourceUpdatedAt?: string
  lastSyncedAt?: string
  createdAt?: string
  updatedAt?: string
  capacity?: number // details.sigimi из маркер-эндпоинта
  enrollment?: number // details.umumiyUquvchi из маркер-эндпоинта
}

// ── Program ───────────────────────────────────────────────────────────────────

export type ProgramStatus = 'active' | 'completed' | 'cancelled'

export interface ProgramScope {
  objectTypes: ObjectType[]
  regionCode: number | null
  districtId: string | null
}

export interface Program {
  id: string
  name: string
  number?: string
  description?: string
  deadline?: string | null
  status: ProgramStatus
  totalBudget?: number | null
  currency: 'UZS' | 'USD'
  scope: ProgramScope
  objectIds: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ── Task ──────────────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'Planned'
  | 'In Progress'
  | 'Pending Verification'
  | 'Completed'
  | 'Failed'

export interface TaskVerification {
  _id: string
  userId: string
  userName: string
  status: 'done' | 'problem'
  comment?: string
  photoUrl?: string
  createdAt: string
  points?: number
}

export interface Task {
  id: string
  targetId: string
  programId: string | null
  allocationId: string | null
  title: string
  description?: string
  deadline?: string | null
  status: TaskStatus
  createdBy: string
  votes: {
    confirmed: string[]
    rejected: string[]
  }
  verifications: TaskVerification[]
  // Virtual counts attached by controller
  totalCount: number
  doneCount: number
  problemCount: number
  createdAt: string
  updatedAt: string
}

export interface TaskStats {
  total: number
  byStatus: Partial<Record<TaskStatus, number>>
  votes: { confirmed: number; rejected: number }
  verifications: { done: number; problem: number }
}

// ── Budget Allocation ─────────────────────────────────────────────────────────

export interface BudgetAllocation {
  id: string
  targetType: 'object' | 'program'
  targetId: string
  amount?: number
  currency: 'UZS' | 'USD'
  period?: string
  note?: string
  createdBy: string
  taskCount?: number // attached by getAllocations controller
  createdAt: string
  updatedAt: string
}

// ── API Response ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ── Profile / Leaderboard (backend/src/user/controller.js response shapes) ─────

export interface ProfileIssueStats {
  total: number
  open: number
  progress: number
  resolved: number
  totalVotes: number
}

export interface ProfileRecentIssue {
  id: string
  title: string
  category: string
  severity: string
  status: string
  votes: number
  createdAt: string
}

export interface ProfileActivity {
  issues: ProfileIssueStats
  recentIssues: ProfileRecentIssue[]
  votesGiven: number
  verifications: { done: number; problem: number }
}

export interface ProfileData {
  user: {
    id: string
    // Имя необязательно: форма регистрации его не спрашивает, и бэкенд отдаёт
    // null вместо выдуманного значения.
    name: string | null
    email: string
    role: string
    points: number
    createdAt: string
  }
  activity: ProfileActivity
}

export interface LeaderboardEntry {
  rank: number
  id: string
  name: string | null
  points: number
  issueCount: number
  resolvedCount: number
  verificationCount: number
  createdAt: string
}

// ── Map markers / regions (backend markers + region controllers) ──────────────

export interface ObjectMarker {
  id: string
  lat: number
  lng: number
  name: string
  objectType: string
  sourceApi?: string | null
  // Where the coordinate came from and how far it can be trusted. /markers/objects
  // returns only coordPrecision 'exact' by default; 'approximate' arrives only when
  // the caller asks for it, and coordShared marks a point the source registry reuses
  // across several facilities.
  coordPrecision?: 'exact' | 'approximate' | 'none'
  coordSource?: string
  coordShared?: boolean
  capacity: number | null
  enrollment: number | null
}

export interface DeprivationBound {
  lower: number | null
  upper: number | null
}

export interface DeprivationFeatureProps {
  districtCode: string
  districtId: string
  name: { ru?: string; uz?: string; en?: string } | string
  regionCode: number
  areaKm2?: number
  value: number | null
  M0: DeprivationBound
  H: DeprivationBound
  A: DeprivationBound
  assessed: number
  notAssessable: number
  dimensions: Record<string, { label: string; lower: number | null; upper: number | null }>
}

export interface RegionListItem {
  code: number
  name: { ru?: string; uz?: string; en?: string } | string
}
