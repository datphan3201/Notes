import { defineConfig } from 'vite';

export default defineConfig({
    base: '/build/',
    build: {
        outDir: '../backend/public/build',
        emptyOutDir: true,
        manifest: 'manifest.json',
        rollupOptions: {
            input: ['src/css/app.css', 'src/js/app.js'],
        },
    },
});
