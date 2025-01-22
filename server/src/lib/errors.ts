export class AuthenticationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthenticationError';
    }
}

export class EmptyDirectoryError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EmptyDirectoryError';
    }
}

export class FileNotFound extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileNotFound';
    }
}

export class NotSupported extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotSupported';
    }
}

export class InvalidFileExtension extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidFileExtension';
    }
}

export class UploadValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UploadValidationError';
    }
}
