import { useEffect, useState } from 'react';

// The model used for drawing extraction. 'gemini-default' = the built-in Gemini call;
// anything else is an OpenRouter model id (e.g. "openai/gpt-4o").
export const DEFAULT_MODEL_ID = 'gemini-default';
export const DEFAULT_MODEL_NAME = 'Gemini 2.5 Flash (built-in)';

const KEY = 'extraction-model-v1';
const EVT = 'extraction-model-changed';

export interface SelectedModel {
  id: string;
  name: string;
}

export function getSelectedModel(): SelectedModel {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const m = JSON.parse(raw);
      if (m && typeof m.id === 'string' && typeof m.name === 'string') return m;
    }
  } catch {
    /* storage unavailable */
  }
  return { id: DEFAULT_MODEL_ID, name: DEFAULT_MODEL_NAME };
}

export function setSelectedModel(m: SelectedModel) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVT));
}

export function useSelectedModel(): SelectedModel {
  const [m, setM] = useState<SelectedModel>(getSelectedModel);
  useEffect(() => {
    const h = () => setM(getSelectedModel());
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  return m;
}
