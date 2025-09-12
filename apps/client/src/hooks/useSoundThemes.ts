/**
 * Custom Sound Themes Hook
 * Provides customizable audio feedback system for VTT gaming
 */

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';

// Sound event types for VTT actions
export type SoundEvent = 
  | 'diceRoll' 
  | 'criticalHit' 
  | 'criticalMiss'
  | 'levelUp'
  | 'damage'
  | 'healing'
  | 'spellCast'
  | 'buttonClick'
  | 'modalOpen'
  | 'modalClose'
  | 'notification'
  | 'error'
  | 'success'
  | 'combat'
  | 'ambient';

// Sound theme definitions
export interface SoundTheme {
  id: string;
  name: string;
  description: string;
  sounds: Record<SoundEvent, string | string[]>;
  ambient?: {
    volume: number;
    fadeInDuration: number;
    fadeOutDuration: number;
  };
}

// Built-in sound themes
export const SOUND_THEMES: Record<string, SoundTheme> = {
  fantasy: {
    id: 'fantasy',
    name: 'Fantasy Adventure',
    description: 'Classic fantasy sounds with magical elements',
    sounds: {
      diceRoll: [
        '/sounds/fantasy/dice-roll-1.mp3',
        '/sounds/fantasy/dice-roll-2.mp3',
        '/sounds/fantasy/dice-roll-3.mp3'
      ],
      criticalHit: '/sounds/fantasy/sword-clash.mp3',
      criticalMiss: '/sounds/fantasy/whoosh-miss.mp3',
      levelUp: '/sounds/fantasy/level-up-fanfare.mp3',
      damage: '/sounds/fantasy/hit-damage.mp3',
      healing: '/sounds/fantasy/healing-spell.mp3',
      spellCast: [
        '/sounds/fantasy/spell-cast-1.mp3',
        '/sounds/fantasy/spell-cast-2.mp3'
      ],
      buttonClick: '/sounds/fantasy/button-click.mp3',
      modalOpen: '/sounds/fantasy/modal-open.mp3',
      modalClose: '/sounds/fantasy/modal-close.mp3',
      notification: '/sounds/fantasy/notification.mp3',
      error: '/sounds/fantasy/error.mp3',
      success: '/sounds/fantasy/success.mp3',
      combat: '/sounds/fantasy/combat-start.mp3',
      ambient: '/sounds/fantasy/tavern-ambient.mp3'
    },
    ambient: {
      volume: 0.3,
      fadeInDuration: 2000,
      fadeOutDuration: 1000
    }
  },
  scifi: {
    id: 'scifi',
    name: 'Sci-Fi Explorer',
    description: 'Futuristic electronic sounds for space adventures',
    sounds: {
      diceRoll: [
        '/sounds/scifi/digital-roll-1.mp3',
        '/sounds/scifi/digital-roll-2.mp3'
      ],
      criticalHit: '/sounds/scifi/laser-blast.mp3',
      criticalMiss: '/sounds/scifi/power-down.mp3',
      levelUp: '/sounds/scifi/achievement-unlock.mp3',
      damage: '/sounds/scifi/energy-hit.mp3',
      healing: '/sounds/scifi/regeneration.mp3',
      spellCast: '/sounds/scifi/tech-activation.mp3',
      buttonClick: '/sounds/scifi/ui-click.mp3',
      modalOpen: '/sounds/scifi/interface-open.mp3',
      modalClose: '/sounds/scifi/interface-close.mp3',
      notification: '/sounds/scifi/data-received.mp3',
      error: '/sounds/scifi/system-error.mp3',
      success: '/sounds/scifi/operation-complete.mp3',
      combat: '/sounds/scifi/battle-stations.mp3',
      ambient: '/sounds/scifi/space-station-hum.mp3'
    },
    ambient: {
      volume: 0.25,
      fadeInDuration: 3000,
      fadeOutDuration: 1500
    }
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal Clean',
    description: 'Subtle, non-intrusive sounds for focused gameplay',
    sounds: {
      diceRoll: '/sounds/minimal/soft-click.mp3',
      criticalHit: '/sounds/minimal/chime-high.mp3',
      criticalMiss: '/sounds/minimal/tick-low.mp3',
      levelUp: '/sounds/minimal/success-chime.mp3',
      damage: '/sounds/minimal/tap-down.mp3',
      healing: '/sounds/minimal/chime-up.mp3',
      spellCast: '/sounds/minimal/soft-whoosh.mp3',
      buttonClick: '/sounds/minimal/click.mp3',
      modalOpen: '/sounds/minimal/slide-up.mp3',
      modalClose: '/sounds/minimal/slide-down.mp3',
      notification: '/sounds/minimal/notification-subtle.mp3',
      error: '/sounds/minimal/error-soft.mp3',
      success: '/sounds/minimal/success-soft.mp3',
      combat: '/sounds/minimal/alert-gentle.mp3',
      ambient: '/sounds/minimal/white-noise-soft.mp3'
    },
    ambient: {
      volume: 0.15,
      fadeInDuration: 5000,
      fadeOutDuration: 3000
    }
  },
  retro: {
    id: 'retro',
    name: 'Retro Arcade',
    description: '8-bit inspired sounds for nostalgic gaming',
    sounds: {
      diceRoll: '/sounds/retro/8bit-roll.mp3',
      criticalHit: '/sounds/retro/power-up.mp3',
      criticalMiss: '/sounds/retro/game-over.mp3',
      levelUp: '/sounds/retro/level-complete.mp3',
      damage: '/sounds/retro/hit-8bit.mp3',
      healing: '/sounds/retro/pickup-health.mp3',
      spellCast: '/sounds/retro/magic-cast.mp3',
      buttonClick: '/sounds/retro/menu-select.mp3',
      modalOpen: '/sounds/retro/menu-open.mp3',
      modalClose: '/sounds/retro/menu-close.mp3',
      notification: '/sounds/retro/notification-beep.mp3',
      error: '/sounds/retro/error-buzz.mp3',
      success: '/sounds/retro/coin-collect.mp3',
      combat: '/sounds/retro/battle-start.mp3',
      ambient: '/sounds/retro/arcade-ambient.mp3'
    },
    ambient: {
      volume: 0.2,
      fadeInDuration: 1000,
      fadeOutDuration: 500
    }
  }
};

