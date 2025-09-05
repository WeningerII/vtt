import { mat4, vec3, quat, vec4 } from "gl-matrix";

export enum CameraType {
  PERSPECTIVE = "perspective",
  ORTHOGRAPHIC = "orthographic",
}

export interface CameraSettings {
  type: CameraType;
  fov?: number;
  aspect?: number;
  near: number;
  far: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

export class Camera {
  public position = vec3.create();
  public rotation = quat.create();
  public target = vec3.create();
  public up = vec3.fromValues(0, 1, 0);

  public viewMatrix = mat4.create();
  public projectionMatrix = mat4.create();
  public viewProjectionMatrix = mat4.create();
  public inverseViewMatrix = mat4.create();
  public inverseProjectionMatrix = mat4.create();

  public settings: CameraSettings;
  private dirty = true;
  private frustumPlanes = new Float32Array(24); // 6 planes * 4 components

  constructor(settings: CameraSettings) {
    this.settings = { ...settings };
    this.updateProjectionMatrix();
  }

  setPosition(x: number, y: number, z: number): void {
    vec3.set(this.position, x, y, z);
    this.dirty = true;
  }

  getPosition(): vec3 {
    return this.position;
  }

  get near(): number {
    return this.settings.near;
  }

  get far(): number {
    return this.settings.far;
  }

  get aspect(): number {
    return this.settings.aspect || 1.0;
  }

  get fov(): number {
    return this.settings.fov || Math.PI / 4;
  }

  getForward(): vec3 {
    const forward = vec3.create();
    vec3.transformQuat(forward, vec3.fromValues(0, 0, -1), this.rotation);
    return forward;
  }

  getRight(): vec3 {
    const right = vec3.create();
    vec3.transformQuat(right, vec3.fromValues(1, 0, 0), this.rotation);
    return right;
  }

  getUp(): vec3 {
    const up = vec3.create();
    vec3.transformQuat(up, vec3.fromValues(0, 1, 0), this.rotation);
    return up;
  }

  setRotation(x: number, y: number, z: number, w: number): void {
    quat.set(this.rotation, x, y, z, w);
    this.dirty = true;
  }

  lookAt(target: vec3): void {
    vec3.copy(this.target, target);
    mat4.lookAt(this.viewMatrix, this.position, target, this.up);
    mat4.invert(this.inverseViewMatrix, this.viewMatrix);
    this.extractRotationFromViewMatrix();
    this.updateViewProjectionMatrix();
    this.updateFrustumPlanes();
    this.dirty = false;
  }

  setTarget(x: number, y: number, z: number): void {
    vec3.set(this.target, x, y, z);
    this.dirty = true;
  }

  translate(delta: vec3): void {
    vec3.add(this.position, this.position, delta);
    this.dirty = true;
  }

  rotate(axis: vec3, angle: number): void {
    const rotation = quat.create();
    quat.setAxisAngle(rotation, axis, angle);
    quat.multiply(this.rotation, this.rotation, rotation);
    this.dirty = true;
  }

  rotateX(angle: number): void {
    this.rotate(vec3.fromValues(1, 0, 0), angle);
  }

  rotateY(angle: number): void {
    this.rotate(vec3.fromValues(0, 1, 0), angle);
  }

  rotateZ(angle: number): void {
    this.rotate(vec3.fromValues(0, 0, 1), angle);
  }

  moveForward(distance: number): void {
    const forward = this.getForwardVector();
    vec3.scaleAndAdd(this.position, this.position, forward, distance);
    this.dirty = true;
  }

  moveBackward(distance: number): void {
    this.moveForward(-distance);
  }

  moveRight(distance: number): void {
    const right = this.getRightVector();
    vec3.scaleAndAdd(this.position, this.position, right, distance);
    this.dirty = true;
  }

  moveLeft(distance: number): void {
    this.moveRight(-distance);
  }

  moveUp(distance: number): void {
    const up = this.getUpVector();
    vec3.scaleAndAdd(this.position, this.position, up, distance);
    this.dirty = true;
  }

  moveDown(distance: number): void {
    this.moveUp(-distance);
  }

  getForwardVector(): vec3 {
    const forward = vec3.create();
    vec3.transformQuat(forward, vec3.fromValues(0, 0, -1), this.rotation);
    return forward;
  }

  getRightVector(): vec3 {
    const right = vec3.create();
    vec3.transformQuat(right, vec3.fromValues(1, 0, 0), this.rotation);
    return right;
  }

