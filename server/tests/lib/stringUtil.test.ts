import {
  addSuffix,
  addPrefix,
  removePrefix,
  removeSuffix
} from '../../src/lib/stringUtil';

describe('String Utilities', () => {
  describe('addSuffix', () => {
    it('should add suffix when not present', () => {
      expect(addSuffix('test', '.txt')).toBe('test.txt');
      expect(addSuffix('hello', 'world')).toBe('helloworld');
      expect(addSuffix('', '.txt')).toBe('.txt');
    });

    it('should not add suffix when already present', () => {
      expect(addSuffix('test.txt', '.txt')).toBe('test.txt');
      expect(addSuffix('helloworld', 'world')).toBe('helloworld');
    });
  });

  describe('addPrefix', () => {
    it('should add prefix when not present', () => {
      expect(addPrefix('test.txt', 'prefix-')).toBe('prefix-test.txt');
      expect(addPrefix('world', 'hello')).toBe('helloworld');
      expect(addPrefix('', 'prefix-')).toBe('prefix-');
    });

    it('should not add prefix when already present', () => {
      expect(addPrefix('prefix-test.txt', 'prefix-')).toBe('prefix-test.txt');
      expect(addPrefix('helloworld', 'hello')).toBe('helloworld');
    });
  });

  describe('removePrefix', () => {
    it('should remove prefix when present', () => {
      expect(removePrefix('prefix-test.txt', 'prefix-')).toBe('test.txt');
      expect(removePrefix('helloworld', 'hello')).toBe('world');
    });

    it('should not modify string when prefix not present', () => {
      expect(removePrefix('test.txt', 'prefix-')).toBe('test.txt');
      expect(removePrefix('world', 'hello')).toBe('world');
      expect(removePrefix('', 'prefix-')).toBe('');
    });
  });

  describe('removeSuffix', () => {
    it('should remove suffix when present', () => {
      expect(removeSuffix('test.txt', '.txt')).toBe('test');
      expect(removeSuffix('helloworld', 'world')).toBe('hello');
    });

    it('should not modify string when suffix not present', () => {
      expect(removeSuffix('test', '.txt')).toBe('test');
      expect(removeSuffix('hello', 'world')).toBe('hello');
      expect(removeSuffix('', '.txt')).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should handle strings with multiple occurrences', () => {
      expect(addSuffix('test.txt.txt', '.txt')).toBe('test.txt.txt');
      expect(addPrefix('prefix-prefix-test', 'prefix-')).toBe('prefix-prefix-test');
      expect(removePrefix('prefix-prefix-test', 'prefix-')).toBe('prefix-test');
      expect(removeSuffix('test.txt.txt', '.txt')).toBe('test.txt');
    });
  });
}); 