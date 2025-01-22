import fs from 'fs';
const fsMock = fs as jest.Mocked<typeof fs>;
import path from 'path';
import { PassThrough } from 'stream';
import { Content } from '../../../../src/clients/content';
import { FileNotFound, NotSupported } from '../../../../src/lib/errors';
import {
  getFileStream,
  getFileStats,
  moveFile,
  removeFile,
  replacePartInFile
} from '../../../../src/lib/fsAdapter/adapters/local';


// Mock fs and path modules
jest.mock('fs');

describe('Local FileSystem Adapter', () => {
  const mockFilePath = 'test-file.txt';
  const mockContent: Content = {
    id: 'test-id',
    name: 'test.txt',
    contentType: 'text/plain',
    size: 100,
    createdBy: 'user1',
    createdAt: new Date(),
    updatedAt: new Date(),
    publicName: 'test.txt',
    contentFormat: 'text/plain',
    burnAfter: 1000,
    deleteKey: 'test-delete-key',
    encrypted: false,
    fileHash: 'test-file-hash',
    directory: '',
    password: 'test-password',
    views: 0
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFileStream', () => {
    it('should create a readable stream for existing file', async () => {
      const mockReadStream = new PassThrough();
      (fs.statSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue(mockReadStream);

      const stream = await getFileStream(mockContent);
      expect(stream).toBeDefined();
      expect(stream).toBeInstanceOf(PassThrough);
      expect(fs.createReadStream).toHaveBeenCalled();
    });

    it('should throw FileNotFound for non-existent file', async () => {
      (fs.statSync as jest.Mock).mockReturnValue(false);

      await expect(getFileStream(mockContent))
        .rejects
        .toThrow(FileNotFound);
    });

    it('should throw NotSupported for directory content type', async () => {
      const dirContent = { ...mockContent, contentType: 'text/directory' };

      await expect(getFileStream(dirContent))
        .rejects
        .toThrow(NotSupported);
    });
  });

  describe('replacePartInFile', () => {
    it('should replace content in file successfully', async () => {
      const originalContent = 'Hello World';
      const replacement = 'Hi';
      
      (fs.statSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(originalContent);
      
      const result = await replacePartInFile(mockFilePath, replacement, 0, 5);
      
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('getFileStats', () => {
    it('should return correct stats for a file', async () => {
      const mockStats = {
        size: 1000,
        isFile: () => true
      };
      
      (fs.statSync as jest.Mock).mockReturnValue(mockStats);

      const stats = await getFileStats(mockFilePath);
      expect(stats).toEqual({
        size: 1000,
        type: 'text/file'
      });
    });

    it('should return correct stats for a directory', async () => {
      const mockStats = {
        size: 0,
        isFile: () => false
      };
      
      (fs.statSync as jest.Mock).mockReturnValue(mockStats);

      const stats = await getFileStats(mockFilePath);
      expect(stats).toEqual({
        size: 0,
        type: 'text/directory'
      });
    });
  });

  describe('removeFile', () => {
    it('should remove existing file successfully', async () => {
      (fs.statSync as jest.Mock).mockReturnValue({
        isFile: () => true
      });

      const result = await removeFile(mockFilePath);
      expect(result).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should return false for non-existent file', async () => {
      (fs.statSync as jest.Mock).mockReturnValue(false);

      const result = await removeFile(mockFilePath);
      expect(result).toBe(false);
    });
  });
}); 