  getUpVector(): vec3 {
    const up = vec3.create();
    vec3.transformQuat(up, vec3.fromValues(0, 1, 0), this.rotation);
    return up;
  }

  updateMatrices(): void {
    if (!this.dirty) {return;}

    // Update view matrix from position and rotation
    const translationMatrix = mat4.create();
    const rotationMatrix = mat4.create();

    mat4.fromTranslation(translationMatrix, this.position);
    mat4.fromQuat(rotationMatrix, this.rotation);

    mat4.multiply(this.viewMatrix, rotationMatrix, translationMatrix);
    mat4.invert(this.viewMatrix, this.viewMatrix);
    mat4.invert(this.inverseViewMatrix, this.viewMatrix);

    this.updateViewProjectionMatrix();
    this.updateFrustumPlanes();
    this.dirty = false;
  }

  private updateViewProjectionMatrix(): void {
    mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
  }

  private extractRotationFromViewMatrix(): void {
    const _rotationMatrix = mat4.create();
    mat4.getRotation(this.rotation, this.inverseViewMatrix);
  }

  updateProjectionMatrix(): void {
    if (this.settings.type === CameraType.PERSPECTIVE) {
      mat4.perspective(
        this.projectionMatrix,
        this.settings.fov || Math.PI / 4,
        this.settings.aspect || 1,
        this.settings.near,
        this.settings.far,
      );
    } else {
      mat4.ortho(
        this.projectionMatrix,
        this.settings.left || -1,
        this.settings.right || 1,
        this.settings.bottom || -1,
        this.settings.top || 1,
        this.settings.near,
        this.settings.far,
      );
    }

    mat4.invert(this.inverseProjectionMatrix, this.projectionMatrix);
    this.updateViewProjectionMatrix();
    this.updateFrustumPlanes();
  }

  private updateFrustumPlanes(): void {
    // Extract frustum planes from view-projection matrix
    const vp = this.viewProjectionMatrix;

    // Left plane
    this.frustumPlanes[0] = (vp[3] ?? 0) + (vp[0] ?? 0);
    this.frustumPlanes[1] = (vp[7] ?? 0) + (vp[4] ?? 0);
    this.frustumPlanes[2] = (vp[11] ?? 0) + (vp[8] ?? 0);
    this.frustumPlanes[3] = (vp[15] ?? 0) + (vp[12] ?? 0);

    // Right plane
    this.frustumPlanes[4] = (vp[3] ?? 0) - (vp[0] ?? 0);
    this.frustumPlanes[5] = (vp[7] ?? 0) - (vp[4] ?? 0);
    this.frustumPlanes[6] = (vp[11] ?? 0) - (vp[8] ?? 0);
    this.frustumPlanes[7] = (vp[15] ?? 0) - (vp[12] ?? 0);

    // Top plane
    this.frustumPlanes[8] = (vp[3] ?? 0) - (vp[1] ?? 0);
    this.frustumPlanes[9] = (vp[7] ?? 0) - (vp[5] ?? 0);
    this.frustumPlanes[10] = (vp[11] ?? 0) - (vp[9] ?? 0);
    this.frustumPlanes[11] = (vp[15] ?? 0) - (vp[13] ?? 0);

    // Bottom plane
    this.frustumPlanes[12] = (vp[3] ?? 0) + (vp[1] ?? 0);
    this.frustumPlanes[13] = (vp[7] ?? 0) + (vp[5] ?? 0);
    this.frustumPlanes[14] = (vp[11] ?? 0) + (vp[9] ?? 0);
    this.frustumPlanes[15] = (vp[15] ?? 0) + (vp[13] ?? 0);

    // Near plane
    this.frustumPlanes[16] = (vp[3] ?? 0) + (vp[2] ?? 0);
    this.frustumPlanes[17] = (vp[7] ?? 0) + (vp[6] ?? 0);
    this.frustumPlanes[18] = (vp[11] ?? 0) + (vp[10] ?? 0);
    this.frustumPlanes[19] = (vp[15] ?? 0) + (vp[14] ?? 0);

    // Far plane
    this.frustumPlanes[20] = (vp[3] ?? 0) - (vp[2] ?? 0);
    this.frustumPlanes[21] = (vp[7] ?? 0) - (vp[6] ?? 0);
    this.frustumPlanes[22] = (vp[11] ?? 0) - (vp[10] ?? 0);
    this.frustumPlanes[23] = (vp[15] ?? 0) - (vp[14] ?? 0);

    // Normalize planes
    for (let i = 0; i < 6; i++) {
      const offset = i * 4;
      const p0 = this.frustumPlanes[offset] ?? 0;
      const p1 = this.frustumPlanes[offset + 1] ?? 0;
      const p2 = this.frustumPlanes[offset + 2] ?? 0;
      const p3 = this.frustumPlanes[offset + 3] ?? 0;
      
      const length = Math.sqrt(p0 * p0 + p1 * p1 + p2 * p2);

      if (length > 0) {
        this.frustumPlanes[offset] = p0 / length;
        this.frustumPlanes[offset + 1] = p1 / length;
        this.frustumPlanes[offset + 2] = p2 / length;
        this.frustumPlanes[offset + 3] = p3 / length;
      }
    }
  }

