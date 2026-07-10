import { resolveAttachmentPath, getBase64DataUri } from './attachments.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function resolveObsidianEmbeds(
  markdown: string,
  vaultRoot: string,
  attachmentFolder: string | undefined,
  currentFilePath: string,
  maxEmbedDepth: number = 5,
  maxAttachmentSizeMb: number = 10,
  seen: Set<string> = new Set()
): Promise<string> {
  // If we've hit the recursion limit, stop
  if (seen.size >= maxEmbedDepth) {
    console.warn(`[md2pdf] Warning: Max embed depth reached (${maxEmbedDepth}). Stopping recursion.`);
    return markdown;
  }

  // Regex to find ![[target]] or ![[target|alias]]
  const regex = /!\[\[(.*?)\]\]/g;
  const matches = [...markdown.matchAll(regex)];

  if (matches.length === 0) return markdown;

  let offset = 0;
  let resolvedMarkdown = markdown;

  for (const match of matches) {
    const originalText = match[0];
    const content = match[1];
    
    let target = content;
    let alias = '';
    if (content.includes('|')) {
      const parts = content.split('|');
      target = parts[0];
      alias = parts.slice(1).join('|');
    }

    let section = '';
    if (target.includes('#')) {
      const parts = target.split('#');
      target = parts[0];
      section = parts[1];
    }

    // Resolve the file
    let resolvedPath = await resolveAttachmentPath(target, currentFilePath, vaultRoot, attachmentFolder);

    if (!resolvedPath && !target.match(/\.[a-zA-Z0-9]+$/)) {
      resolvedPath = await resolveAttachmentPath(target + '.md', currentFilePath, vaultRoot, attachmentFolder);
    }

    let replacement = originalText;

    if (resolvedPath) {
      const ext = path.extname(resolvedPath).toLowerCase();
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'];

      if (imageExts.includes(ext)) {
        // It's an image
        const dataUri = await getBase64DataUri(resolvedPath, maxAttachmentSizeMb);
        if (dataUri) {
          // Handle sizing from alias: `300`, `300x200`
          let width = '';
          let height = '';
          if (alias) {
            if (alias.match(/^\d+$/)) {
              width = alias;
            } else if (alias.match(/^\d+x\d+$/)) {
              const [w, h] = alias.split('x');
              width = w;
              height = h;
            }
          }
          
          if (width || height) {
            replacement = `<img src="${dataUri}" alt="${target}" ${width ? `width="${width}" ` : ''}${height ? `height="${height}" ` : ''}/>`;
          } else {
            replacement = `![${target}](${dataUri})`;
          }
        } else {
          replacement = `> [!FAILURE] Missing Image\n> Could not embed \`${target}\` (file too large or read error).`;
        }
      } else if (ext === '.md' || ext === '') {
        // Transclude note
        let notePath = resolvedPath;
        if (ext === '' && !target.toLowerCase().endsWith('.md')) {
           // Try appending .md if it was omitted
           const withMd = await resolveAttachmentPath(target + '.md', currentFilePath, vaultRoot, attachmentFolder);
           if (withMd) notePath = withMd;
        }

        if (seen.has(notePath)) {
          console.warn(`[md2pdf] Warning: Circular embed detected for ${notePath}.`);
          replacement = `> [!WARNING] Circular Embed\n> Circular reference to \`${target}\` detected.`;
        } else if (notePath === currentFilePath) {
          replacement = `> [!WARNING] Self Embed\n> Cannot embed a note into itself (\`${target}\`).`;
        } else {
          try {
            let noteContent = await fs.readFile(notePath, 'utf-8');
            
            // Strip frontmatter from embedded note
            noteContent = noteContent.replace(/^---\n[\s\S]*?\n---\n/, '');

            // Handle section extraction
            if (section) {
              if (section.startsWith('^')) {
                // Block reference
                const blockId = section.substring(1);
                const blockRegex = new RegExp(`(.*?)\\s*\\^${blockId}\\b`, 's');
                const blockMatch = noteContent.match(blockRegex);
                if (blockMatch) {
                  noteContent = blockMatch[1].trim(); // Rough extraction
                }
              } else {
                // Heading section
                const escapedSection = section.replace(/[.*+?^$\{}()|[\]\\]/g, '\\$&');
                const headingRegex = new RegExp(`^(#{1,6})\\s+${escapedSection}\\s*$([\\s\\S]*?)(?=^\\1\\s|$)`, 'im');
                const hMatch = noteContent.match(headingRegex);
                if (hMatch) {
                  noteContent = hMatch[2].trim();
                } else {
                  noteContent = `> [!WARNING] Missing Section\n> Section \`#${section}\` not found in \`${target}\`.`;
                }
              }
            }

            // Adjust heading levels based on where it's embedded?
            // Actually, Obsidian doesn't strictly adjust heading levels, it just embeds them as is.
            // But the requirements say "Heading levels adjusted: if the embedding note uses ## Level 2, embedded # H1 becomes ## H2".
            // Finding the surrounding heading level is complex. Let's just bump all headings by 1 if there's any context,
            // or we'll skip heading adjustment for now to avoid breaking formatting unless strictly needed.
            // Requirement: "Heading levels adjusted"
            // To do this properly, we need to know the current heading level at `match.index`.
            const precedingText = markdown.slice(0, match.index);
            const lastHeadingMatch = [...precedingText.matchAll(/^#{1,6}\s+/gm)].pop();
            const currentLevel = lastHeadingMatch ? lastHeadingMatch[0].trim().length : 0;
            
            if (currentLevel > 0) {
              noteContent = noteContent.replace(/^(#{1,6})\s+/gm, (m, h) => {
                const newLevel = Math.min(6, h.length + currentLevel - 1); // rough adjustment
                return '#'.repeat(newLevel) + ' ';
              });
            }

            // Wrap in a div or blockquote to style transclusion
            replacement = `\n<div class="markdown-embed">\n\n${noteContent}\n\n</div>\n`;

            // Recursively process embeds inside the embedded note!
            const newSeen = new Set(seen);
            newSeen.add(currentFilePath); // Add the current file to the seen list
            
            replacement = await resolveObsidianEmbeds(
              replacement,
              vaultRoot,
              attachmentFolder,
              notePath, // The new "current" file
              maxEmbedDepth,
              maxAttachmentSizeMb,
              newSeen
            );

          } catch (e) {
            replacement = `> [!FAILURE] Error Reading Note\n> Could not read \`${target}\`.`;
          }
        }
      }
    } else {
      console.warn(`[md2pdf] Warning: attachment "${target}" not found`);
      replacement = `> [!FAILURE] Missing Attachment\n> \`${target}\` not found.`;
    }

    const startIndex = match.index! + offset;
    resolvedMarkdown = resolvedMarkdown.slice(0, startIndex) + replacement + resolvedMarkdown.slice(startIndex + originalText.length);
    offset += replacement.length - originalText.length;
  }

  return resolvedMarkdown;
}
