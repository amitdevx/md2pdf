import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

export interface VaultIndex {
  notes: Map<string, string>;
  aliases: Map<string, string>;
  headings: Map<string, string>;
  graph: Map<string, string[]>;
}

export function buildVaultIndex(vaultRoot: string | undefined, inputFiles: string[]): VaultIndex {
  const notes = new Map<string, string>();
  const aliases = new Map<string, string>();
  const headings = new Map<string, string>();
  const graph = new Map<string, string[]>();
  
  // If no vault root, just index the input files
  const filesToIndex = vaultRoot 
    ? fg.sync('**/*.md', { cwd: vaultRoot, absolute: true, ignore: ['**/node_modules/**'] })
    : inputFiles;
    
  for (const file of filesToIndex) {
    if (!fs.existsSync(file)) continue;
    
    const basename = path.basename(file, '.md').toLowerCase();
    notes.set(basename, file);
    
    // Quick regex scan for metadata and headings
    const content = fs.readFileSync(file, 'utf-8');
    
    // Parse frontmatter aliases
    if (content.startsWith('---')) {
       const end = content.indexOf('---', 3);
       if (end !== -1) {
         const fm = content.slice(3, end);
         const aliasMatch = fm.match(/aliases:\s*\[(.*?)\]/);
         if (aliasMatch) {
            aliasMatch[1].split(',').forEach(a => aliases.set(a.trim().toLowerCase(), file));
         }
       }
    }
    
    // Parse headings
    const headingMatches = content.matchAll(/^#+\s+(.*?)$/gm);
    for (const match of headingMatches) {
      headings.set(`${basename}#${match[1].toLowerCase()}`, file);
    }
    
    // Build graph
    const links = Array.from(content.matchAll(/\[\[(.*?)\]\]/g))
      .map(m => m[1].split('|')[0].split('#')[0].toLowerCase().trim());
      
    const dependencies = new Set<string>();
    for (const link of links) {
      // It depends on the link. We'll map the link name later during sort if needed, 
      // but for graph we can just store the raw link name.
      dependencies.add(link);
    }
    graph.set(file, Array.from(dependencies));
  }

  return { notes, aliases, headings, graph };
}

export function sortDependencies(files: string[], index: VaultIndex): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: string[] = [];

  function visit(node: string) {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      // Circular dependency detected, ignore
      return;
    }

    visiting.add(node);
    
    const deps = index.graph.get(node) || [];
    for (const dep of deps) {
      // Resolve dep to actual file
      const depFile = index.notes.get(dep) || index.aliases.get(dep);
      if (depFile && files.includes(depFile)) {
        visit(depFile);
      }
    }

    visiting.delete(node);
    visited.add(node);
    sorted.push(node);
  }

  // Iterate over files in a consistent order
  for (const file of files) {
    visit(file);
  }

  return sorted;
}
