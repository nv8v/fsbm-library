export type ResourceType = 'Cours' | 'Résumés' | 'TD' | 'TP' | 'Examens' | 'Corrigés' | 'Projets' | 'Autres';
export interface SemesterEntry { id: string; label: string; number: number; }
export const programme = { id: 'informatique-appliquee', name: 'Informatique Appliquée', faculty: "Faculté des Sciences Ben M'Sik", degree: 'Licence' };
export const semesters: SemesterEntry[] = Array.from({ length: 6 }, (_, index) => ({ id: `s${index + 1}`, label: `Semestre ${index + 1}`, number: index + 1 }));
export const resourceTypes: ResourceType[] = ['Cours','Résumés','TD','TP','Examens','Corrigés','Projets','Autres'];
