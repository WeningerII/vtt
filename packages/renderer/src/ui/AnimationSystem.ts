export type EasingFunction = (t: number) => number;

export interface AnimationConfig {
  duration: number;
  delay?: number;
  easing?: EasingFunction | string;
  loop?: boolean | number;
  yoyo?: boolean;
  autoStart?: boolean;
  onStart?: () => void;
  onUpdate?: (_progress: number, _value: any) => void;
  onComplete?: () => void;
  onLoop?: () => void;
}

export interface Keyframe {
  time: number; // 0-1
  value: any;
  easing?: EasingFunction;
}

export interface AnimationTrack {
  property: string;
  keyframes: Keyframe[];
  interpolation?: "linear" | "step" | "bezier" | "hermite";
}

export interface Timeline {
  id: string;
  duration: number;
  tracks: AnimationTrack[];
  loop: boolean;
  currentTime: number;
  isPlaying: boolean;
  isPaused: boolean;
  onUpdate?: (_time: number, _normalizedTime: number) => void;
  onComplete?: () => void;
}

export class AnimationSystem {
  private animations = new Map<string, Animation>();
  private timelines = new Map<string, Timeline>();
  private animationId = 0;
  private timelineId = 0;
  private isRunning = false;
  private lastTime = 0;
  private animationFrameId: number | null = null;

  // Built-in easing functions
  static readonly Easing = {
    linear: (t: number) => t,

    // Quad
    easeInQuad: (t: number) => t * t,
    easeOutQuad: (t: number) => t * (2 - t),
    easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

    // Cubic
    easeInCubic: (t: number) => t * t * t,
    easeOutCubic: (t: number) => --t * t * t + 1,
    easeInOutCubic: (t: number) =>
      t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

    // Quart
    easeInQuart: (t: number) => t * t * t * t,
    easeOutQuart: (t: number) => 1 - --t * t * t * t,
    easeInOutQuart: (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t),

    // Elastic
    easeInElastic: (t: number) => {
      if (t === 0) {return 0;}
      if (t === 1) {return 1;}
      const p = 0.3;
      const s = p / 4;
      return -(Math.pow(2, 10 * (t -= 1)) * Math.sin(((t - s) * (2 * Math.PI)) / p));
    },
    easeOutElastic: (t: number) => {
      if (t === 0) {return 0;}
      if (t === 1) {return 1;}
      const p = 0.3;
      const s = p / 4;
      return Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / p) + 1;
    },

    // Bounce
    easeOutBounce: (t: number) => {
      if (t < 1 / 2.75) {
        return 7.5625 * t * t;
      } else if (t < 2 / 2.75) {
        return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      } else if (t < 2.5 / 2.75) {
        return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      } else {
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
      }
    },

