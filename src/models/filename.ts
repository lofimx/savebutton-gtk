const INVALID_CHARS_REGEX = /[ #?&+=!*'()<>[\]{}"@^~`;\\|]/;

export class Filename {
  private _value: string;

  constructor(filename: string) {
    this._value = filename;
  }

  isValid(): boolean {
    return !INVALID_CHARS_REGEX.test(this._value);
  }

  get value(): string {
    return this._value;
  }
}
