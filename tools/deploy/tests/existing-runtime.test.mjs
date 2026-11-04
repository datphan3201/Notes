import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

// Actual temporary Git history and fake external processes; never starts a server or opens MySQL.
function fixture(t) {
    const root = mkdtempSync(join(tmpdir(), 'planner-existing-runtime-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const repo = join(root, 'repo');
    const bin = join(root, 'bin');
    for (const path of ['tools/deploy', 'frontend', 'backend/public/build/assets', 'backend/database/plain-migrations']) mkdirSync(join(repo, path), { recursive: true });
    mkdirSync(bin);
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'fixture@example.test');
    git('config', 'user.name', 'Deployment fixture');
    writeFileSync(join(repo, '.gitignore'), '/backend/.env\n/backend/public/build/\n');
    writeFileSync(join(repo, 'frontend/package.json'), '{}\n');
    writeFileSync(join(repo, 'frontend/package-lock.json'), '{}\n');
    writeFileSync(join(repo, 'backend/.env'), 'APP_URL=https://runtime.example.test\nSECRET=unchanged-fixture\n');
    writeFileSync(join(repo, 'backend/public/build/manifest.json'), 'old manifest');
    writeFileSync(join(repo, 'backend/public/build/assets/old.js'), 'old asset');
    writeFileSync(join(repo, 'page.txt'), 'old source');
    copyFileSync(new URL('../existing-runtime.sh', import.meta.url), join(repo, 'tools/deploy/existing-runtime.sh'));
    git('add', '--', '.gitignore', 'frontend/package.json', 'frontend/package-lock.json', 'page.txt', 'tools/deploy/existing-runtime.sh');
    git('commit', '-qm', 'base');
    const previous = git('rev-parse', 'HEAD');
    writeFileSync(join(repo, 'page.txt'), 'new source');
    git('add', '--', 'page.txt'); git('commit', '-qm', 'candidate');
    let target = git('rev-parse', 'HEAD');
    const remote = join(root, 'remote.git');
    execFileSync('git', ['clone', '--bare', '-q', repo, remote]);
    git('remote', 'add', 'origin', remote);
    git('reset', '--hard', previous);
    const log = join(root, 'calls');
    for (const [name, body] of Object.entries({
        gh: 'echo gh >> "$PLANNER_TEST_LOG"\nprintf "%s\\n" "$PLANNER_TEST_TARGET"',
        php: 'printf "php %s\\n" "$*" >> "$PLANNER_TEST_LOG"\n[ "$*" = "bin/console migrate:check" ]',
        npm: 'echo npm >> "$PLANNER_TEST_LOG"\n[ "${PLANNER_TEST_BUILD_FAIL:-}" != yes ] || exit 1\nif [ "$*" = "run build" ]; then\n mkdir -p ../backend/public/build/assets\n echo new-manifest > ../backend/public/build/manifest.json\n echo new-asset > ../backend/public/build/assets/new.js\n if [ "${PLANNER_TEST_EDIT:-}" = yes ]; then echo user-edit >> "$PLANNER_TEST_REPO/page.txt"; fi\nfi',
        curl: 'echo curl >> "$PLANNER_TEST_LOG"\n[ "${PLANNER_TEST_HEALTH_FAIL:-}" != yes ] || exit 1\nprintf \'{"data":{"status":"ok"}}\\n\'',
    })) writeFileSync(join(bin, name), '#!/usr/bin/env bash\nset -eu\n' + body + '\n', { mode: 0o700 });
    const run = (args = [], extra = {}) => spawnSync('bash', ['tools/deploy/existing-runtime.sh', ...args], { cwd: repo, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PLANNER_RUNTIME_STATE: join(root, 'state'), PLANNER_TEST_REPO: repo, PLANNER_TEST_LOG: log, PLANNER_TEST_TARGET: target, PLANNER_TUNNEL_METRICS: '', ...extra } });
    const calls = () => { try { return readFileSync(log, 'utf8'); } catch { return ''; } };
    const revise = (path) => {
        git('switch', '--detach', target);
        writeFileSync(join(repo, path), '{}\n'); git('add', '--', path); git('commit', '-qm', 'migration or dependency change');
        target = git('rev-parse', 'HEAD'); git('push', '-q', 'origin', 'HEAD:main'); git('switch', 'main');
    };
    return { root, repo, git, previous, get target() { return target; }, run, calls, revise };
}

