const resizeMock = jest.fn().mockReturnThis();
const rotateMock = jest.fn().mockReturnThis();
const pipeMock = jest.fn().mockImplementation((stream) => stream);
const sharpProps = {
    resize: resizeMock,
    rotate: rotateMock
};
const getFileStats = jest.fn();
const moveFile = jest.fn();
const removeFiles = jest.fn();

// Mock external dependencies
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => sharpProps);
});

jest.mock('../../src/clients/content', () => ({
  getContentByPublicName: jest.fn(),
  getContentByNameAndCreator: jest.fn(),
  insertContent: jest.fn()
}));

jest.mock('../../src/lib/fsAdapter', () => ({
  getFileStats,
  moveFile,
  removeFiles
}));

import { FastifyRequest, FastifyReply } from 'fastify';
import { Readable } from 'stream';
import sharp from 'sharp';
import {
  handleExtension,
  generatePublicName,
  setContentDispostionHeader,
  handleUpload,
  arrGet,
  extensionMap,
  type UploadBody,
  resizeImage
} from '../../src/lib/fileUtils';
import { Content } from '../../src/clients/content';
import { FileInternal } from 'formzilla/FileInternal.js';
import { NotSupported, InvalidFileExtension, UploadValidationError } from '../../src/lib/errors';
import { DecodedJWT } from '../../src/lib/authentication';





