import axios from 'axios';
import type { CompareOptions, CompareResult } from '../types';
import sampleResult from '../mock/sampleResult.json';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const http = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000' });

export async function compareXml(
  original: File,
  modified: File,
  options: CompareOptions,
): Promise<CompareResult> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 600));
    const mock = structuredClone(sampleResult) as unknown as CompareResult;
    mock.options = options;
    return mock;
  }
  const form = new FormData();
  form.append('original_file', original);
  form.append('modified_file', modified);
  (Object.keys(options) as (keyof CompareOptions)[]).forEach((k) =>
    form.append(k, String(options[k])),
  );
  try {
    const res = await http.post<CompareResult>('/api/compare/xml/', form);
    return res.data;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (!e.response) {
        throw new Error(
          'Cannot reach the backend at http://localhost:8000. Is the Django server running?',
          { cause: e },
        );
      }
      const data = e.response.data as { error?: string; line?: number } | undefined;
      const detail = data?.error ?? JSON.stringify(data);
      throw new Error(data?.line ? `${detail} (line ${data.line})` : detail, { cause: e });
    }
    throw e;
  }
}