    // Back
    easeInBack: (t: number) => {
      const s = 1.70158;
      return t * t * ((s + 1) * t - s);
    },
    easeOutBack: (t: number) => {
      const s = 1.70158;
      return --t * t * ((s + 1) * t + s) + 1;
    },
  };

  constructor() {
    this.start();
  }

  private start(): void {
    if (this.isRunning) {return;}
    this.isRunning = true;
    this.lastTime = performance.now();
    this.update();
  }

  private update(): void {
    if (!this.isRunning) {return;}

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Update animations
    for (const [id, animation] of this.animations) {
      if (!animation.isPlaying || animation.isPaused) {continue;}

      animation.currentTime += deltaTime;

      const delay = animation.config.delay ?? 0;
      if (animation.currentTime >= delay) {
        const progress = Math.min(
          (animation.currentTime - delay) / animation.config.duration,
          1,
        );

        const easedProgress = animation.easingFunction(progress);
        const currentValue = this.interpolateValues(
          animation.fromValue,
          animation.toValue,
          easedProgress,
        );

        if (animation.config.onUpdate) {
          animation.config.onUpdate(progress, currentValue);
        }

        if (animation.target && animation.property) {
          this.setProperty(animation.target, animation.property, currentValue);
        }

        if (progress >= 1) {
          this.completeAnimation(id, animation);
        }
      }
    }

    // Update timelines
    for (const [id, timeline] of this.timelines) {
      if (!timeline.isPlaying || timeline.isPaused) {continue;}

      timeline.currentTime += deltaTime;
      const normalizedTime = timeline.currentTime / timeline.duration;

      if (normalizedTime <= 1) {
        this.updateTimeline(timeline, normalizedTime);
      } else {
        if (timeline.loop) {
          timeline.currentTime = timeline.currentTime % timeline.duration;
          this.updateTimeline(timeline, timeline.currentTime / timeline.duration);
        } else {
          this.completeTimeline(id, timeline);
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.update());
  }

  private updateTimeline(timeline: Timeline, normalizedTime: number): void {
    for (const track of timeline.tracks) {
      const _value = this.evaluateTrack(track, normalizedTime);
      // Apply value to target (would need target system)
    }

    if (timeline.onUpdate) {
      timeline.onUpdate(timeline.currentTime, normalizedTime);
    }
  }

  private evaluateTrack(track: AnimationTrack, time: number): any {
    if (track.keyframes.length === 0) {return null;}
    if (track.keyframes.length === 1) {return track.keyframes[0]?.value;}

    // Find surrounding keyframes
    let keyframe1 = track.keyframes[0];
    let keyframe2 = track.keyframes[track.keyframes.length - 1];

    for (let i = 0; i < track.keyframes.length - 1; i++) {
      const currentFrame = track.keyframes[i];
      const nextFrame = track.keyframes[i + 1];
      if (currentFrame && nextFrame && time >= currentFrame.time && time <= nextFrame.time) {
        keyframe1 = currentFrame;
        keyframe2 = nextFrame;
        break;
      }
    }

    if (!keyframe1 || !keyframe2 || keyframe1 === keyframe2) {return keyframe1?.value;}

    // Interpolate between keyframes
    const duration = keyframe2.time - keyframe1.time;
    const progress = duration > 0 ? (time - keyframe1.time) / duration : 0;

    const easing = keyframe1.easing || AnimationSystem.Easing.linear;
    const easedProgress = easing(progress);

    return this.interpolateValues(keyframe1.value, keyframe2.value, easedProgress);
  }

  private completeAnimation(id: string, animation: Animation): void {
    if (animation.config.loop) {
      if (typeof animation.config.loop === "number") {
        animation.loopCount++;
        if (animation.loopCount >= animation.config.loop) {
          this.finishAnimation(id, animation);
          return;
        }
      }

      // Reset for loop
      animation.currentTime = 0;

      if (animation.config.yoyo) {
        [animation.fromValue, animation.toValue] = [animation.toValue, animation.fromValue];
      }

      if (animation.config.onLoop) {
        animation.config.onLoop();
      }
    } else {
      this.finishAnimation(id, animation);
    }
  }

  private finishAnimation(id: string, animation: Animation): void {
    if (animation.config.onComplete) {
      animation.config.onComplete();
    }
    this.animations.delete(id);
  }

  private completeTimeline(id: string, timeline: Timeline): void {
    timeline.isPlaying = false;
    if (timeline.onComplete) {
      timeline.onComplete();
    }
  }

  private interpolateValues(from: any, to: any, t: number): any {
    if (typeof from === "number" && typeof to === "number") {
      return from + (to - from) * t;
    }

    if (Array.isArray(from) && Array.isArray(to) && from.length === to.length) {
      return from.map((_val, __i) => this.interpolateValues(_val, to[__i], t));
    }

    if (typeof from === "object" && typeof to === "object") {
      const result: any = {};
      for (const key in from) {
        if (key in to) {
          result[key] = this.interpolateValues(from[key], to[key], t);
        } else {
          result[key] = from[key];
        }
      }
      return result;
    }

    return t < 0.5 ? from : to;
  }

  private setProperty(target: any, property: string, value: any): void {
    const props = property.split(".");
    let obj = target;

    for (let i = 0; i < props.length - 1; i++) {
      const prop = props[i];
      if (!prop) {return;}
      obj = obj[prop];
      if (!obj) {return;}
    }

    const finalProp = props[props.length - 1];
    if (finalProp) {
      obj[finalProp] = value;
    }
  }

  private resolveEasing(easing: EasingFunction | string): EasingFunction {
    if (typeof easing === "function") {
      return easing;
    }

    if (typeof easing === "string") {
      return (AnimationSystem.Easing as any)[easing] || AnimationSystem.Easing.linear;
    }

    return AnimationSystem.Easing.linear;
  }

  // Public API
  animate(
    target: any,
    property: string,
    fromValue: any,
    toValue: any,
    config: AnimationConfig,
  ): string {
    const id = `anim_${this.animationId++}`;
    const easingFunction = this.resolveEasing(config.easing || "linear");

    const animation: Animation = {
      id,
      target,
      property,
      fromValue,
      toValue,
      config: { ...config, delay: config.delay || 0 },
      easingFunction,
      currentTime: 0,
      isPlaying: config.autoStart !== false,
      isPaused: false,
      loopCount: 0,
    };

    // Set initial value
    if (animation.isPlaying && animation.config.delay === 0) {
      this.setProperty(target, property, fromValue);
    }

    this.animations.set(id, animation);

    if (animation.config.onStart && animation.isPlaying) {
      animation.config.onStart();
    }

    return id;
  }

  to(target: any, properties: { [key: string]: any }, config: AnimationConfig): string[] {
    const animationIds: string[] = [];

    for (const [property, toValue] of Object.entries(properties)) {
      const fromValue = this.getProperty(target, property);
      const id = this.animate(target, property, fromValue, toValue, config);
      animationIds.push(id);
    }

    return animationIds;
  }

  from(target: any, properties: { [key: string]: any }, config: AnimationConfig): string[] {
    const animationIds: string[] = [];

    for (const [property, fromValue] of Object.entries(properties)) {
      const toValue = this.getProperty(target, property);
      const id = this.animate(target, property, fromValue, toValue, config);
      animationIds.push(id);
    }

    return animationIds;
  }

  fromTo(
    target: any,
    from: { [key: string]: any },
    to: { [key: string]: any },
    config: AnimationConfig,
  ): string[] {
    const animationIds: string[] = [];

    for (const property in from) {
      if (property in to) {
        const id = this.animate(target, property, from[property], to[property], config);
        animationIds.push(id);
      }
    }

    return animationIds;
  }

  createTimeline(duration: number, loop: boolean = false): string {
    const id = `timeline_${this.timelineId++}`;
    const timeline: Timeline = {
      id,
      duration,
      tracks: [],
      loop,
      currentTime: 0,
      isPlaying: false,
      isPaused: false,
    };

    this.timelines.set(id, timeline);
    return id;
  }

  addTrackToTimeline(timelineId: string, track: AnimationTrack): void {
    const timeline = this.timelines.get(timelineId);
    if (timeline) {
      timeline.tracks.push(track);
    }
  }

  playTimeline(timelineId: string): void {
    const timeline = this.timelines.get(timelineId);
    if (timeline) {
      timeline.isPlaying = true;
      timeline.isPaused = false;
      timeline.currentTime = 0;
    }
  }

  pauseAnimation(animationId: string): void {
    const animation = this.animations.get(animationId);
    if (animation) {
      animation.isPaused = true;
    }
  }

  resumeAnimation(animationId: string): void {
    const animation = this.animations.get(animationId);
    if (animation) {
      animation.isPaused = false;
    }
  }

  stopAnimation(animationId: string): void {
    const animation = this.animations.get(animationId);
    if (animation) {
      animation.isPlaying = false;
      this.animations.delete(animationId);
    }
  }

  pauseTimeline(timelineId: string): void {
    const timeline = this.timelines.get(timelineId);
    if (timeline) {
      timeline.isPaused = true;
    }
  }

  resumeTimeline(timelineId: string): void {
    const timeline = this.timelines.get(timelineId);
    if (timeline) {
      timeline.isPaused = false;
    }
  }

  stopTimeline(timelineId: string): void {
    const timeline = this.timelines.get(timelineId);
    if (timeline) {
      timeline.isPlaying = false;
      this.timelines.delete(timelineId);
    }
  }

  private getProperty(target: any, property: string): any {
    const props = property.split(".");
    let obj = target;

    for (const prop of props) {
      obj = obj[prop];
      if (obj === undefined) {return undefined;}
    }

    return obj;
  }

  // Advanced animation methods
  sequence(animations: Array<() => string | string[]>, config?: { onComplete?: () => void }): void {
    let currentIndex = 0;

    const runNext = () => {
      if (currentIndex >= animations.length) {
        if (config?.onComplete) {config.onComplete();}
        return;
      }

      const animationFn = animations[currentIndex];
      if (!animationFn) {return;}
      const result = animationFn();
      const animIds = Array.isArray(result) ? result : [result];

      // Wait for all animations to complete
      const checkComplete = () => {
        const allComplete = animIds.every((id) => !this.animations.has(id));
        if (allComplete) {
          currentIndex++;
          runNext();
        } else {
          setTimeout(checkComplete, 16);
        }
      };

      checkComplete();
    };

    runNext();
  }

  parallel(animations: Array<() => string | string[]>, config?: { onComplete?: () => void }): void {
    const allAnimIds: string[] = [];

    for (const animFn of animations) {
      const result = animFn();
      const animIds = Array.isArray(result) ? result : [result];
      allAnimIds.push(...animIds);
    }

    // Wait for all animations to complete
    const checkComplete = () => {
      const allComplete = allAnimIds.every((id) => !this.animations.has(id));
      if (allComplete && config?.onComplete) {
        config.onComplete();
      } else if (!allComplete) {
        setTimeout(checkComplete, 16);
      }
    };

    checkComplete();
  }

  stagger(
    targets: any[],
    properties: { [key: string]: any },
    config: AnimationConfig & { stagger?: number },
  ): string[] {
    const staggerTime = config.stagger || 0.1;
    const animIds: string[] = [];

    targets.forEach((target, index) => {
      const staggeredConfig = {
        ...config,
        delay: (config.delay || 0) + index * staggerTime,
      };

      const ids = this.to(target, properties, staggeredConfig);
      animIds.push(...ids);
    });

    return animIds;
  }

  getStats() {
    return {
      activeAnimations: this.animations.size,
      activeTimelines: this.timelines.size,
      isRunning: this.isRunning,
    };
  }

  dispose(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.animations.clear();
    this.timelines.clear();
  }
}

interface Animation {
  id: string;
  target: any;
  property: string;
  fromValue: any;
  toValue: any;
  config: AnimationConfig;
  easingFunction: EasingFunction;
  currentTime: number;
  isPlaying: boolean;
  isPaused: boolean;
  loopCount: number;
}

// Global animation system instance
export const _animationSystem = new AnimationSystem();
