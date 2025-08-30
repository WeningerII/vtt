import { logger } from '@vtt/logging';

/**
 * Audio System
 * Handles ambient sounds, music, spatial audio, and sound effects
 */

export interface AudioSource {
  id: string;
  type: 'music' | 'ambient' | 'effect' | 'voice';
  url: string;
  volume: number;
  loop: boolean;
  autoplay: boolean;
  fadeIn?: number; // ms
  fadeOut?: number; // ms
  
  // Spatial audio properties
  is3D: boolean;
  position?: { x: number; y: number; z?: number };
  maxDistance: number;
  rolloffFactor: number;
  
  // Playback state
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  
  // Metadata
  title?: string;
  artist?: string;
  tags: string[];
  
  // Conditions for auto-play
  conditions?: AudioCondition[];
}

export interface AudioCondition {
  type: 'scene' | 'combat' | 'time' | 'weather' | 'token_proximity' | 'custom';
  value: any;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
}

export interface AudioPlaylist {
  id: string;
  name: string;
  description?: string;
  tracks: string[]; // Audio source IDs
  shuffle: boolean;
  repeat: 'none' | 'playlist' | 'track';
  crossfade: number; // ms
  currentTrack: number;
  isPlaying: boolean;
}

export interface SpatialAudioSettings {
  enabled: boolean;
  listenerPosition: { x: number; y: number; z: number };
  listenerOrientation: { forward: { x: number; y: number; z: number }; up: { x: number; y: number; z: number } };
  dopplerFactor: number;
  speedOfSound: number;
  distanceModel: 'linear' | 'inverse' | 'exponential';
}

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  ambientVolume: number;
  effectVolume: number;
  voiceVolume: number;
  muted: boolean;
  spatialAudio: SpatialAudioSettings;
  enableCompressor: boolean;
  enableReverb: boolean;
  reverbSettings: {
    roomSize: number;
    damping: number;
    wetness: number;
  };
}

export class AudioSystem {
  private audioContext: AudioContext | null = null;
  private audioSources: Map<string, AudioSource> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private playlists: Map<string, AudioPlaylist> = new Map();
  private settings: AudioSettings;
  
  // Web Audio API nodes
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private effectGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverb: ConvolverNode | null = null;
  
  // Spatial audio
  private listener: AudioListener | null = null;
  private pannerNodes: Map<string, PannerNode> = new Map();
  
  private changeListeners: Array<(_event: AudioEvent) => void> = [];
  private fadeIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(settings: Partial<AudioSettings> = {}) {
    this.settings = {
      masterVolume: 1.0,
      musicVolume: 0.8,
      ambientVolume: 0.6,
      effectVolume: 0.9,
      voiceVolume: 1.0,
      muted: false,
      spatialAudio: {
        enabled: true,
        listenerPosition: { x: 0, y: 0, z: 0 },
        listenerOrientation: {
          forward: { x: 0, y: 0, z: -1 },
          up: { x: 0, y: 1, z: 0 }
        },
        dopplerFactor: 1,
        speedOfSound: 343.3,
        distanceModel: 'inverse'
      },
      enableCompressor: true,
      enableReverb: false,
      reverbSettings: {
        roomSize: 0.3,
        damping: 0.2,
        wetness: 0.1
      },
      ...settings
    };

    this.initializeAudioContext();
  }

  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (this.audioContext.state === 'suspended') {
        // Wait for user interaction to resume context
        await this.audioContext.suspend();
      }

      this.setupAudioNodes();
      this.setupSpatialAudio();
      