  // Frustum culling methods
  isPointInFrustum(point: vec3): boolean {
    for (let i = 0; i < 6; i++) {
      const offset = i * 4;
      const distance =
        (this.frustumPlanes[offset] ?? 0) * (point[0] ?? 0) +
        (this.frustumPlanes[offset + 1] ?? 0) * (point[1] ?? 0) +
        (this.frustumPlanes[offset + 2] ?? 0) * (point[2] ?? 0) +
        (this.frustumPlanes[offset + 3] ?? 0);

      if (distance < 0) {return false;}
    }
    return true;
  }

  isSphereInFrustum(center: vec3, radius: number): boolean {
    for (let i = 0; i < 6; i++) {
      const offset = i * 4;
      const distance =
        (this.frustumPlanes[offset] ?? 0) * (center[0] ?? 0) +
        (this.frustumPlanes[offset + 1] ?? 0) * (center[1] ?? 0) +
        (this.frustumPlanes[offset + 2] ?? 0) * (center[2] ?? 0) +
        (this.frustumPlanes[offset + 3] ?? 0);

      if (distance < -radius) {return false;}
    }
    return true;
  }

  isAABBInFrustum(min: vec3, max: vec3): boolean {
    for (let i = 0; i < 6; i++) {
      const offset = i * 4;
      const nx = this.frustumPlanes[offset] ?? 0;
      const ny = this.frustumPlanes[offset + 1] ?? 0;
      const nz = this.frustumPlanes[offset + 2] ?? 0;
      const d = this.frustumPlanes[offset + 3] ?? 0;

      const px = nx > 0 ? (max[0] ?? 0) : (min[0] ?? 0);
      const py = ny > 0 ? (max[1] ?? 0) : (min[1] ?? 0);
      const pz = nz > 0 ? (max[2] ?? 0) : (min[2] ?? 0);

      if (nx * px + ny * py + nz * pz + d < 0) {
        return false;
      }
    }
    return true;
  }

  // Ray casting
  screenToWorldRay(
    screenX: number,
    screenY: number,
    viewportWidth: number,
    viewportHeight: number,
  ): { origin: vec3; direction: vec3 } {
    // Convert screen coordinates to NDC
    const ndcX = (2 * screenX) / viewportWidth - 1;
    const ndcY = 1 - (2 * screenY) / viewportHeight;

    // Convert to clip space
    const clipCoords = vec4.fromValues(ndcX, ndcY, -1, 1);

    // Convert to eye space
    const eyeCoords = vec4.create();
    vec4.transformMat4(eyeCoords, clipCoords, this.inverseProjectionMatrix);
    eyeCoords[2] = -1;
    eyeCoords[3] = 0;

    // Convert to world space
    const worldCoords = vec4.create();
    vec4.transformMat4(worldCoords, eyeCoords, this.inverseViewMatrix);

    const direction = vec3.fromValues(worldCoords[0] ?? 0, worldCoords[1] ?? 0, worldCoords[2] ?? 0);
    vec3.normalize(direction, direction);

    return {
      origin: vec3.clone(this.position),
      direction,
    };
  }

  // Settings
  setFOV(fov: number): void {
    this.settings.fov = fov;
    this.updateProjectionMatrix();
  }

  setAspectRatio(aspect: number): void {
    this.settings.aspect = aspect;
    this.updateProjectionMatrix();
  }

  setNearFar(near: number, far: number): void {
    this.settings.near = near;
    this.settings.far = far;
    this.updateProjectionMatrix();
  }

  setOrthographicBounds(left: number, right: number, bottom: number, top: number): void {
    this.settings.left = left;
    this.settings.right = right;
    this.settings.bottom = bottom;
    this.settings.top = top;
    this.updateProjectionMatrix();
  }

  getFrustumPlanes(): Float32Array {
    return this.frustumPlanes;
  }

  getSettings(): CameraSettings {
    return { ...this.settings };
  }
}
