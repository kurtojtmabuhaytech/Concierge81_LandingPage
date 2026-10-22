// Copies the GSAP files the landing page uses from node_modules into assets/js/vendor/gsap.
// Run after installing or updating gsap: npm run vendor
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'node_modules', 'gsap', 'dist');
const dest = path.join(root, 'assets', 'js', 'vendor', 'gsap');
const files = ['gsap.min.js', 'ScrollTrigger.min.js', 'Flip.min.js', 'MorphSVGPlugin.min.js'];

fs.mkdirSync(dest, { recursive: true });
files.forEach(file => fs.copyFileSync(path.join(src, file), path.join(dest, file)));

const { version } = require(path.join(root, 'node_modules', 'gsap', 'package.json'));
console.log(`Copied GSAP ${version}: ${files.join(', ')}`);