      this.emitEvent({
        type: 'audio-context-initialized',
        data: { sampleRate: this.audioContext.sampleRate }
      });
    } catch (error) {
      logger.error('Failed to initialize audio context:', error);
      this.emitEvent({
        type: 'audio-error',
        data: { error: 'Failed to initialize audio context' }
      });
    }
  }

  private setupAudioNodes(): void {
    if (!this.audioContext) return;

    // Create gain nodes for different audio types
    this.masterGain = this.audioContext.createGain();
    this.musicGain = this.audioContext.createGain();
    this.ambientGain = this.audioContext.createGain();
    this.effectGain = this.audioContext.createGain();
    this.voiceGain = this.audioContext.createGain();

    // Set initial volumes
    this.masterGain.gain.value = this.settings.masterVolume;
    this.musicGain.gain.value = this.settings.musicVolume;
    this.ambientGain.gain.value = this.settings.ambientVolume;
    this.effectGain.gain.value = this.settings.effectVolume;
    this.voiceGain.gain.value = this.settings.voiceVolume;

    // Setup compressor
    if (this.settings.enableCompressor) {
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;
    }

    // Setup reverb
    if (this.settings.enableReverb) {
      this.setupReverb();
    }

    // Connect the audio graph
    this.connectAudioGraph();
  }

  private setupReverb(): void {
    if (!this.audioContext) return;

    this.reverb = this.audioContext.createConvolver();
    
    // Create impulse response for reverb
    const impulseResponse = this.createImpulseResponse();
    this.reverb.buffer = impulseResponse;
  }

  private createImpulseResponse(): AudioBuffer {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * 2; // 2 seconds
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);

    const { roomSize,  damping,  wetness  } = this.settings.reverbSettings;

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - damping, i / sampleRate);
        const noise = (Math.random() * 2 - 1) * decay * roomSize;
        channelData[i] = noise * wetness;
      }
    }

    return impulse;
  }

  private connectAudioGraph(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Connect gain nodes
    this.musicGain?.connect(this.masterGain);
    this.ambientGain?.connect(this.masterGain);
    this.effectGain?.connect(this.masterGain);
    this.voiceGain?.connect(this.masterGain);

    // Connect effects
    if (this.compressor) {
      this.masterGain.connect(this.compressor);
      if (this.reverb) {
        this.compressor.connect(this.reverb);
        this.reverb.connect(this.audioContext.destination);
      } else {
        this.compressor.connect(this.audioContext.destination);
      }
    } else if (this.reverb) {
      this.masterGain.connect(this.reverb);
      this.reverb.connect(this.audioContext.destination);
    } else {
      this.masterGain.connect(this.audioContext.destination);
    }
  }

  private setupSpatialAudio(): void {
    if (!this.audioContext || !this.settings.spatialAudio.enabled) return;

    this.listener = this.audioContext.listener;
    
    if (this.listener.positionX) {
      // Modern AudioListener interface
      this.listener.positionX.value = this.settings.spatialAudio.listenerPosition.x;
      this.listener.positionY.value = this.settings.spatialAudio.listenerPosition.y;
      this.listener.positionZ.value = this.settings.spatialAudio.listenerPosition.z;
      
      this.listener.forwardX.value = this.settings.spatialAudio.listenerOrientation.forward.x;
      this.listener.forwardY.value = this.settings.spatialAudio.listenerOrientation.forward.y;
      this.listener.forwardZ.value = this.settings.spatialAudio.listenerOrientation.forward.z;
      
      this.listener.upX.value = this.settings.spatialAudio.listenerOrientation.up.x;
      this.listener.upY.value = this.settings.spatialAudio.listenerOrientation.up.y;
      this.listener.upZ.value = this.settings.spatialAudio.listenerOrientation.up.z;
    } else {
      // Legacy AudioListener interface
      this.listener.setPosition(
        this.settings.spatialAudio.listenerPosition.x,
        this.settings.spatialAudio.listenerPosition.y,
        this.settings.spatialAudio.listenerPosition.z
      );
      
      this.listener.setOrientation(
        this.settings.spatialAudio.listenerOrientation.forward.x,
        this.settings.spatialAudio.listenerOrientation.forward.y,
        this.settings.spatialAudio.listenerOrientation.forward.z,
        this.settings.spatialAudio.listenerOrientation.up.x,
        this.settings.spatialAudio.listenerOrientation.up.y,
        this.settings.spatialAudio.listenerOrientation.up.z
      );
    }
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async resumeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      this.emitEvent({
        type: 'audio-context-resumed',
        data: Record<string, any>
      });
    }
  }

  /**
   * Add audio source
   */
  async addAudioSource(source: AudioSource): Promise<void> {
    this.audioSources.set(source.id, source);

    // Create HTML audio element
    const audio = new Audio();
    audio.src = source.url;
    audio.loop = source.loop;
    audio.volume = source.volume;
    
    // Set up event listeners
    audio.addEventListener('loadedmetadata', () => {
      source.duration = audio.duration;
    });
    
    audio.addEventListener('timeupdate', () => {
      source.currentTime = audio.currentTime;
    });
    
    audio.addEventListener('play', () => {
      source.isPlaying = true;
      source.isPaused = false;
      this.emitEvent({
        type: 'audio-play',
        data: { sourceId: source.id }
      });
    });
    
    audio.addEventListener('pause', () => {
      source.isPlaying = false;
      source.isPaused = true;
      this.emitEvent({
        type: 'audio-pause',
        data: { sourceId: source.id }
      });
    });
    
    audio.addEventListener('ended', () => {
      source.isPlaying = false;
      source.isPaused = false;
      this.emitEvent({
        type: 'audio-ended',
        data: { sourceId: source.id }
      });
    });

    this.audioElements.set(source.id, audio);

    // Setup spatial audio if needed
    if (source.is3D && source.position) {
      await this.setupSpatialSource(source.id);
    }

    // Auto-play if specified
    if (source.autoplay) {
      await this.playAudio(source.id);
    }

    this.emitEvent({
      type: 'audio-source-added',
      data: { sourceId: source.id, source }
    });
  }

  private async setupSpatialSource(sourceId: string): Promise<void> {
    if (!this.audioContext) return;

    const source = this.audioSources.get(sourceId);
    const audioElement = this.audioElements.get(sourceId);
    
    if (!source || !audioElement || !source.is3D || !source.position) return;

    try {
      // Create MediaElementSourceNode
      const mediaSource = this.audioContext.createMediaElementSource(audioElement);
      
      // Create PannerNode for 3D positioning
      const panner = this.audioContext.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = this.settings.spatialAudio.distanceModel;
      panner.maxDistance = source.maxDistance;
      panner.rolloffFactor = source.rolloffFactor;
      
      // Set position
      if (panner.positionX) {
        panner.positionX.value = source.position.x;
        panner.positionY.value = source.position.y;
        panner.positionZ.value = source.position.z || 0;
      } else {
        panner.setPosition(source.position.x, source.position.y, source.position.z || 0);
      }
      
      // Connect audio graph
      const gainNode = this.getGainNodeForType(source.type);
      if (gainNode) {
        mediaSource.connect(panner);
        panner.connect(gainNode);
      }
      
      this.pannerNodes.set(sourceId, panner);
    } catch (error) {
      logger.error(`Failed to setup spatial audio for ${sourceId}:`, error);
    }
  }

  private getGainNodeForType(type: AudioSource['type']): GainNode | null {
    switch (type) {
      case 'music': return this.musicGain;
      case 'ambient': return this.ambientGain;
      case 'effect': return this.effectGain;
      case 'voice': return this.voiceGain;
      default: return this.masterGain;
    }
  }

  /**
   * Play audio source
   */
  async playAudio(sourceId: string, fadeIn?: number): Promise<void> {
    const audio = this.audioElements.get(sourceId);
    const source = this.audioSources.get(sourceId);
    
    if (!audio || !source) return;

    try {
      await this.resumeAudioContext();
      
      if (fadeIn || source.fadeIn) {
        await this.fadeIn(sourceId, fadeIn || source.fadeIn!);
      } else {
        await audio.play();
      }
    } catch (error) {
      logger.error(`Failed to play audio ${sourceId}:`, error);
      this.emitEvent({
        type: 'audio-error',
        data: { sourceId, error: 'Failed to play audio' }
      });
    }
  }

  /**
   * Pause audio source
   */
  pauseAudio(sourceId: string): void {
    const audio = this.audioElements.get(sourceId);
    if (audio) {
      audio.pause();
    }
  }

  /**
   * Stop audio source
   */
  async stopAudio(sourceId: string, fadeOut?: number): Promise<void> {
    const audio = this.audioElements.get(sourceId);
    const source = this.audioSources.get(sourceId);
    
    if (!audio || !source) return;

    if (fadeOut || source.fadeOut) {
      await this.fadeOut(sourceId, fadeOut || source.fadeOut!);
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  /**
   * Set audio volume
   */
  setVolume(sourceId: string, volume: number): void {
    const audio = this.audioElements.get(sourceId);
    const source = this.audioSources.get(sourceId);
    
    if (audio && source) {
      audio.volume = Math.max(0, Math.min(1, volume));
      source.volume = audio.volume;
      
      this.emitEvent({
        type: 'audio-volume-changed',
        data: { sourceId, volume: audio.volume }
      });
    }
  }

  /**
   * Update spatial audio position
   */
  updateSpatialPosition(sourceId: string, position: { x: number; y: number; z?: number }): void {
    const source = this.audioSources.get(sourceId);
    const panner = this.pannerNodes.get(sourceId);
    
    if (!source || !panner || !source.is3D) return;

    source.position = position;
    
    if (panner.positionX) {
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z || 0;
    } else {
      panner.setPosition(position.x, position.y, position.z || 0);
    }
  }

  /**
   * Update listener position for spatial audio
   */
  updateListenerPosition(position: { x: number; y: number; z: number }): void {
    if (!this.listener) return;

    this.settings.spatialAudio.listenerPosition = position;
    
    if (this.listener.positionX) {
      this.listener.positionX.value = position.x;
      this.listener.positionY.value = position.y;
      this.listener.positionZ.value = position.z;
    } else {
      this.listener.setPosition(position.x, position.y, position.z);
    }
  }

  private async fadeIn(sourceId: string, duration: number): Promise<void> {
    const audio = this.audioElements.get(sourceId);
    if (!audio) return;

    const originalVolume = audio.volume;
    audio.volume = 0;
    
    await audio.play();
    
    return new Promise<void>((_resolve) => {
      const steps = 20;
      const stepDuration = duration / steps;
      const volumeStep = originalVolume / steps;
      let currentStep = 0;
      
      const interval = setInterval(() => {
        currentStep++;
        audio.volume = Math.min(originalVolume, volumeStep * currentStep);
        
        if (currentStep >= steps) {
          clearInterval(interval);
          resolve();
        }
      }, stepDuration);
      
      this.fadeIntervals.set(sourceId, interval);
    });
  }

  private async fadeOut(sourceId: string, duration: number): Promise<void> {
    const audio = this.audioElements.get(sourceId);
    if (!audio) return;

    const originalVolume = audio.volume;
    
    return new Promise<void>((_resolve) => {
      const steps = 20;
      const stepDuration = duration / steps;
      const volumeStep = originalVolume / steps;
      let currentStep = 0;
      
      const interval = setInterval(() => {
        currentStep++;
        audio.volume = Math.max(0, originalVolume - (volumeStep * currentStep));
        
        if (currentStep >= steps || audio.volume === 0) {
          clearInterval(interval);
          audio.pause();
          audio.currentTime = 0;
          audio.volume = originalVolume;
          resolve();
        }
      }, stepDuration);
      
      this.fadeIntervals.set(sourceId, interval);
    });
  }

  /**
   * Create playlist
   */
  createPlaylist(playlist: AudioPlaylist): void {
    this.playlists.set(playlist.id, playlist);
    
    this.emitEvent({
      type: 'playlist-created',
      data: { playlistId: playlist.id, playlist }
    });
  }

  /**
   * Play playlist
   */
  async playPlaylist(playlistId: string): Promise<void> {
    const playlist = this.playlists.get(playlistId);
    if (!playlist || playlist.tracks.length === 0) return;

    playlist.isPlaying = true;
    
    if (playlist.shuffle) {
      playlist.currentTrack = Math.floor(Math.random() * playlist.tracks.length);
    } else {
      playlist.currentTrack = 0;
    }

    await this.playCurrentTrack(playlistId);
  }

  private async playCurrentTrack(playlistId: string): Promise<void> {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) return;

    const currentTrackId = playlist.tracks[playlist.currentTrack];
    if (!currentTrackId) return;

    // Set up ended listener for auto-advance
    const audio = this.audioElements.get(currentTrackId);
    if (audio) {
      const endedHandler = () => {
        audio.removeEventListener('ended', endedHandler);
        this.advancePlaylist(playlistId);
      };
      audio.addEventListener('ended', endedHandler);
    }

    await this.playAudio(currentTrackId, playlist.crossfade);
  }

  private async advancePlaylist(playlistId: string): Promise<void> {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) return;

    if (playlist.shuffle) {
      playlist.currentTrack = Math.floor(Math.random() * playlist.tracks.length);
    } else {
      playlist.currentTrack = (playlist.currentTrack + 1) % playlist.tracks.length;
    }

    // Check repeat settings
    if (playlist.currentTrack === 0 && playlist.repeat === 'none') {
      playlist.isPlaying = false;
      return;
    }

    await this.playCurrentTrack(playlistId);
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...newSettings };

    // Update gain nodes
    if (this.masterGain && newSettings.masterVolume !== undefined) {
      this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.masterVolume;
    }
    if (this.musicGain && newSettings.musicVolume !== undefined) {
      this.musicGain.gain.value = this.settings.musicVolume;
    }
    if (this.ambientGain && newSettings.ambientVolume !== undefined) {
      this.ambientGain.gain.value = this.settings.ambientVolume;
    }
    if (this.effectGain && newSettings.effectVolume !== undefined) {
      this.effectGain.gain.value = this.settings.effectVolume;
    }
    if (this.voiceGain && newSettings.voiceVolume !== undefined) {
      this.voiceGain.gain.value = this.settings.voiceVolume;
    }

    this.emitEvent({
      type: 'settings-updated',
      data: { settings: this.settings }
    });
  }

  /**
   * Check if audio conditions are met
   */
  checkAudioConditions(gameState: any): void {
    for (const source of this.audioSources.values()) {
      if (!source.conditions) continue;

      const shouldPlay = this.evaluateConditions(source.conditions, gameState);
      
      if (shouldPlay && !source.isPlaying && !source.isPaused) {
        this.playAudio(source.id);
      } else if (!shouldPlay && source.isPlaying) {
        this.stopAudio(source.id);
      }
    }
  }

  private evaluateConditions(conditions: AudioCondition[], gameState: any): boolean {
    return conditions.every(condition => {
      const contextValue = this.getContextValue(condition.type, gameState);
      return this.compareValues(contextValue, condition.value, condition.operator);
    });
  }

  private getContextValue(type: AudioCondition['type'], gameState: any): any {
    switch (type) {
      case 'scene': return gameState.currentSceneId;
      case 'combat': return gameState.inCombat;
      case 'time': return gameState.gameTime;
      case 'weather': return gameState.weather;
      case 'token_proximity': return gameState.tokenProximity;
      default: return gameState[type];
    }
  }

  private compareValues(contextValue: any, conditionValue: any, operator: AudioCondition['operator']): boolean {
    switch (operator) {
      case 'equals': return contextValue === conditionValue;
      case 'not_equals': return contextValue !== conditionValue;
      case 'greater_than': return contextValue > conditionValue;
      case 'less_than': return contextValue < conditionValue;
      case 'contains': return String(contextValue).includes(String(conditionValue));
      default: return false;
    }
  }

  /**
   * Get all audio sources
   */
  getAudioSources(): AudioSource[] {
    return Array.from(this.audioSources.values());
  }

  /**
   * Get settings
   */
  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * Cleanup
   */
  dispose(): void {
    // Clear all fade intervals
    this.fadeIntervals.forEach(interval => clearInterval(interval));
    this.fadeIntervals.clear();

    // Stop all audio
    this.audioElements.forEach(audio => {
      audio.pause();
      audio.src = '';
    });

    // Clear collections
    this.audioSources.clear();
    this.audioElements.clear();
    this.playlists.clear();
    this.pannerNodes.clear();

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.changeListeners = [];
  }

  // Event system
  addEventListener(listener: (event: AudioEvent) => void): void {
    this.changeListeners.push(listener);
  }

  removeEventListener(listener: (event: AudioEvent) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  private emitEvent(event: AudioEvent): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.error('Audio event listener error:', error);
      }
    });
  }
}

// Event types
export type AudioEvent =
  | { type: 'audio-context-initialized'; data: { sampleRate: number } }
  | { type: 'audio-context-resumed'; data: Record<string, unknown>}
  | { type: 'audio-source-added'; data: { sourceId: string; source: AudioSource } }
  | { type: 'audio-play'; data: { sourceId: string } }
  | { type: 'audio-pause'; data: { sourceId: string } }
  | { type: 'audio-ended'; data: { sourceId: string } }
  | { type: 'audio-volume-changed'; data: { sourceId: string; volume: number } }
  | { type: 'playlist-created'; data: { playlistId: string; playlist: AudioPlaylist } }
  | { type: 'settings-updated'; data: { settings: AudioSettings } }
  | { type: 'audio-error'; data: { sourceId?: string; error: string } };
