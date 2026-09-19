import Alpine from 'alpinejs';
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-500.css';
import '@fontsource/noto-sans/latin-600.css';
import './lib/normalization';
import { RecoveryStore } from './lib/recovery-store';
import { NotesPage } from './notes/notes-page';
import { initPassword } from './settings/password';
import { initPreferences } from './settings/preferences';
import { initProfile } from './settings/profile';
import {
    initGoalDetail,
    initGoalsPage,
    initTaskDetail,
    initTasksPage,
} from './planning/planning-page';
import { initHabitsPage } from './planning/habits-page';
import { initDashboardPage, initReviewsPage } from './planning/dashboard-page';
import { initAIPage } from './planning/ai-page';
import { initNavigation } from './lib/navigation';

window.Alpine = Alpine;

const bootstrapElement = document.querySelector('#notes-bootstrap');
if (bootstrapElement?.dataset.json) {
    try {
        window.notesBootstrap = JSON.parse(bootstrapElement.dataset.json);
    } catch {
        // A malformed server bootstrap must fail closed instead of allowing the
        // browser to continue with partially trusted account or CSRF state.
        window.notesBootstrap = undefined;
    }
}

// Alpine remains intentionally small: this app's multi-request state lives in
// plain modules so it can be tested with fake clocks and transports.
Alpine.start();

window.notesSessionChannel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('notes-r1-session');
window.notesSessionChannel?.addEventListener('message', (event) => {
    if (String(event.data?.userId) !== String(window.notesBootstrap?.user?.id)) return;
    RecoveryStore.clearAll();
    document.dispatchEvent(new CustomEvent('notes:session-changed'));
});

// Settings pages do not have an editor to ask for a leave decision, but logout
// still needs to erase this tab's account-scoped recovery record.
document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-leave-guard-form]');
    if (!form || document.querySelector('[data-notes-workspace]')) return;
    RecoveryStore.clearAll();
    window.notesSessionChannel?.postMessage({
        userId: String(window.notesBootstrap?.user?.id),
        type: 'logout',
    });
});

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    const notes = document.querySelector('[data-notes-workspace]');
    if (notes) new NotesPage(notes).init();
    const profile = document.querySelector('[data-profile-settings]');
    if (profile) initProfile(profile);
    const preferences = document.querySelector('[data-preference-settings]');
    if (preferences) initPreferences(preferences);
    const password = document.querySelector('[data-password-settings]');
    if (password) initPassword(password);
    const goals = document.querySelector('[data-goals-page]');
    if (goals) initGoalsPage(goals);
    const goal = document.querySelector('[data-goal-detail]');
    if (goal) initGoalDetail(goal);
    const tasks = document.querySelector('[data-tasks-page]');
    if (tasks) initTasksPage(tasks);
    const task = document.querySelector('[data-task-detail]');
    if (task) initTaskDetail(task);
    const habits = document.querySelector('[data-habits-page]');
    if (habits) initHabitsPage(habits);
    const dashboard = document.querySelector('[data-dashboard-page]');
    if (dashboard) initDashboardPage(dashboard);
    const reviews = document.querySelector('[data-reviews-page]');
    if (reviews) initReviewsPage(reviews);
    const ai = document.querySelector('[data-ai-page]');
    if (ai) initAIPage(ai);

    document.querySelectorAll('[data-avatar-fallback]').forEach((avatar) => {
        const url = window.notesBootstrap?.user?.avatar_url;
        if (!url) return;
        const image = document.createElement('img');
        image.alt = 'Profile picture';
        image.src = url;
        avatar.replaceChildren(image);
    });
});