// Sound settings configuration
interface SoundSettings {
  enabled: boolean;
  masterVolume: number;
  effectsVolume: number;
  ambientVolume: number;
  currentTheme: string;
  enableHaptics: boolean;
  customSounds?: Partial<Record<SoundEvent, string>>;
}

const DEFAULT_SETTINGS: SoundSettings = {
  enabled: true,
  masterVolume: 0.7,
  effectsVolume: 0.8,
  ambientVolume: 0.4,
  currentTheme: 'fantasy',
  enableHaptics: true
};

// Context for sound theme management
interface SoundContextType {
  settings: SoundSettings;
  updateSettings: (updates: Partial<SoundSettings>) => void;
  playSound: (event: SoundEvent, volume?: number) => Promise<void>;
  preloadSounds: (theme?: string) => Promise<void>;
  getCurrentTheme: () => SoundTheme;
  isPlaying: (event: SoundEvent) => boolean;
  stopSound: (event: SoundEvent) => void;
  stopAllSounds: () => void;
}

const SoundContext = createContext<SoundContextType | null>(null);

// Custom hook for sound management
export function useSoundThemes() {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSoundThemes must be used within a SoundProvider');
  }
  return context;
}

// Sound manager class for advanced audio handling
class SoundManager {
  private audioCache = new Map<string, HTMLAudioElement>();
  private playingSounds = new Map<SoundEvent, HTMLAudioElement>();
  private ambientSound: HTMLAudioElement | null = null;
  private settings: SoundSettings;

  constructor(settings: SoundSettings) {
    this.settings = settings;
  }

  updateSettings(newSettings: SoundSettings) {
    this.settings = newSettings;
    
    // Update ambient volume if playing
    if (this.ambientSound) {
      this.ambientSound.volume = this.calculateVolume('ambient');
    }
  }

  private calculateVolume(type: 'effects' | 'ambient' = 'effects'): number {
    if (!this.settings.enabled) return 0;
    
    const baseVolume = type === 'ambient' 
      ? this.settings.ambientVolume 
      : this.settings.effectsVolume;
    
    return this.settings.masterVolume * baseVolume;
  }

