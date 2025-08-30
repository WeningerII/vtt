import { vec3, mat4 } from 'gl-matrix';

export interface AudioListener {
  position: vec3;
  orientation: {
    forward: vec3;
    up: vec3;
  };
  velocity?: vec3;
}

export interface AudioSource {
  id: string;
  position: vec3;
  velocity?: vec3;
  volume: number;
  pitch: number;
  
  // Spatial properties
  minDistance: number;
  maxDistance: number;
  rolloffFactor: number;
  coneInnerAngle: number;
  coneOuterAngle: number;
  coneOuterGain: number;
  orientation?: vec3;
  
  // Audio properties
  buffer: AudioBuffer | null;
  loop: boolean;
  autoplay: boolean;
  
  // State
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  
  // Effects
  effects: AudioEffect[];
  
  // 3D properties
  dopplerFactor: number;
  distanceModel: 'linear' | 'inverse' | 'exponential';
}

export interface AudioEffect {
  type: 'reverb' | 'delay' | 'filter' | 'distortion' | 'chorus' | 'compressor';
  enabled: boolean;
  parameters: { [key: string]: number };
}

export interface ReverbSettings {
  roomSize: number;
  decay: number;
  damping: number;
  earlyReflections: number;
  lateReflections: number;
  diffusion: number;
  density: number;
  wetGain: number;
  dryGain: number;
}

export interface AudioZone {
  id: string;
  bounds: {
    center: vec3;
    size: vec3;
    rotation?: mat4;
  };
  reverbSettings: ReverbSettings;
  ambientSounds: string[];
  acousticProperties: {
    absorption: number;
    reflection: number;
    transmission: number;
  };
}

export class SpatialAudioEngine {
  private audioContext: AudioContext;
  private listener: AudioListener;
  private sources = new Map<string, AudioSource>();
  private zones = new Map<string, AudioZone>();
  
  // Web Audio nodes
  private masterGainNode: GainNode;
  private compressorNode: DynamicsCompressorNode;
  private convolverNode: ConvolverNode;
  private analyserNode: AnalyserNode;
  
  // HRTF and spatial processing
  private pannerNodes = new Map<string, PannerNode>();
  private gainNodes = new Map<string, GainNode>();
  private sourceNodes = new Map<string, AudioBufferSourceNode>();
  
  // Audio loading and management
  private audioBuffers = new Map<string, AudioBuffer>();
  private loadingPromises = new Map<string, Promise<AudioBuffer>>();
  
  // Performance and analysis
  private analyserData: {
    frequencyData: Float32Array;
    timeData: Float32Array;
    volume: number;
  };
  
  // Configuration
  private config = {
    maxSources: 64,
    masterVolume: 1.0,
    dopplerFactor: 1.0,
    speedOfSound: 343.3, // m/s
    enableHRTF: true,
    enableReverb: true,
    enableOcclusion: true,
    enableDoppler: true,
    updateInterval: 16, // ms (~60fps)
  };
  
  private updateTimer: number | null = null;
  private lastUpdateTime = 0;
  
  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.listener = {
      position: vec3.create(),
      orientation: {
        forward: vec3.fromValues(0, 0, -1),
        up: vec3.fromValues(0, 1, 0)
      }
    };
    