describe('File Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resizeImage', () => {
    const mockStream = new Readable({
      read() {
        this.push(null);
      }
    });
    pipeMock.mockImplementation((stream) => mockStream);
    mockStream.pipe = pipeMock;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle basic scale resize with width and height', async () => {
      const req = {
        query: {
          resize: 'scale',
          x: '100',
          y: '200'
        }
      } as FastifyRequest;

      const result = await resizeImage(req, mockStream);
      expect(sharp).toHaveBeenCalled();
      expect(resizeMock).toHaveBeenCalledWith({
        width: 100,
        height: 200
      });
      expect(pipeMock).toHaveBeenCalledWith(sharpProps);
    });

    it('should handle crop resize', async () => {
      const req = {
        query: {
          resize: 'crop',
          width: '300',
          height: '400'
        }
      } as FastifyRequest;

      await resizeImage(req, mockStream);

      expect(sharp).toHaveBeenCalled();
      expect(resizeMock).toHaveBeenCalledWith({
        width: 300,
        height: 400,
        withoutReduction: true
      });
    });

    it('should handle fit resize with position', async () => {
      const req = {
        query: {
          resize: 'fit',
          x: '500',
          y: '600',
          position: 'center'
        }
      } as FastifyRequest;

      await resizeImage(req, mockStream);

      expect(sharp).toHaveBeenCalled();
      expect(resizeMock).toHaveBeenCalledWith({
        width: 500,
        height: 600,
        fit: 'cover',
        position: 'center'
      });
    });

    it('should handle image rotation', async () => {
      const req = {
        query: {
          rotate: 90
        }
      } as FastifyRequest;

      await resizeImage(req, mockStream);

      expect(sharp).toHaveBeenCalled();
      expect(rotateMock).toHaveBeenCalledWith(90);
    });

    it('should handle resize with only width specified', async () => {
      const req = {
        query: {
          width: '200'
        }
      } as FastifyRequest;

      await resizeImage(req, mockStream);

      expect(sharp).toHaveBeenCalled();
      expect(resizeMock).toHaveBeenCalledWith({
        width: 200,
        height: undefined
      });
    });
    it('should handle resize with only height specified', async () => {
        const req = {
          query: {
            height: '200'
          }
        } as FastifyRequest;
  
        await resizeImage(req, mockStream);
  
        expect(sharp).toHaveBeenCalled();
        expect(resizeMock).toHaveBeenCalledWith({
          width: undefined,
          height: 200
        });
      });
  });

  describe('handleExtension', () => {
    const mockStream = new Readable({
      read() {
        this.push(null);
      }
    });
    pipeMock.mockImplementation(() => mockStream);
    mockStream.pipe = pipeMock;

    it('should handle text files', async () => {
      const storedFile: Content = {
        id: '123',
        name: 'test.txt',
        contentType: 'text/plain',
        size: 100,
        contentFormat: '',
        fileHash: '',
        createdBy: 'user1',
        publicName: '',
        views: 0,
        directory: '/',
        burnAfter: 0,
        deleteKey: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        encrypted: false,
        password: ''
      };

      const req = {
        query: {}
      } as FastifyRequest & { query: { ft?: string } };

      const result = await handleExtension(storedFile, mockStream, req);
      expect(result.type).toBe('text/plain');
      expect(result.stream).toBe(mockStream);
    });

    it('should handle image resizing', async () => {
      const storedFile: Content = {
        id: '123',
        name: 'test.jpg',
        contentType: 'image/jpeg',
        size: 100,
        contentFormat: '',
        fileHash: '',
        createdBy: 'user1',
        publicName: '',
        views: 0,
        directory: '/',
        burnAfter: 0,
        deleteKey: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        encrypted: false,
        password: ''
      };

      const req = {
        query: {
          resize: 'scale',
          x: 100,
          y: 100
        }
      } as FastifyRequest & { query: { ft?: string } };

      const result = await handleExtension(storedFile, mockStream, req);
      expect(result.type).toBe('image/jpeg');
      expect(sharp).toHaveBeenCalled();
      expect(resizeMock).toHaveBeenCalledWith({ width: 100, height: 100 });
      expect(pipeMock).toHaveBeenCalledWith(sharpProps);
    });

    it('should throw error for unsupported directory conversion', async () => {
      const storedFile: Content = {
        id: '123',
        name: 'folder',
        contentType: 'text/directory',
        size: 100,
        contentFormat: '',
        fileHash: '',
        createdBy: 'user1',
        publicName: '',
        views: 0,
        directory: '/',
        burnAfter: 0,
        deleteKey: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        encrypted: false,
        password: ''
      };

      const req = {
        query: {
          ft: 'txt'
        }
      } as FastifyRequest & { query: { ft?: string } };

      await expect(handleExtension(storedFile, mockStream, req))
        .rejects
        .toThrow(NotSupported);
    });
  });

  describe('handleUpload', () => {
    const mockFile: FileInternal = {
      path: '/tmp/test.txt',
      originalName: 'test.txt',
      mimeType: 'text/plain',
      field: 'file',
      encoding: 'utf-8',
      stream: new Readable(),
      data: Buffer.from(''),
      error: undefined
    };

    const mockUser: DecodedJWT = {
      userId: 'user1',
      permissions: ['create'],
      iat: 123,
      exp: 456
    };

    it('should handle anonymous upload with restrictions', async () => {
      const uploadParams = {
        user: undefined,
        tempFile: mockFile,
        publicParam: true,
        expiresAt: null,
        burnAfterReads: null,
        customName: null,
        prefix: '/',
        contentFormat: null,
        password: null,
        encrypted: false
      };
      getFileStats.mockResolvedValue({ size: 100 });
      await expect(handleUpload(uploadParams))
        .resolves
        .toMatchObject({
          name: 'test.txt',
          contentType: 'text/plain'
        });
    });

    it('should reject private anonymous upload', async () => {
      const uploadParams = {
        user: undefined,
        tempFile: mockFile,
        publicParam: false,
        expiresAt: null,
        burnAfterReads: null,
        customName: null,
        prefix: '/',
        contentFormat: null,
        password: null,
        encrypted: false
      };

      await expect(handleUpload(uploadParams))
        .rejects
        .toThrow(UploadValidationError);
    });
  });

  describe('arrGet utility', () => {
    it('should handle array access', () => {
      expect(arrGet(['a', 'b', 'c'], 1, 'default')).toBe('b');
      expect(arrGet(['a'], 1, 'default')).toBe('default');
      expect(arrGet('single', 0, 'default')).toBe('single');
      expect(arrGet(undefined, 0, 'default')).toBe('default');
    });
  });

  describe('setContentDispostionHeader', () => {
    it('should set correct header for files', () => {
      const mockReply = {
        header: jest.fn()
      } as unknown as FastifyReply;

      const file: Content = {
        id: '123',
        name: 'test.txt',
        contentType: 'text/plain',
        size: 100,
        contentFormat: '',
        fileHash: '',
        createdBy: 'user1',
        publicName: '',
        views: 0,
        directory: '/',
        burnAfter: 0,
        deleteKey: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        encrypted: false,
        password: ''
      };

      setContentDispostionHeader(mockReply, file);
      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=test.txt'
      );
    });

    it('should add zip extension for directories', () => {
      const mockReply = {
        header: jest.fn()
      } as unknown as FastifyReply;

      const directory: Content = {
        id: '123',
        name: 'folder',
        contentType: 'text/directory',
        size: 100,
        contentFormat: '',
        fileHash: '',
        createdBy: 'user1',
        publicName: '',
        views: 0,
        directory: '/',
        burnAfter: 0,
        deleteKey: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        encrypted: false,
        password: ''
      };

      setContentDispostionHeader(mockReply, directory);
      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=folder.zip'
      );
    });
  });

  
}); 