  private async loadAudio(url: string): Promise<HTMLAudioElement> {
    if (this.audioCache.has(url)) {
      return this.audioCache.get(url)!.cloneNode() as HTMLAudioElement;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    
    return new Promise((resolve, reject) => {
      audio.addEventListener('canplaythrough', () => {
        this.audioCache.set(url, audio);
        resolve(audio.cloneNode() as HTMLAudioElement);
      });
      
      audio.addEventListener('error', () => {
        console.warn(`Failed to load sound: ${url}`);
        reject(new Error(`Failed to load sound: ${url}`));
      });
      
      audio.src = url;
    });
  }

  async preloadSounds(theme: SoundTheme): Promise<void> {
    const promises: Promise<void>[] = [];
    
    Object.values(theme.sounds).forEach(soundPath => {
      if (Array.isArray(soundPath)) {
        soundPath.forEach(path => {
          promises.push(
            this.loadAudio(path).catch(() => {}) // Ignore errors during preload
          );
        });
      } else {
        promises.push(
          this.loadAudio(soundPath).catch(() => {}) // Ignore errors during preload
        );
      }
    });
    
    await Promise.allSettled(promises);
  }

  async playSound(event: SoundEvent, theme: SoundTheme, customVolume?: number): Promise<void> {
    if (!this.settings.enabled) return;

    // Stop any existing sound of this type
    this.stopSound(event);

    let soundPath = theme.sounds[event];
    
    // Handle custom sounds override
    if (this.settings.customSounds?.[event]) {
      soundPath = this.settings.customSounds[event]!;
    }
    
    // Handle array of sounds (random selection)
    if (Array.isArray(soundPath)) {
      soundPath = soundPath[Math.floor(Math.random() * soundPath.length)];
    }

    try {
      const audio = await this.loadAudio(soundPath);
      const volume = customVolume ?? this.calculateVolume('effects');
      
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.currentTime = 0;
      
      this.playingSounds.set(event, audio);
      
      audio.addEventListener('ended', () => {
        this.playingSounds.delete(event);
      });
      
      await audio.play();
    } catch (error) {
      console.warn(`Failed to play sound for event: ${event}`, error);
    }
  }

  async playAmbientSound(theme: SoundTheme): Promise<void> {
    if (!this.settings.enabled || !theme.sounds.ambient || !theme.ambient) return;
    
    try {
      this.stopAmbientSound();
      
      const audio = await this.loadAudio(theme.sounds.ambient as string);
      audio.loop = true;
      audio.volume = 0;
      
      this.ambientSound = audio;
      
      // Fade in
      await audio.play();
      this.fadeVolume(audio, 0, this.calculateVolume('ambient'), theme.ambient.fadeInDuration);
    } catch (error) {
      console.warn('Failed to play ambient sound:', error);
    }
  }

  stopAmbientSound(): void {
    if (!this.ambientSound) return;
    
    const audio = this.ambientSound;
    const currentTheme = SOUND_THEMES[this.settings.currentTheme];
    const fadeDuration = currentTheme?.ambient?.fadeOutDuration ?? 1000;
    
    this.fadeVolume(audio, audio.volume, 0, fadeDuration).then(() => {
      audio.pause();
      this.ambientSound = null;
    });
  }

  private fadeVolume(audio: HTMLAudioElement, from: number, to: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const steps = 50;
      const stepDuration = duration / steps;
      const volumeStep = (to - from) / steps;
      let currentStep = 0;
      
      const interval = setInterval(() => {
        currentStep++;
        audio.volume = Math.max(0, Math.min(1, from + (volumeStep * currentStep)));
        
        if (currentStep >= steps) {
          clearInterval(interval);
          audio.volume = to;
          resolve();
        }
      }, stepDuration);
    });
  }

  stopSound(event: SoundEvent): void {
    const audio = this.playingSounds.get(event);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      this.playingSounds.delete(event);
    }
  }

  stopAllSounds(): void {
    this.playingSounds.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.playingSounds.clear();
    this.stopAmbientSound();
  }

  isPlaying(event: SoundEvent): boolean {
    return this.playingSounds.has(event);
  }
}

