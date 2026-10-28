import Alpine from 'alpinejs';
import { initDeliveryPreferences, initNotePreferences } from './settings/delivery-preferences.js';
import { initTaskCapturePresets } from './planning/task-capture.js';
import { initNotifications } from './lib/notifications.js';
import { initAssistant } from './planning/assistant.js';
import { initPasswordVisibility } from './lib/password-visibility.js';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
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
import { initTeamworkPage } from './planning/teamwork-page.js';
import { initAdminPage } from './admin/admin-page.js';
import { initTwoFactor } from './settings/two-factor.js';
import { initTaskHistory } from './settings/task-history.js';
import { initNavigation } from './lib/navigation';
import { initWorkspaceUI } from './lib/workspace-ui';
import { initDialogBackdropClose } from './lib/dialog-backdrop.js';
import { initWalkthrough } from './help/walkthrough';
import { applyAppearance } from './settings/theme-catalog';
import { patch } from './lib/http.js';
import { decorateReference } from './settings/reference-decoration';

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
if (window.notesBootstrap?.preferences) applyAppearance(window.notesBootstrap.preferences);
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
    initPasswordVisibility();
    const delivery = document.querySelector('[data-notification-settings]');
    if (delivery) initDeliveryPreferences(delivery);
    const notePreferences = document.querySelector('[data-note-preferences]');
    if (notePreferences) initNotePreferences(notePreferences);
    initNotifications();
    initAssistant();
    initTaskCapturePresets();
    document.querySelector('[data-toggle-theme]')?.addEventListener('click', async (event) => {
        const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        const preference = document.querySelector(`[data-pref="theme"][data-value="${theme}"]`);
        if (preference) {
            preference.click();
            return;
        }
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const response = await patch('/api/v1/preferences', { theme });
            Object.assign(window.notesBootstrap.preferences, response.payload.data);
            applyAppearance(response.payload.data);
        } catch (error) {
            window.alert(error.message || 'Unable to change appearance.');
        } finally {
            button.disabled = false;
        }
    });
    decorateReference();
    initNavigation();
    initDialogBackdropClose();
    document
        .querySelectorAll(
            '[data-goals-page], [data-tasks-page], [data-task-detail], [data-habits-page], [data-dashboard-page], [data-reviews-page], [data-goal-detail], [data-preference-settings], [data-teamwork-page]',
        )
        .forEach(initWorkspaceUI);
    const notes = document.querySelector('[data-notes-workspace]');
    const notesReady = notes ? new NotesPage(notes).init() : Promise.resolve();
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
    const teamwork = document.querySelector('[data-teamwork-page]');
    if (teamwork) initTeamworkPage(teamwork);
    const admin = document.querySelector('[data-admin-page]');
    if (admin) initAdminPage(admin);
    const twoFactor = document.querySelector('[data-two-factor-settings]');
    if (twoFactor) initTwoFactor(twoFactor);
    const history = document.querySelector('[data-history-settings]');
    if (history) initTaskHistory(history);
    initWalkthrough({ ready: notesReady });

    document.querySelectorAll('[data-avatar-fallback]').forEach((avatar) => {
        const url = window.notesBootstrap?.user?.avatar_url;
        if (!url) return;
        const image = document.createElement('img');
        image.alt = 'Profile picture';
        image.src = url;
        avatar.replaceChildren(image);
    });
});
