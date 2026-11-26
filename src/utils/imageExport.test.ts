import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJpgExportFilename,
  computeExportCanvasSize,
  parseSvgDataUrlDimensions,
} from './imageExport';

test('buildJpgExportFilename sanitizes Spanish accents and punctuation into clean .jpg filenames', () => {
  assert.equal(
    buildJpgExportFilename('Manejo Nutricional en Disfagia Severa (Adulto)'),
    'manejo-nutricional-en-disfagia-severa-adulto.jpg'
  );
  assert.equal(
    buildJpgExportFilename('   Síndrome de Realimentación · UCI!  '),
    'sindrome-de-realimentacion-uci.jpg'
  );
  assert.equal(buildJpgExportFilename('   '), 'algoritmo-nutricional.jpg');
});

test('parseSvgDataUrlDimensions extracts width and height from encoded SVG data URLs', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1840 1220" width="1840" height="1220"></svg>';
  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  assert.deepEqual(parseSvgDataUrlDimensions(encoded), { width: 1840, height: 1220 });

  const base64 = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  assert.deepEqual(parseSvgDataUrlDimensions(base64), { width: 1840, height: 1220 });

  assert.equal(parseSvgDataUrlDimensions('data:image/png;base64,AAAA'), null);
});

test('computeExportCanvasSize upscales SVG cleanly for sharp JPGs and caps dimensions safely at 4096px', () => {
  const svgExport = computeExportCanvasSize(1200, 800, true);
  assert.ok(svgExport.width >= 2400 && svgExport.width <= 4096);
  assert.equal(Math.round((svgExport.width / svgExport.height) * 100), 150);

  const hugeRaster = computeExportCanvasSize(6000, 3000, false);
  assert.equal(hugeRaster.width, 4096);
  assert.equal(hugeRaster.height, 2048);

  const normalRaster = computeExportCanvasSize(1920, 1080, false);
  assert.deepEqual(normalRaster, { width: 1920, height: 1080 });
});
