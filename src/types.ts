export type ClassType = string // 'W' | 'LAB' | 'CW' | 'PROJ' | 'SEM' | 'EGZ' | ...
export type Attendance = 'present' | 'absent' | null
export type AttendanceRule = 'required' | 'optional' | 'unknown'
export type ExamStatus = 'todo' | 'passed' | 'failed'

export interface Year {
  id: string
  name: string
  order: number
}

export interface Semester {
  id: string
  yearId: string
  name: string
  number: number
  kind?: 'zimowy' | 'letni'
  startDate?: string
  endDate?: string
}

export interface Component {
  teacher?: string
  contact?: string
  room?: string
  attendance?: AttendanceRule
  absenceLimit?: number | null
  notes?: string
  rules?: string
  gradeParts?: GradePart[]
  grade?: number | null
  links?: Link[]
}

export interface GradePart {
  name: string
  weight: number
  grade?: number | null
}

export interface Link {
  label: string
  url: string
}

export interface Subject {
  id: string
  semesterId: string
  key: string
  name: string
  shortName?: string
  color: string
  ects?: number | null
  notes?: string
  rules?: string
  links?: Link[]
  components?: Record<string, Component>
  gradeParts?: GradePart[]
  grade?: number | null
  status?: 'in_progress' | 'passed' | 'failed'
  archived?: boolean
  createdAt?: number
}

export interface CalEvent {
  id: string
  source: 'usos' | 'manual'
  kind: 'class' | 'exam'
  semesterId?: string
  subjectKey: string
  type: ClassType
  title: string
  start: string // 'YYYY-MM-DDTHH:mm' (czas lokalny, Warszawa)
  end: string
  room?: string
  building?: string
  address?: string
  url?: string
  cancelled?: boolean
  // pola użytkownika
  attendance?: Attendance
  required?: boolean | null
  note?: string
  color?: string | null
  // egzamin
  examForm?: string
  examStatus?: ExamStatus
  examGrade?: number | null
  attempt?: string
}

export interface Task {
  id: string
  subjectId?: string | null
  title: string
  due?: string | null // 'YYYY-MM-DD' lub 'YYYY-MM-DDTHH:mm'
  done: boolean
  notes?: string
  weight?: string
  componentType?: string | null // 'W' | 'LAB' | … ; brak = ogólne
  createdAt: number
}

export interface Profile {
  name?: string
  field?: string
  university?: string
  mode?: string
}

export interface Settings {
  icalUrl?: string
  activeSemesterId?: string
  lastSync?: number
  profile?: Profile
  theme?: 'auto' | 'light' | 'dark'
}
