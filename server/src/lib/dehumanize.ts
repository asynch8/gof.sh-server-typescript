

// This a play on words refering to the 'humanize-plus'
export function filesizeToBytes(filesize: number, unit: string): number {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const index = units.indexOf(unit);
    if (index === -1) {
        throw new Error('Invalid unit');
    }
    return filesize * Math.pow(1024, index);
}

export function bytesToFilesize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, index)).toFixed(2) + ' ' + units[index];
}
