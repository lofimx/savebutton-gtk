export class TagsList {
  private _tags: string[] = [];

  constructor(initialTags?: string[]) {
    if (initialTags) {
      this._tags = [...initialTags];
    }
  }

  get tags(): string[] {
    return [...this._tags];
  }

  get length(): number {
    return this._tags.length;
  }

  add(tag: string): void {
    this._tags.push(tag);
  }

  removeLast(): string | undefined {
    return this._tags.pop();
  }

  withPending(pendingText: string): string[] {
    const trimmed = pendingText.trim();
    return trimmed.length > 0 ? [...this._tags, trimmed] : [...this._tags];
  }
}
