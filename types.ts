
export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
export type Language = string;

export interface VoiceOption {
  id: VoiceName;
  label: string;
  description: string;
  gender: 'Male' | 'Female' | 'Neutral';
  previewText: string;
}

export interface ThemeOption {
  id: string;
  name: string;
  bgClass: string;
  cardClass: string;
  accentClass: string;
  textClass: string;
  inputClass: string;
  isDark: boolean;
  icon: string;
}

export interface AudioState {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
}
