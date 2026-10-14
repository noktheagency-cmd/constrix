import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = path.join(root, '.vercel-runtime', 'node_modules');

const modulePathBanner = `
const __vp = require('path');
const __vm = require('module');
const __vfs = require('fs');
const __moduleCandidates = [
  __vp.join(__dirname, 'node_modules'),
  __vp.join(__dirname, '.vercel-runtime', 'node_modules'),
  __vp.join(__dirname, '..', '.vercel-runtime', 'node_modules'),
  __vp.join(__dirname, '..', 'node_modules'),
  __vp.join(process.cwd(), '.vercel-runtime', 'node_modules'),
  __vp.join(process.cwd(), 'backend', '.vercel-runtime', 'node_modules'),
  __vp.join(process.cwd(), 'node_modules'),
  __vp.join(process.cwd(), 'backend', 'node_modules'),
];
const __moduleDir = __moduleCandidates.find((dir) =>
  __vfs.existsSync(__vp.join(dir, '@prisma', 'client', 'package.json')),
);
if (__moduleDir) {
  const __originalResolve = __vm._resolveFilename;
  __vm._resolveFilename = function (request, parent, isMain, options) {
    const runtimePackage =
      request === '@prisma/client' ||
      request.startsWith('@prisma/') ||
      request.startsWith('.prisma/');
    if (!runtimePackage) {
      return __originalResolve.call(this, request, parent, isMain, options);
    }
    return __originalResolve.call(this, request, parent, isMain, {
      ...options,
      paths: [__moduleDir, ...(options?.paths || parent?.paths || [])],
    });
  };
} else {
  console.error('Runtime modules not found', {
    dirname: __dirname,
    cwd: process.cwd(),
    candidates: __moduleCandidates,
  });
}
`;

await esbuild.build({
  entryPoints: [path.join(root, 'dist', 'main.js')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: path.join(root, 'dist', 'server.js'),
  external: [
    '@prisma/client',
    '.prisma/client',
    '@nestjs/microservices',
    '@nestjs/microservices/microservices-module',
    '@nestjs/websockets',
    '@nestjs/websockets/socket-module',
  ],
  banner: { js: modulePathBanner },
  logLevel: 'info',
});

rmSync(path.join(root, '.vercel-runtime'), { recursive: true, force: true });
mkdirSync(runtimeDir, { recursive: true });

rmSync(path.join(root, '.vercel-runtime'), { recursive: true, force: true });
mkdirSync(runtimeDir, { recursive: true });

const moduleRoot = path.join(root, 'node_modules');
for (const extra of [path.join('@prisma', 'client'), '.prisma']) {
  cpSync(path.join(moduleRoot, extra), path.join(runtimeDir, extra), {
    recursive: true,
    dereference: true,
  });
}
