import { apiRequest } from '../api/localApiClient';

export type Company = {
  id: string;
  name: string;
};

type CompanyResponse = Company & {
  createdAt: string;
  updatedAt: string;
};

export const loadCompanies = async (): Promise<Company[]> => {
  const response = await apiRequest<CompanyResponse[]>('/api/v1/companies');
  return response.value.map(({ id, name }) => ({ id, name }));
};
