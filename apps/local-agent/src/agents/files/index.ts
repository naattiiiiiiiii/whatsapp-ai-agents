import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

const BASE_DIR = process.env.FILES_BASE_DIR || process.env.HOME || '/';

export class FilesAgent {
  async execute(tool: string, args: Record<string, unknown>): Promise<unknown> {
    switch (tool) {
      case 'files_search':
        return this.search(args.query as string, args.path as string, args.type as string);
      case 'files_read':
        return this.read(args.path as string);
      case 'files_create':
        return this.create(args.path as string, args.content as string);
      case 'files_list':
        return this.list(args.path as string, args.recursive as boolean);
      case 'files_organize':
        return this.organize(args.sourcePath as string, args.organizeBy as string);
      default:
        throw new Error(`Unknown files tool: ${tool}`);
    }
  }

  private async search(query: string, searchPath?: string, fileType?: string): Promise<object> {
    const basePath = this.resolvePath(searchPath || '');

    // Mapear tipos de archivo a extensiones
    const typeExtensions: Record<string, string[]> = {
      pdf: ['pdf'],
      doc: ['doc', 'docx', 'txt', 'rtf'],
      image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
      video: ['mp4', 'avi', 'mov', 'mkv', 'webm'],
      all: ['*'],
    };

    const extensions = typeExtensions[fileType || 'all'] || ['*'];
    const patterns = extensions.map(ext =>
      ext === '*' ? `**/*${query}*` : `**/*${query}*.${ext}`
    );

    const results: Array<{ name: string; path: string; size: number; modified: Date }> = [];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: basePath,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**'],
        maxDepth: 5,
      });

      for (const file of files.slice(0, 20)) {
        const fullPath = path.join(basePath, file);
        try {
          const stats = await fs.stat(fullPath);
          results.push({
            name: path.basename(file),
            path: fullPath,
            size: stats.size,
            modified: stats.mtime,
          });
        } catch {
          // Ignorar archivos sin acceso
        }
      }
    }

    return {
      query,
      found: results.length,
      files: results.slice(0, 10),
    };
  }

  private async read(filePath: string): Promise<object> {
    const resolvedPath = this.resolvePath(filePath);

    // Verificar que está dentro del directorio base
    if (!resolvedPath.startsWith(BASE_DIR)) {
      throw new Error('Access denied: path outside base directory');
    }

    const stats = await fs.stat(resolvedPath);

    // Limitar tamaño de lectura
    if (stats.size > 1024 * 1024) {
      throw new Error('File too large (max 1MB)');
    }

    const content = await fs.readFile(resolvedPath, 'utf-8');

    return {
      path: resolvedPath,
      name: path.basename(resolvedPath),
      size: stats.size,
      content: content.substring(0, 5000), // Limitar contenido
      truncated: content.length > 5000,
    };
  }

  private async create(filePath: string, content: string): Promise<object> {
    const resolvedPath = this.resolvePath(filePath);

    // Verificar que está dentro del directorio base
    if (!resolvedPath.startsWith(BASE_DIR)) {
      throw new Error('Access denied: path outside base directory');
    }

    // Crear directorios si no existen
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

    await fs.writeFile(resolvedPath, content, 'utf-8');

    return {
      path: resolvedPath,
      name: path.basename(resolvedPath),
      size: content.length,
      created: true,
    };
  }

  private async list(dirPath: string, recursive?: boolean): Promise<object> {
    const resolvedPath = this.resolvePath(dirPath);

    // Verificar que está dentro del directorio base
    if (!resolvedPath.startsWith(BASE_DIR)) {
      throw new Error('Access denied: path outside base directory');
    }

    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

    const items: Array<{
      name: string;
      type: 'file' | 'directory';
      size?: number;
      modified?: Date;
    }> = [];

    for (const entry of entries.slice(0, 50)) {
      if (entry.name.startsWith('.')) continue; // Ignorar ocultos

      const fullPath = path.join(resolvedPath, entry.name);
      const isDir = entry.isDirectory();

      try {
        const stats = await fs.stat(fullPath);
        items.push({
          name: entry.name,
          type: isDir ? 'directory' : 'file',
          size: isDir ? undefined : stats.size,
          modified: stats.mtime,
        });

        // Recursivo (solo un nivel para evitar sobrecarga)
        if (recursive && isDir && items.length < 100) {
          const subEntries = await fs.readdir(fullPath, { withFileTypes: true });
          for (const subEntry of subEntries.slice(0, 10)) {
            if (subEntry.name.startsWith('.')) continue;
            const subPath = path.join(fullPath, subEntry.name);
            const subStats = await fs.stat(subPath);
            items.push({
              name: `${entry.name}/${subEntry.name}`,
              type: subEntry.isDirectory() ? 'directory' : 'file',
              size: subEntry.isDirectory() ? undefined : subStats.size,
              modified: subStats.mtime,
            });
          }
        }
      } catch {
        // Ignorar errores de acceso
      }
    }

    return {
      path: resolvedPath,
      totalItems: items.length,
      items,
    };
  }

  private async organize(sourcePath: string, organizeBy: string): Promise<object> {
    const resolvedPath = this.resolvePath(sourcePath);

    // Verificar que está dentro del directorio base
    if (!resolvedPath.startsWith(BASE_DIR)) {
      throw new Error('Access denied: path outside base directory');
    }

    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
    const movedFiles: Array<{ from: string; to: string }> = [];

    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue;

      const fullPath = path.join(resolvedPath, entry.name);
      const stats = await fs.stat(fullPath);
      let targetDir: string;

      if (organizeBy === 'type') {
        const ext = path.extname(entry.name).toLowerCase().slice(1);
        const typeMap: Record<string, string> = {
          pdf: 'PDFs',
          doc: 'Documents', docx: 'Documents', txt: 'Documents',
          jpg: 'Images', jpeg: 'Images', png: 'Images', gif: 'Images',
          mp4: 'Videos', avi: 'Videos', mov: 'Videos',
          mp3: 'Audio', wav: 'Audio', flac: 'Audio',
          zip: 'Archives', rar: 'Archives', '7z': 'Archives',
        };
        targetDir = path.join(resolvedPath, typeMap[ext] || 'Others');
      } else if (organizeBy === 'date') {
        const date = stats.mtime;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        targetDir = path.join(resolvedPath, `${year}`, month);
      } else if (organizeBy === 'size') {
        const size = stats.size;
        let sizeCategory: string;
        if (size < 1024 * 1024) sizeCategory = 'Small (<1MB)';
        else if (size < 100 * 1024 * 1024) sizeCategory = 'Medium (1-100MB)';
        else sizeCategory = 'Large (>100MB)';
        targetDir = path.join(resolvedPath, sizeCategory);
      } else {
        throw new Error(`Unknown organize criteria: ${organizeBy}`);
      }

      // Crear directorio y mover archivo
      await fs.mkdir(targetDir, { recursive: true });
      const newPath = path.join(targetDir, entry.name);

      // Evitar sobrescribir
      try {
        await fs.access(newPath);
        // Si existe, agregar timestamp
        const timestamp = Date.now();
        const newName = `${path.basename(entry.name, path.extname(entry.name))}_${timestamp}${path.extname(entry.name)}`;
        const uniquePath = path.join(targetDir, newName);
        await fs.rename(fullPath, uniquePath);
        movedFiles.push({ from: entry.name, to: uniquePath });
      } catch {
        await fs.rename(fullPath, newPath);
        movedFiles.push({ from: entry.name, to: newPath });
      }
    }

    return {
      organized: true,
      criteria: organizeBy,
      filesMoved: movedFiles.length,
      details: movedFiles.slice(0, 10),
    };
  }

  private resolvePath(inputPath: string): string {
    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }
    return path.join(BASE_DIR, inputPath);
  }
}
