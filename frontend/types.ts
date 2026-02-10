// User types
export enum UserRole {
  CITIZEN = 'Citizen',
  ORG_ADMIN = 'Organization Admin',
  ADMIN = 'Admin'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  blocked?: boolean;
  organizationId?: string;
}

// Issue types
export enum IssueCategory {
  ROADS = 'Roads',
  WATER = 'Water & Sewage',
  ELECTRICITY = 'Electricity',
  EDUCATION = 'Schools & Kindergartens',
  HEALTH = 'Hospitals & Clinics',
  WASTE = 'Waste Management'
}

export enum Severity {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

export interface Issue {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string;
  category: IssueCategory;
  subCategory?: string;
  severity: Severity;
  status: 'Open' | 'In Progress' | 'Resolved';
  userId: string;
  userName: string;
  organizationId?: string;
  organizationName?: string;
  aiSummary?: string;
  votes: number;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

// Coordinates
export interface Coordinates {
  lat: number;
  lng: number;
}

// Organization with complete fields from DB model
export interface Organization {
  id: string;
  externalId?: number;
  projectId?: number;
  objectId?: number;
  name: string;
  type: IssueCategory;
  objectType?: string;
  lat: number;
  lng: number;
  address: string;
  region: {
    id?: number;
    name: string;
  };
  year?: number;
  sector?: string;
  sourceType?: string;
  sourceName?: string;
  status?: string;
  budget?: {
    committedUZS?: number;
    spentUZS?: number;
    committedUSD?: number;
    spentUSD?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

// Infrastructure with complete fields from DB model
export interface Infrastructure {
  id: string;
  externalId?: number;
  projectId?: number;
  objectId?: number;
  name: string;
  type: 'Roads' | 'Water & Sewage';
  objectType?: string;
  lat: number;
  lng: number;
  address?: string;
  region?: {
    id?: number;
    name?: string;
  };
  year?: number;
  sector?: string;
  sourceType?: string;
  sourceName?: string;
  status?: string;
  budget?: {
    committedUZS?: number;
    spentUZS?: number;
    committedUSD?: number;
    spentUSD?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}