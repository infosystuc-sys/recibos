// Tipos de la File System Access API que todavía no están en lib.dom.d.ts
// de esta versión de TypeScript. Solo Chrome y Edge la implementan.

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemDirectoryHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string
    mode?: 'read' | 'readwrite'
    startIn?: string
  }): Promise<FileSystemDirectoryHandle>
}