test('feature checkout and dirty main never fetch, build or change source', (t) => {
    const f = fixture(t); f.git('switch', '-c', 'feature');
    assert.equal(f.run().status, 0); assert.equal(f.calls(), ''); assert.equal(f.git('branch', '--show-current'), 'feature');
    f.git('switch', 'main'); writeFileSync(join(f.repo, 'page.txt'), 'user draft');
    assert.equal(f.run().status, 0); assert.equal(f.calls(), ''); assert.equal(readFileSync(join(f.repo, 'page.txt'), 'utf8'), 'user draft');
});
test('dry run selects green main but does not build, migrate or publish', (t) => {
    const f = fixture(t); const r = f.run(['--dry-run']); assert.equal(r.status, 0, r.stderr);
    assert.equal(f.git('rev-parse', 'HEAD'), f.previous); assert.equal(f.calls(), 'gh\n');
});
test('green fast-forward publishes a prepared manifest, keeps .env and old hashed assets', (t) => {
    const f = fixture(t); const env = readFileSync(join(f.repo, 'backend/.env'), 'utf8');
    const r = f.run(); assert.equal(r.status, 0, r.stderr); assert.equal(f.git('rev-parse', 'HEAD'), f.target);
    assert.equal(readFileSync(join(f.repo, 'backend/.env'), 'utf8'), env);
    assert.equal(readFileSync(join(f.repo, 'backend/public/build/assets/old.js'), 'utf8'), 'old asset');
    assert.match(readFileSync(join(f.repo, 'backend/public/build/manifest.json'), 'utf8'), /new-manifest/);
    assert.equal(f.calls().split('\n').filter((s) => s.startsWith('php')).join('\n'), 'php bin/console migrate:check');
    assert.equal(f.git('status', '--porcelain'), '');
});
test('failed build leaves live source/manifest unchanged and is not blindly retried', (t) => {
    const f = fixture(t); assert.notEqual(f.run([], { PLANNER_TEST_BUILD_FAIL: 'yes' }).status, 0);
    assert.equal(f.git('rev-parse', 'HEAD'), f.previous); assert.equal(readFileSync(join(f.repo, 'backend/public/build/manifest.json'), 'utf8'), 'old manifest');
    const calls = f.calls(); assert.equal(f.run().status, 0); assert.equal(f.calls(), calls + 'gh\n');
    assert.equal(f.run(['--retry']).status, 0);
});
for (const path of ['backend/database/plain-migrations/9999_fixture.php', 'backend/composer.lock']) test(`blocks ${path} before publishing or touching the database`, (t) => {
    const f = fixture(t); f.revise(path); const r = f.run(); assert.notEqual(r.status, 0); assert.match(r.stderr, /backed-up release/);
    assert.equal(f.git('rev-parse', 'HEAD'), f.previous); assert.equal(f.calls(), 'gh\n');
});
test('edits made during preparation are preserved; no manifest is published', (t) => {
    const f = fixture(t); const r = f.run([], { PLANNER_TEST_EDIT: 'yes' }); assert.notEqual(r.status, 0); assert.match(r.stderr, /changed during preparation/);
    assert.equal(f.git('rev-parse', 'HEAD'), f.previous); assert.match(readFileSync(join(f.repo, 'page.txt'), 'utf8'), /user-edit/);
});
test('unhealthy existing runtime fails and an explicit retry rechecks the same revision', (t) => {
    const f = fixture(t); assert.notEqual(f.run([], { PLANNER_TEST_HEALTH_FAIL: 'yes' }).status, 0);
    assert.equal(f.git('rev-parse', 'HEAD'), f.target); const calls = f.calls();
    assert.equal(f.run().status, 0); assert.equal(f.calls(), calls + 'gh\n'); assert.equal(f.run(['--retry']).status, 0);
});
