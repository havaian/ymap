
import { Issue, IssueCategory, Severity, Organization, IssueSubCategory } from './types';

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

export const MOCK_ORGANIZATIONS: Organization[] = [
  { id: 'org1', name: 'Школа №110', type: IssueCategory.EDUCATION, lat: 41.3200, lng: 69.2800, address: 'ул. Амира Темура, 14' },
  { id: 'org2', name: 'Ташкентский Медцентр', type: IssueCategory.HEALTH, lat: 41.3350, lng: 69.3000, address: 'ул. Богишамол, 44' },
  { id: 'org3', name: 'Общеобразовательная школа №5', type: IssueCategory.EDUCATION, lat: 41.2800, lng: 69.2100, address: 'Чиланзар, 5-й квартал' },
  { id: 'org4', name: 'Городская больница №7', type: IssueCategory.HEALTH, lat: 41.3100, lng: 69.2500, address: 'пр-т Навои, 102' },
  { id: 'org5', name: 'Детский сад "Солнышко"', type: IssueCategory.EDUCATION, lat: 41.2900, lng: 69.2300, address: 'Шота Руставели, 12' },
];

const generateBulkData = (): Issue[] => {
  const issues: Issue[] = [];
  const TOTAL_EXTRA = 1000;
  
  const districts = [
    { name: 'Чиланзар', lat: 41.275, lng: 69.205 },
    { name: 'Юнусабад', lat: 41.355, lng: 69.285 },
    { name: 'Мирзо-Улугбек', lat: 41.325, lng: 69.325 },
    { name: 'Яшнабад', lat: 41.295, lng: 69.315 },
    { name: 'Сергели', lat: 41.225, lng: 69.215 },
    { name: 'Шайхантахур', lat: 41.315, lng: 69.225 },
    { name: 'Учтепа', lat: 41.295, lng: 69.175 },
  ];

  const categories = Object.values(IssueCategory);
  const severities = Object.values(Severity);
  const statuses: ('Open' | 'In Progress' | 'Resolved')[] = ['Open', 'In Progress', 'Resolved'];

  // 1. Генерация 500 записей для учреждений
  for (let i = 0; i < TOTAL_EXTRA / 2; i++) {
    const org = MOCK_ORGANIZATIONS[Math.floor(Math.random() * MOCK_ORGANIZATIONS.length)];
    const severityRoll = Math.random();
    const severity = severityRoll > 0.9 ? Severity.CRITICAL : (severityRoll > 0.7 ? Severity.HIGH : (severityRoll > 0.4 ? Severity.MEDIUM : Severity.LOW));
    const status = Math.random() > 0.3 ? 'Open' : (Math.random() > 0.5 ? 'In Progress' : 'Resolved');
    
    issues.push({
      id: `bulk-org-${i}`,
      lat: org.lat + (Math.random() - 0.5) * 0.002, // Легкое смещение вокруг здания
      lng: org.lng + (Math.random() - 0.5) * 0.002,
      title: `Проблема в ${org.name} #${i}`,
      description: `Автоматически сгенерированный отчет о техническом состоянии объекта.`,
      category: org.type,
      severity: severity,
      status: status,
      votes: Math.floor(Math.random() * 1500),
      comments: [],
      createdAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
      organizationId: org.id,
      organizationName: org.name
    });
  }

  // 2. Генерация 500 записей точками на карте
  for (let i = 0; i < TOTAL_EXTRA / 2; i++) {
    const district = districts[Math.floor(Math.random() * districts.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const severityRoll = Math.random();
    const severity = severityRoll > 0.85 ? Severity.CRITICAL : (severityRoll > 0.65 ? Severity.HIGH : (severityRoll > 0.35 ? Severity.MEDIUM : Severity.LOW));
    const status = Math.random() > 0.2 ? 'Open' : (Math.random() > 0.5 ? 'In Progress' : 'Resolved');

    issues.push({
      id: `bulk-map-${i}`,
      lat: district.lat + (Math.random() - 0.5) * 0.08, // Широкое распределение по району
      lng: district.lng + (Math.random() - 0.5) * 0.08,
      title: `Городская проблема #${i} (${district.name})`,
      description: `Гражданин сообщил о неисправности городской инфраструктуры в районе ${district.name}.`,
      category: category,
      severity: severity,
      status: status,
      votes: Math.floor(Math.random() * 800),
      comments: [],
      createdAt: Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000
    });
  }

  return issues;
};

export const MOCK_ISSUES = generateBulkData();
