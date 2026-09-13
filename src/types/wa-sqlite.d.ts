declare module '@journeyapps/wa-sqlite/src/VFS.js' {
  export class Base {
    mxPathName: number;
    xOpen(name: string | null, fileId: number, flags: number, pOutFlags: DataView): number;
    xClose(fileId: number): number;
    xRead(fileId: number, data: Uint8Array, offset: number): number;
    xFileSize(fileId: number, size: DataView): number;
    xAccess(name: string, flags: number, result: DataView): number;
    xSectorSize(fileId: number): number;
    xDeviceCharacteristics(fileId: number): number;
  }
}