    this.initializeAudioGraph();
    this.initializeAnalyser();
    this.startUpdateLoop();
  }

  private initializeAudioGraph(): void {
    const ctx = this.audioContext;
    
    // Create master audio graph
    this.masterGainNode = ctx.createGain();
    this.compressorNode = ctx.createDynamicsCompressor();
    this.convolverNode = ctx.createConvolver();
    
    // Set up compressor
    this.compressorNode.threshold.value = -24;
    this.compressorNode.knee.value = 30;
    this.compressorNode.ratio.value = 12;
    this.compressorNode.attack.value = 0.003;
    this.compressorNode.release.value = 0.25;
    
    // Connect master chain
    this.masterGainNode.connect(this.compressorNode);
    this.compressorNode.connect(ctx.destination);
    
    // Set master volume
    this.masterGainNode.gain.value = this.config.masterVolume;
    
    // Set up listener
    if (ctx.listener.positionX) {
      // Modern Web Audio API
      ctx.listener.positionX.value = this.listener.position[0];
      ctx.listener.positionY.value = this.listener.position[1];
      ctx.listener.positionZ.value = this.listener.position[2];
      
      ctx.listener.forwardX.value = this.listener.orientation.forward[0];
      ctx.listener.forwardY.value = this.listener.orientation.forward[1];
      ctx.listener.forwardZ.value = this.listener.orientation.forward[2];
      
      ctx.listener.upX.value = this.listener.orientation.up[0];
      ctx.listener.upY.value = this.listener.orientation.up[1];
      ctx.listener.upZ.value = this.listener.orientation.up[2];
    } else {
      // Legacy Web Audio API
      (ctx.listener as any).setPosition(
        this.listener.position[0],
        this.listener.position[1],
        this.listener.position[2]
      );
      
      (ctx.listener as any).setOrientation(
        this.listener.orientation.forward[0],
        this.listener.orientation.forward[1],
        this.listener.orientation.forward[2],
        this.listener.orientation.up[0],
        this.listener.orientation.up[1],
        this.listener.orientation.up[2]
      );
    }
  }

  private initializeAnalyser(): void {
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;
    
    this.compressorNode.connect(this.analyserNode);
    
    this.analyserData = {
      frequencyData: new Float32Array(this.analyserNode.frequencyBinCount),
      timeData: new Float32Array(this.analyserNode.frequencyBinCount),
      volume: 0
    };
  }

  private startUpdateLoop(): void {
    this.updateTimer = window.setInterval(() => {
      this.update();
    }, this.config.updateInterval);
  }

  private update(): void {
    const now = performance.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;
    
    // Update all sources
    for (const source of this.sources.values()) {
      this.updateSource(source, deltaTime);
    }
    
    // Update analyser data
    this.updateAnalyser();
  }

  private updateSource(source: AudioSource, deltaTime: number): void {
    if (!source.isPlaying) return;
    
    const pannerNode = this.pannerNodes.get(source.id);
    const gainNode = this.gainNodes.get(source.id);
    
    if (!pannerNode || !gainNode) return;
    
    // Update 3D position
    this.updateSourcePosition(source, pannerNode);
    
    // Update volume based on distance and effects
    const volume = this.calculateSourceVolume(source);
    gainNode.gain.value = volume;
    
    // Update current time for non-looping sources
    if (!source.loop) {
      source.currentTime += deltaTime;
      if (source.currentTime >= source.duration) {
        this.stopSource(source.id);
      }
    }
    
    // Apply zone effects
    this.applyZoneEffects(source);
  }

  private updateSourcePosition(source: AudioSource, pannerNode: PannerNode): void {
    const _ctx = this.audioContext;
    
    if (pannerNode.positionX) {
      // Modern API
      pannerNode.positionX.value = source.position[0];
      pannerNode.positionY.value = source.position[1];
      pannerNode.positionZ.value = source.position[2];
      
      if (source.orientation) {
        pannerNode.orientationX.value = source.orientation[0];
        pannerNode.orientationY.value = source.orientation[1];
        pannerNode.orientationZ.value = source.orientation[2];
      }
    } else {
      // Legacy API
      (pannerNode as any).setPosition(source.position[0], source.position[1], source.position[2]);
      
      if (source.orientation) {
        (pannerNode as any).setOrientation(source.orientation[0], source.orientation[1], source.orientation[2]);
      }
    }
    
    // Update velocity for Doppler effect
    if (this.config.enableDoppler && source.velocity) {
      if (pannerNode.positionX) {
        // Modern API doesn't have velocity, so we skip Doppler for now
        // In a real implementation, you'd calculate pitch shift manually
      } else {
        (pannerNode as any).setVelocity(source.velocity[0], source.velocity[1], source.velocity[2]);
      }
    }
  }

  private calculateSourceVolume(source: AudioSource): number {
    const distance = vec3.distance(source.position, this.listener.position);
    let volume = source.volume;
    
    // Distance attenuation
    switch (source.distanceModel) {
      case 'linear':
        if (distance <= source.minDistance) {
          volume *= 1;
        } else if (distance >= source.maxDistance) {
          volume *= 0;
        } else {
          const ratio = (distance - source.minDistance) / (source.maxDistance - source.minDistance);
          volume *= (1 - ratio);
        }
        break;
        
      case 'inverse':
        volume *= source.minDistance / (source.minDistance + source.rolloffFactor * (distance - source.minDistance));
        break;
        
      case 'exponential':
        volume *= Math.pow(distance / source.minDistance, -source.rolloffFactor);
        break;
    }
    
    // Cone attenuation
    if (source.orientation) {
      const angle = this.calculateConeAngle(source);
      if (angle > source.coneInnerAngle) {
        if (angle > source.coneOuterAngle) {
          volume *= source.coneOuterGain;
        } else {
          const ratio = (angle - source.coneInnerAngle) / (source.coneOuterAngle - source.coneInnerAngle);
          volume *= (1 - ratio) + ratio * source.coneOuterGain;
        }
      }
    }
    
    // Occlusion (simplified)
    if (this.config.enableOcclusion) {
      const occlusion = this.calculateOcclusion(source);
      volume *= (1 - occlusion);
    }
    
    return Math.max(0, Math.min(1, volume));
  }

  private calculateConeAngle(source: AudioSource): number {
    if (!source.orientation) return 0;
    
    const toListener = vec3.subtract(vec3.create(), this.listener.position, source.position);
    vec3.normalize(toListener, toListener);
    
    const dot = vec3.dot(source.orientation, toListener);
    return Math.acos(Math.max(-1, Math.min(1, dot)));
  }

  private calculateOcclusion(_source: AudioSource): number {
    // Simplified occlusion calculation
    // In a real implementation, this would use raycasting against the scene geometry
    return 0;
  }

  private applyZoneEffects(source: AudioSource): void {
    const zone = this.getCurrentZone(source.position);
    if (!zone) return;
    
    // Apply reverb based on zone settings
    if (this.config.enableReverb) {
      this.updateReverbForZone(zone);
    }
  }

  private getCurrentZone(position: vec3): AudioZone | null {
    for (const zone of this.zones.values()) {
      if (this.isPositionInZone(position, zone)) {
        return zone;
      }
    }
    return null;
  }

  private isPositionInZone(position: vec3, zone: AudioZone): boolean {
    // Simple box bounds check
    const bounds = zone.bounds;
    const halfSize = vec3.scale(vec3.create(), bounds.size, 0.5);
    
    const localPos = vec3.subtract(vec3.create(), position, bounds.center);
    
    return Math.abs(localPos[0]) <= halfSize[0] &&
           Math.abs(localPos[1]) <= halfSize[1] &&
           Math.abs(localPos[2]) <= halfSize[2];
  }

  private updateReverbForZone(_zone: AudioZone): void {
    // Update convolver node with zone's reverb settings
    // This would require generating impulse responses based on zone properties
    // For now, this is a placeholder
  }

  private updateAnalyser(): void {
    this.analyserNode.getFloatFrequencyData(this.analyserData.frequencyData);
    this.analyserNode.getFloatTimeDomainData(this.analyserData.timeData);
    
    // Calculate RMS volume
    let rms = 0;
    for (let i = 0; i < this.analyserData.timeData.length; i++) {
      rms += this.analyserData.timeData[i] * this.analyserData.timeData[i];
    }
    this.analyserData.volume = Math.sqrt(rms / this.analyserData.timeData.length);
  }

  // Public API
  async loadAudio(id: string, url: string): Promise<AudioBuffer> {
    if (this.audioBuffers.has(id)) {
      return this.audioBuffers.get(id)!;
    }
    
    if (this.loadingPromises.has(id)) {
      return this.loadingPromises.get(id)!;
    }
    
    const loadingPromise = this.fetchAndDecodeAudio(url);
    this.loadingPromises.set(id, loadingPromise);
    
    try {
      const buffer = await loadingPromise;
      this.audioBuffers.set(id, buffer);
      this.loadingPromises.delete(id);
      return buffer;
    } catch (error) {
      this.loadingPromises.delete(id);
      throw error;
    }
  }

  private async fetchAndDecodeAudio(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return this.audioContext.decodeAudioData(arrayBuffer);
  }

  createSource(config: Partial<AudioSource> & { id: string }): AudioSource {
    const source: AudioSource = {
      position: vec3.create(),
      velocity: vec3.create(),
      volume: 1.0,
      pitch: 1.0,
      minDistance: 1.0,
      maxDistance: 100.0,
      rolloffFactor: 1.0,
      coneInnerAngle: Math.PI * 2,
      coneOuterAngle: Math.PI * 2,
      coneOuterGain: 0.0,
      buffer: null,
      loop: false,
      autoplay: false,
      isPlaying: false,
      isPaused: false,
      currentTime: 0,
      duration: 0,
      effects: [],
      dopplerFactor: 1.0,
      distanceModel: 'inverse',
      ...config
    };
    
    if (source.buffer) {
      source.duration = source.buffer.duration;
    }
    
    this.sources.set(source.id, source);
    this.createAudioNodes(source);
    
    if (source.autoplay) {
      this.playSource(source.id);
    }
    
    return source;
  }

  private createAudioNodes(source: AudioSource): void {
    const ctx = this.audioContext;
    
    // Create gain node for volume control
    const gainNode = ctx.createGain();
    gainNode.gain.value = source.volume;
    this.gainNodes.set(source.id, gainNode);
    
    // Create panner node for 3D positioning
    const pannerNode = ctx.createPanner();
    pannerNode.panningModel = 'HRTF';
    pannerNode.distanceModel = source.distanceModel;
    pannerNode.refDistance = source.minDistance;
    pannerNode.maxDistance = source.maxDistance;
    pannerNode.rolloffFactor = source.rolloffFactor;
    pannerNode.coneInnerAngle = source.coneInnerAngle;
    pannerNode.coneOuterAngle = source.coneOuterAngle;
    pannerNode.coneOuterGain = source.coneOuterGain;
    
    this.pannerNodes.set(source.id, pannerNode);
    
    // Connect nodes
    gainNode.connect(pannerNode);
    pannerNode.connect(this.masterGainNode);
  }

  playSource(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (!source || !source.buffer) return;
    
    // Stop existing source node if playing
    this.stopSource(sourceId);
    
    const ctx = this.audioContext;
    const gainNode = this.gainNodes.get(sourceId);
    
    if (!gainNode) return;
    
    // Create new source node
    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = source.buffer;
    sourceNode.loop = source.loop;
    sourceNode.playbackRate.value = source.pitch;
    
    // Connect source to gain
    sourceNode.connect(gainNode);
    
    // Store reference and start playing
    this.sourceNodes.set(sourceId, sourceNode);
    sourceNode.start(0, source.currentTime);
    
    source.isPlaying = true;
    source.isPaused = false;
    
    // Handle end event
    sourceNode.onended = () => {
      if (!source.loop) {
        source.isPlaying = false;
        source.currentTime = 0;
        this.sourceNodes.delete(sourceId);
      }
    };
  }

  pauseSource(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (!source || !source.isPlaying) return;
    
    this.stopSource(sourceId);
    source.isPaused = true;
  }

  stopSource(sourceId: string): void {
    const source = this.sources.get(sourceId);
    const sourceNode = this.sourceNodes.get(sourceId);
    
    if (sourceNode) {
      sourceNode.stop();
      sourceNode.disconnect();
      this.sourceNodes.delete(sourceId);
    }
    
    if (source) {
      source.isPlaying = false;
      source.isPaused = false;
      source.currentTime = 0;
    }
  }

  updateListener(listener: Partial<AudioListener>): void {
    Object.assign(this.listener, listener);
    
    const ctx = this.audioContext;
    
    if (ctx.listener.positionX) {
      ctx.listener.positionX.value = this.listener.position[0];
      ctx.listener.positionY.value = this.listener.position[1];
      ctx.listener.positionZ.value = this.listener.position[2];
      
      ctx.listener.forwardX.value = this.listener.orientation.forward[0];
      ctx.listener.forwardY.value = this.listener.orientation.forward[1];
      ctx.listener.forwardZ.value = this.listener.orientation.forward[2];
      
      ctx.listener.upX.value = this.listener.orientation.up[0];
      ctx.listener.upY.value = this.listener.orientation.up[1];
      ctx.listener.upZ.value = this.listener.orientation.up[2];
    } else {
      (ctx.listener as any).setPosition(
        this.listener.position[0],
        this.listener.position[1],
        this.listener.position[2]
      );
      
      (ctx.listener as any).setOrientation(
        this.listener.orientation.forward[0],
        this.listener.orientation.forward[1],
        this.listener.orientation.forward[2],
        this.listener.orientation.up[0],
        this.listener.orientation.up[1],
        this.listener.orientation.up[2]
      );
    }
  }

  updateSourcePosition(sourceId: string, position: vec3): void {
    const source = this.sources.get(sourceId);
    if (source) {
      vec3.copy(source.position, position);
    }
  }

  updateSourceVelocity(sourceId: string, velocity: vec3): void {
    const source = this.sources.get(sourceId);
    if (source) {
      if (!source.velocity) source.velocity = vec3.create();
      vec3.copy(source.velocity, velocity);
    }
  }

  setMasterVolume(volume: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, volume));
    this.masterGainNode.gain.value = this.config.masterVolume;
  }

  createAudioZone(zone: AudioZone): void {
    this.zones.set(zone.id, zone);
  }

  removeAudioZone(zoneId: string): void {
    this.zones.delete(zoneId);
  }

  removeSource(sourceId: string): void {
    this.stopSource(sourceId);
    
    const gainNode = this.gainNodes.get(sourceId);
    const pannerNode = this.pannerNodes.get(sourceId);
    
    if (gainNode) {
      gainNode.disconnect();
      this.gainNodes.delete(sourceId);
    }
    
    if (pannerNode) {
      pannerNode.disconnect();
      this.pannerNodes.delete(sourceId);
    }
    
    this.sources.delete(sourceId);
  }

  getAnalyserData(): typeof this.analyserData {
    return this.analyserData;
  }

  getStats() {
    const activeSources = Array.from(this.sources.values()).filter(s => s.isPlaying).length;
    
    return {
      activeSources,
      totalSources: this.sources.size,
      loadedBuffers: this.audioBuffers.size,
      audioZones: this.zones.size,
      contextState: this.audioContext.state,
      sampleRate: this.audioContext.sampleRate,
      masterVolume: this.config.masterVolume,
      memoryUsage: this.getMemoryUsage()
    };
  }

  private getMemoryUsage(): number {
    let totalBytes = 0;
    
    for (const buffer of this.audioBuffers.values()) {
      totalBytes += buffer.length * buffer.numberOfChannels * 4; // 32-bit float
    }
    
    return totalBytes;
  }

  suspend(): void {
    this.audioContext.suspend();
  }

  resume(): void {
    this.audioContext.resume();
  }

  dispose(): void {
    // Stop all sources
    for (const sourceId of this.sources.keys()) {
      this.removeSource(sourceId);
    }
    
    // Clear update timer
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    // Disconnect audio graph
    this.masterGainNode.disconnect();
    this.compressorNode.disconnect();
    this.convolverNode.disconnect();
    this.analyserNode.disconnect();
    
    // Clear maps
    this.sources.clear();
    this.zones.clear();
    this.audioBuffers.clear();
    this.loadingPromises.clear();
    this.pannerNodes.clear();
    this.gainNodes.clear();
    this.sourceNodes.clear();
    
    // Close audio context
    this.audioContext.close();
  }
}
