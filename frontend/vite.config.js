import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
    plugins: [
        laravel({
            // The frontend owns source assets; Laravel's public directory is
            // the deployment boundary consumed by the backend web server.
            publicDirectory: '../backend/public',
            input: ['src/css/app.css', 'src/js/app.js'],
            refresh: ['src/views/**'],
        }),
    ],
    server: {
        watch: {
            ignored: ['../backend/storage/framework/views/**'],
        },
    },
    build: {
        // Vite does not clean output outside its own root unless explicitly
        // enabled. Cleaning prevents stale hashed assets after each build.
        emptyOutDir: true,
    },
});
