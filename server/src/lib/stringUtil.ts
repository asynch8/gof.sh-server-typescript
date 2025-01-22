export function addSuffix(str: string, suffix: string): string {
    return str.endsWith(suffix) ? str : str + suffix;
}

export function addPrefix(str: string, prefix: string): string {
    return str.startsWith(prefix) ? str : prefix + str;
}

export function removePrefix(str: string, prefix: string): string {
    return str.startsWith(prefix) ? str.substring(prefix.length) : str;
}

export function removeSuffix(str: string, suffix: string): string {
    return str.endsWith(suffix) ? str.substring(0, str.length - suffix.length) : str;
}