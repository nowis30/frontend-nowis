import { describe, it, expect } from 'vitest';
import { diffProfileEntries, type ProfileData, type ProfileForm } from '../personalIncomeDiff';

describe('diffProfileEntries', () => {
  it('retourne une ligne de diff quand l\'adresse change', () => {
    const current: ProfileData = {
      displayName: 'Alice Dupont',
      gender: 'FEMALE',
      birthDate: '1990-01-01',
      address: 'Ancienne adresse'
    };
    const form: ProfileForm = {
      displayName: 'Alice Dupont',
      gender: 'FEMALE',
      birthDate: '1990-01-01',
      address: '123 rue Principale'
    };

    const rows = diffProfileEntries(current, form);
    expect(rows).toEqual([
      { key: 'Adresse', from: 'Ancienne adresse', to: '123 rue Principale' }
    ]);
  });

  it('retourne un tableau vide quand rien ne change', () => {
    const current: ProfileData = {
      displayName: 'Bob Martin',
      gender: 'MALE',
      birthDate: '1985-06-15',
      address: '100 avenue du Parc'
    };
    const form: ProfileForm = {
      displayName: 'Bob Martin',
      gender: 'MALE',
      birthDate: '1985-06-15',
      address: '100 avenue du Parc'
    };

    const rows = diffProfileEntries(current, form);
    expect(rows).toEqual([]);
  });
});
