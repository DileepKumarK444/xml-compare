import axios from 'axios';
import type { ValidationResult } from '../types';

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8010' });

export async function validateXml(xml: File, schema?: File | null): Promise<ValidationResult> {
  const form = new FormData();
  form.append('xml_file', xml);
  if (schema) form.append('schema_file', schema);
  try {
    return (await http.post<ValidationResult>('/api/validate/xml/', form)).data;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (!e.response) {
        throw new Error(
          'Cannot reach the backend at http://localhost:8010. Is the Django server running?',
          { cause: e },
        );
      }
      const data = e.response.data as { error?: string; line?: number } | undefined;
      throw new Error(data?.error ?? JSON.stringify(data), { cause: e });
    }
    throw e;
  }
}
