import type { LocationOption } from '../../constants/location';

export type ApplicationAnswer = 'Yes' | 'No' | 'Unsure';

export type GovernmentIdentifier = {
  id: number;
  country: LocationOption;
  identifierType: string;
  value: string;
};

export type WorkAuthorization = {
  id: number;
  country: LocationOption;
  authorizedToWork: ApplicationAnswer | null;
  requiresSponsorship: ApplicationAnswer | null;
};

export type ApplicationQuestionsData = {
  raceEthnicity: string | null;
  veteranStatus: string | null;
  disabilityStatus: string | null;
  governmentIdentifiers: GovernmentIdentifier[];
  workAuthorizations: WorkAuthorization[];
};

export const EMPTY_APPLICATION_QUESTIONS: ApplicationQuestionsData = {
  raceEthnicity: null,
  veteranStatus: null,
  disabilityStatus: null,
  governmentIdentifiers: [],
  workAuthorizations: []
};

export const maskGovernmentIdentifier = (value: string) => {
  const visibleSuffix = value.replace(/[^\p{L}\p{N}]/gu, '').slice(-4);
  return visibleSuffix ? `•••• ${visibleSuffix}` : 'Saved (value masked)';
};
