import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command }) => ({
    base: command === 'serve' ? '/' : '/build/',
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
        origin: 'http://127.0.0.1:5173',
    },
    plugins: [
        {
            name: 'planner-php-reload',
            configureServer(server) {
                const directories = [
                    './src/views/',
                    '../backend/src/',
                    '../backend/bootstrap/',
                    '../backend/routes/',
                ].map((path) => fileURLToPath(new URL(path, import.meta.url)));

                server.watcher.add(directories);
                server.watcher.on('all', (event, file) => {
                    if (
                        ['add', 'change', 'unlink'].includes(event) &&
                        file.endsWith('.php') &&
                        directories.some((directory) => file.startsWith(directory))
                    ) {
                        server.ws.send({ type: 'full-reload' });
                    }
                });
            },
        },
    ],
    build: {
        outDir: '../backend/public/build',
        emptyOutDir: true,
        manifest: 'manifest.json',
        rollupOptions: {
            input: ['src/css/app.css', 'src/js/app.js'],
        },
    },
}));
