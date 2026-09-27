import { describe, it, expect, afterAll } from 'vitest';
import { convert } from '../../src/core/index.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Image Sandbox and Loading', () => {
  const scratchDir = path.join(os.tmpdir(), 'md2pdf-img-tests');
  const outsideImg = path.join(scratchDir, 'outside.svg');
  const insideDir = path.join(scratchDir, 'workspace');
  const inputFile = path.join(insideDir, 'test.md');
  const outputFile = path.join(insideDir, 'test.pdf');

  afterAll(() => {
    try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch (e: any) { console.error(e.message || ""); }
  });

  it('should block local images outside the workspace directory', async () => {
    fs.mkdirSync(insideDir, { recursive: true });
    
    fs.writeFileSync(outsideImg, '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="red"/></svg>');
    fs.writeFileSync(inputFile, `![Outside Image](../outside.svg)`);

    const result = await convert({
      input: inputFile,
      output: outputFile,
      cache: false,
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Security block');
  }, 60000);

  it('should successfully embed and render local PNG/JPG/WebP images', async () => {
    fs.mkdirSync(insideDir, { recursive: true });
    
    // Create valid 1x1 transparent images
    const pngHex = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082';
    const jpgHex = 'ffd8ffe000104a46494600010101004800480000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00f50fffd9';
    const webpHex = '524946461a000000574542505650384c0d0000002f00000010071011118888fe0700';

    const pngFile = path.join(insideDir, 'test.png');
    const jpgFile = path.join(insideDir, 'test.jpg');
    const webpFile = path.join(insideDir, 'test.webp');
    fs.writeFileSync(pngFile, Buffer.from(pngHex, 'hex'));
    fs.writeFileSync(jpgFile, Buffer.from(jpgHex, 'hex'));
    fs.writeFileSync(webpFile, Buffer.from(webpHex, 'hex'));
    
    fs.writeFileSync(inputFile, `![PNG](test.png)\n![JPG](test.jpg)\n![WebP](test.webp)\n\n<img src="./test.png" />`);

    const result = await convert({
      input: inputFile,
      output: outputFile,
      cache: false,
    });

    if (result.warnings.length > 0) {
      console.log('Image test warnings:', result.warnings);
    }
    expect(result.warnings.length).toBe(0);
    expect(fs.existsSync(outputFile)).toBe(true);
  }, 60000);
});
