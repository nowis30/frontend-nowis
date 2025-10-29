export interface ProfileData {
  displayName?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  address?: string | null;
}

export interface ProfileForm {
  displayName: string;
  gender: '' | 'MALE' | 'FEMALE' | 'OTHER';
  birthDate: string; // ISO ou vide
  address: string;
}

export type DiffRow = { key: string; from: string; to: string };

// Extrait de la logique du composant: construit une liste de changements lisible pour la modale de confirmation
export function diffProfileEntries(profile: ProfileData | undefined, form: ProfileForm): DiffRow[] {
  if (!profile) return [];
  const entries: DiffRow[] = [];
  const pushIf = (key: string, fromVal: string | null | undefined, toVal: string | null | undefined) => {
    const from = fromVal ?? '';
    const to = toVal ?? '';
    if (from !== to) entries.push({ key, from, to });
  };
  pushIf('Nom complet', profile.displayName ?? '', form.displayName ?? '');
  pushIf('Sexe', profile.gender ?? '', form.gender ?? '');
  pushIf('Date de naissance', profile.birthDate ?? '', form.birthDate ?? '');
  pushIf('Adresse', profile.address ?? '', form.address ?? '');
  return entries;
}
