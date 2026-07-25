import test from 'node:test'; import assert from 'node:assert/strict'; import { contrastRatio,luminance } from '../../tools/ui/lib/contrast.mjs';
test('black white ratio is 21',()=>assert.ok(Math.abs(contrastRatio('#000000','#FFFFFF')-21)<1e-9));
test('ratio is symmetric',()=>assert.equal(contrastRatio('#F8F4E8','#19152D'),contrastRatio('#19152D','#F8F4E8')));test('invalid color rejected',()=>assert.throws(()=>luminance('red'),/Invalid hex/));
