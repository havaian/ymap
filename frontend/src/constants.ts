
import { Issue, IssueCategory, Severity, Organization } from '../types';

export const TASHKENT_CENTER: [number, number] = [41.2995, 69.2401];

export const CATEGORY_COLORS: Record<IssueCategory, string> = {
  [IssueCategory.ROADS]: '#ef4444', 
  [IssueCategory.WATER]: '#3b82f6', 
  [IssueCategory.ELECTRICITY]: '#eab308', 
  [IssueCategory.EDUCATION]: '#10b981', 
  [IssueCategory.HEALTH]: '#ec4899', 
  [IssueCategory.WASTE]: '#8b5cf6', 
  [IssueCategory.OTHER]: '#64748b',
};
