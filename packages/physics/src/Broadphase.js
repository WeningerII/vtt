/**
 * A naive broadphase that simply returns all pairs. Real
 * implementations would use spatial hashing or BVH to reduce pair
 * counts.
 */
export class Broadphase {
  constructor() {
    this.objects = [];
  }
  add(obj) {
    this.objects.push(obj);
  }
  query() {
    const pairs = [];
    for (let i = 0; i < this.objects.length; i++) {
      for (let j = i + 1; j < this.objects.length; j++) {
        pairs.push([this.objects[i], this.objects[j]]);
      }
    }
    return pairs;
  }
}
//# sourceMappingURL=Broadphase.js.map
