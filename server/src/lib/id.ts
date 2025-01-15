import { v4 as uuidv4 } from 'uuid';
/**
 * Generates a random string of a given length.
 * @param length - The length of the string to generate.
 * @returns A random string of the specified length.
 */
export function makeid(length: number = 10): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

export function generateUUID(): string {
    return uuidv4();
}