// Provider component
export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SoundSettings>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('vtt-sound-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  const soundManagerRef = useRef<SoundManager>();

  // Initialize sound manager
  useEffect(() => {
    soundManagerRef.current = new SoundManager(settings);
  }, []);

  // Update sound manager when settings change
  useEffect(() => {
    if (soundManagerRef.current) {
      soundManagerRef.current.updateSettings(settings);
    }
  }, [settings]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('vtt-sound-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<SoundSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const playSound = useCallback(async (event: SoundEvent, volume?: number) => {
    if (!soundManagerRef.current) return;
    
    const theme = SOUND_THEMES[settings.currentTheme];
    if (!theme) return;
    
    await soundManagerRef.current.playSound(event, theme, volume);
    
    // Add haptic feedback if enabled
    if (settings.enableHaptics && 'vibrate' in navigator) {
      const hapticPatterns: Record<SoundEvent, number | number[]> = {
        diceRoll: [20, 10, 20],
        criticalHit: [50, 25, 50],
        criticalMiss: 10,
        levelUp: [100, 50, 100, 50, 100],
        damage: 30,
        healing: [10, 10, 10],
        spellCast: [25, 10, 25],
        buttonClick: 5,
        modalOpen: 15,
        modalClose: 10,
        notification: 20,
        error: [30, 20, 30],
        success: [15, 10, 15],
        combat: [40, 20, 40],
        ambient: 0
      };
      
      const pattern = hapticPatterns[event];
      if (pattern) {
        navigator.vibrate(pattern);
      }
    }
  }, [settings.currentTheme, settings.enableHaptics]);

  const preloadSounds = useCallback(async (themeId?: string) => {
    if (!soundManagerRef.current) return;
    
    const theme = SOUND_THEMES[themeId || settings.currentTheme];
    if (!theme) return;
    
    await soundManagerRef.current.preloadSounds(theme);
  }, [settings.currentTheme]);

  const getCurrentTheme = useCallback((): SoundTheme => {
    return SOUND_THEMES[settings.currentTheme] || SOUND_THEMES.fantasy;
  }, [settings.currentTheme]);

  const isPlaying = useCallback((event: SoundEvent): boolean => {
    return soundManagerRef.current?.isPlaying(event) ?? false;
  }, []);

  const stopSound = useCallback((event: SoundEvent) => {
    soundManagerRef.current?.stopSound(event);
  }, []);

  const stopAllSounds = useCallback(() => {
    soundManagerRef.current?.stopAllSounds();
  }, []);

  const contextValue: SoundContextType = {
    settings,
    updateSettings,
    playSound,
    preloadSounds,
    getCurrentTheme,
    isPlaying,
    stopSound,
    stopAllSounds
  };

  return (
    <SoundContext.Provider value={contextValue}>
      {children}
    </SoundContext.Provider>
  );
}

// Convenience hooks for common sound events
export function useDiceSound() {
  const { playSound } = useSoundThemes();
  return useCallback((critical?: 'hit' | 'miss') => {
    if (critical === 'hit') {
      playSound('criticalHit');
    } else if (critical === 'miss') {
      playSound('criticalMiss');
    } else {
      playSound('diceRoll');
    }
  }, [playSound]);
}

export function useUISound() {
  const { playSound } = useSoundThemes();
  return {
    click: useCallback(() => playSound('buttonClick'), [playSound]),
    modalOpen: useCallback(() => playSound('modalOpen'), [playSound]),
    modalClose: useCallback(() => playSound('modalClose'), [playSound]),
    success: useCallback(() => playSound('success'), [playSound]),
    error: useCallback(() => playSound('error'), [playSound]),
    notification: useCallback(() => playSound('notification'), [playSound])
  };
}

export function useGameSound() {
  const { playSound } = useSoundThemes();
  return {
    damage: useCallback(() => playSound('damage'), [playSound]),
    healing: useCallback(() => playSound('healing'), [playSound]),
    spellCast: useCallback(() => playSound('spellCast'), [playSound]),
    levelUp: useCallback(() => playSound('levelUp'), [playSound]),
    combat: useCallback(() => playSound('combat'), [playSound])
  };
}
