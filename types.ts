
export enum UserRole {
  ADMIN = 'ADMIN',
  CITIZEN = 'CITIZEN'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  district?: string;
  blocked?: boolean;
}

export enum IssueCategory {
  ROADS = 'Roads',
  WATER = 'Water & Sewage',
  ELECTRICITY = 'Electricity',
  EDUCATION = 'Schools & Kindergartens',
  HEALTH = 'Hospitals & Clinics',
  WASTE = 'Waste Management',
  OTHER = 'Other'
}

export enum IssueSubCategory {
  WATER = 'Water',
  ELECTRICITY = 'Electricity',
  GENERAL = 'General/Other'
}

export enum Severity {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: number;
}

export interface Organization {
  id: string;
  name: string;
  type: IssueCategory.EDUCATION | IssueCategory.HEALTH;
  lat: number;
  lng: number;
  address: string;
}

export interface Issue {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string;
  category: IssueCategory;
  subCategory?: IssueSubCategory;
  severity: Severity;
  status: 'Open' | 'In Progress' | 'Resolved';
  votes: number;
  comments: Comment[];
  createdAt: number;
  aiSummary?: string;
  organizationId?: string;
  organizationName?: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}
