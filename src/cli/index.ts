#!/usr/bin/env node
import { Command } from 'commander';
import { convert } from '../core/index.js';
import ora from 'ora';
import pc from 'picocolors';
import fs from 'node:fs';

const program = new Command();

program
  .name('md2pdf')
  .description('Production-quality Markdown to PDF rendering engine')
  .version('0.1.0')
  .argument('<input>', 'Input markdown file')
  .option('-o, --output <output>', 'Output PDF file')
  .action(async (input: string, options: { output?: string }) => {
    if (!fs.existsSync(input)) {
      console.error(pc.red(`Error: Input file '${input}' does not exist.`));
      process.exit(1);
    }

    const output = options.output || input.replace(/\.md$/i, '.pdf');
    const spinner = ora('Converting markdown to PDF...').start();

    try {
      const result = await convert({ input, output });
      
      if (result.warnings && result.warnings.length > 0) {
        spinner.warn(pc.yellow(`Generated ${output} in ${result.renderTimeMs}ms with warnings:`));
        result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠ ${w}`)));
      } else {
        spinner.succeed(pc.green(`Successfully generated ${output} in ${result.renderTimeMs}ms`));
      }
    } catch (error) {
      spinner.fail(pc.red('Failed to generate PDF'));
      console.error(error);
      process.exit(1);
    }
  });

program.parse(process.argv);
