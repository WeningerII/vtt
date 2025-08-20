/**
 * A naive broadphase that simply returns all pairs. Real
 * implementations would use spatial hashing or BVH to reduce pair
 * counts.
 */
export class Broadphase {
  private objects: unknown[] = [];
  add(obj: unknown): void {
    this.objects.push(obj);
  }
  query(): Array<[unknown, unknown]> {
    const pairs: Array<[unknown, unknown]> = [];
    for (let i = 0; i < this.objects.length; i++) {
      for (let j = i + 1; j < this.objects.length; j++) {
        pairs.push([this.objects[i], this.objects[j]]);
      }
    }
    return pairs;
  }
}