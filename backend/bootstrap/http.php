<?php

declare(strict_types=1);

use Egulias\EmailValidator\EmailValidator;
use Planner\Application\Account\AccountSerializer;
use Planner\Application\Account\AccountService;
use Planner\Application\Account\AccountValidator;
use Planner\Application\Account\AuthService;
use Planner\Application\Files\AttachmentSerializer;
use Planner\Application\Files\AvatarProcessor;
use Planner\Application\Files\FileService;
use Planner\Application\Files\FileStreamer;
use Planner\Application\Files\ProcessFileDeletion;
use Planner\Application\Files\UploadValidator;
use Planner\Application\Notes\NoteListQuery;
use Planner\Application\Notes\NoteSerializer;
use Planner\Application\Notes\NoteService;
use Planner\Application\Notes\NoteValidator;
use Planner\Application\Planning\PlanningService;
use Planner\Application\Habits\HabitService;
use Planner\Application\Recurrence\TaskSeriesService;
use Planner\Application\Dashboard\DashboardService;
use Planner\Application\Reviews\GoalSnapshotService;
use Planner\Application\Reviews\ReviewService;
use Planner\Application\AI\AIActionService;
use Planner\Application\AI\ProposalValidator;
use Planner\Application\Tags\LabelSerializer;
use Planner\Application\Tags\TagService;
use Planner\Application\Tags\TagValidator;
use Planner\Http\Application;
use Planner\Http\Controller\AccountController;
use Planner\Http\Controller\AttachmentController;
use Planner\Http\Controller\FileContentController;
use Planner\Http\Controller\LabelController;
use Planner\Http\Controller\NoteController;
use Planner\Http\Controller\PlanningController;
use Planner\Http\Controller\HabitController;
use Planner\Http\Controller\TaskSeriesController;
use Planner\Http\Controller\DashboardController;
use Planner\Http\Controller\ReviewController;
use Planner\Http\Controller\AIActionController;
use Planner\Http\Controller\ProfileFileController;
use Planner\Http\ErrorHandler;
use Planner\Http\Routing\Router;
use Planner\Http\Security\CsrfGuard;
use Planner\Http\Security\RateLimiter;
use Planner\Http\Validation\InputValidator;
use Planner\Http\View\AssetManifest;
use Planner\Http\View\ViewContext;
use Planner\Http\View\ViewRenderer;
use Planner\Infrastructure\Database\ConnectionFactory;
use Planner\Infrastructure\Logging\LoggerFactory;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Files\AttachmentRepository;
use Planner\Infrastructure\Persistence\Pdo\Files\PendingDeletionRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteRepository;
use Planner\Infrastructure\Persistence\Pdo\Planning\PdoPlanningRepository;
use Planner\Infrastructure\Persistence\Pdo\Activity\PdoActivityRepository;
use Planner\Infrastructure\Persistence\Pdo\Habits\PdoHabitRepository;
use Planner\Infrastructure\Persistence\Pdo\Recurrence\PdoTaskSeriesRepository;
use Planner\Infrastructure\Persistence\Pdo\Dashboard\PdoDashboardRepository;
use Planner\Infrastructure\Persistence\Pdo\Reviews\PdoReviewRepository;
use Planner\Infrastructure\Persistence\Pdo\AI\PdoAIActionRepository;
use Planner\Infrastructure\AI\DisabledAIProvider;
use Planner\Infrastructure\AI\GoogleAIProvider;
use Planner\Infrastructure\Persistence\Pdo\Tags\PdoTagRepository;
use Planner\Infrastructure\Session\PdoSessionHandler;
use Planner\Infrastructure\Session\SessionCipher;
use Planner\Infrastructure\Session\SessionManager;
use Planner\Infrastructure\Storage\LocalPrivateStorage;
use Planner\Domain\Planning\GoalProgressCalculator;
use Planner\Domain\Planning\GraphGuard;
use Planner\Domain\Recurrence\RecurrenceCalculator;

$services = require __DIR__.'/app.php';
$config = $services['config'];
$logger = (new LoggerFactory($config))->create();
$sessionPdo = (new ConnectionFactory($config))->create();
$sessionHandler = new PdoSessionHandler(
    $sessionPdo,
    SessionCipher::fromEncodedKey($config->nullableString('session.key')),
    $logger,
    $config->int('session.lifetime') * 60,
);
$session = new SessionManager($sessionHandler, $config->bool('session.secure'), $config->int('session.lifetime'));
$accountRepository = new PdoAccountRepository($services['pdo']);
$planningRepository = new PdoPlanningRepository($services['pdo']);
$rateLimiter = new RateLimiter($services['pdo']);
$auth = new AuthService(
    $accountRepository,
    $services['transactions'],
    $session,
    $rateLimiter,
    $services['clock'],
    $planningRepository,
    $services['uuid'],
);
$accountService = new AccountService($accountRepository, $services['transactions'], $services['clock']);
$validator = new AccountValidator(new InputValidator, new EmailValidator);
$views = new ViewRenderer(
    dirname(__DIR__, 2).'/frontend/src/views',
    new ViewContext(new AssetManifest(
        $config->string('app.base_path').'/public',
        $config->nullableString('vite.dev_url'),
        $config->string('app.env'),
    )),
);
$accountController = new AccountController(
    $auth,
    $accountService,
    $validator,
    new AccountSerializer,
    $accountRepository,
    $session,
    $views,
);
$passwordResetService = new \Planner\Application\Account\PasswordResetService(
    $accountRepository,
    new \Planner\Infrastructure\Persistence\Pdo\Account\PdoPasswordResetRepository($services['pdo']),
    $services['transactions'], $rateLimiter, $services['clock'],
    new \Planner\Infrastructure\Mail\PasswordResetMailer($config->string('app.env'), $config->string('storage.private_root'), $config->string('mail.from')),
    $logger, $config->string('app.url'),
);
$passwordResetController = new \Planner\Http\Controller\PasswordResetController($passwordResetService, $validator, $views, $session);
$noteRepository = new PdoNoteRepository($services['pdo']);
$tagRepository = new PdoTagRepository($services['pdo']);
$labelSerializer = new LabelSerializer;
$noteSerializer = new NoteSerializer($labelSerializer);
$tagService = new TagService(
    $tagRepository,
    $noteRepository,
    $accountRepository,
    $services['transactions'],
    $labelSerializer,
    $services['clock'],
    new GraphGuard,
);
$labelController = new LabelController(
    $auth,
    $tagService,
    new TagValidator(new InputValidator),
    $labelSerializer,
);
$storage = new LocalPrivateStorage(
    $config->string('storage.private_root'),
    $config->string('app.base_path').'/public',
    $services['uuid'],
);
$attachmentRepository = new AttachmentRepository($services['pdo']);
$pendingDeletionRepository = new PendingDeletionRepository($services['pdo']);
$cleanup = new ProcessFileDeletion(
    $pendingDeletionRepository,
    $storage,
    $logger,
    $services['clock'],
);
$uploadValidator = new UploadValidator(new InputValidator);
$fileService = new FileService(
    $attachmentRepository,
    $pendingDeletionRepository,
    $noteRepository,
    $accountRepository,
    $services['transactions'],
    $storage,
    $cleanup,
    new AvatarProcessor,
    $services['clock'],
);
$attachmentController = new AttachmentController(
    $auth,
    $fileService,
    $uploadValidator,
    new AttachmentSerializer,
);
$backgroundService = new \Planner\Application\Files\BackgroundService($accountRepository, $services['transactions'], $storage, $pendingDeletionRepository, $services['clock']);
$profileFileController = new ProfileFileController(
    $auth,
    $fileService,
    $uploadValidator,
    new AccountSerializer,
    $backgroundService,
);
$fileContentController = new FileContentController($auth, $fileService, new FileStreamer);
$activityRepository = new PdoActivityRepository($services['pdo']);
$taskSeriesRepository = new PdoTaskSeriesRepository($services['pdo']);
$planningService = new PlanningService(
    $planningRepository,
    $services['transactions'],
    new GraphGuard,
    new GoalProgressCalculator,
    $services['uuid'],
    $services['clock'],
    $activityRepository,
    $taskSeriesRepository,
);
$planningController = new PlanningController($auth, $planningService);
$habitRepository = new PdoHabitRepository($services['pdo']);
$habitService = new HabitService(
    $habitRepository,
    $planningRepository,
    $activityRepository,
    $services['transactions'],
    $services['uuid'],
    $services['clock'],
);
$taskSeriesService = new TaskSeriesService(
    $taskSeriesRepository,
    $planningRepository,
    $planningService,
    new RecurrenceCalculator,
    $services['transactions'],
    $services['uuid'],
    $services['clock'],
);
$habitController = new HabitController($auth, $habitService);
$taskSeriesController = new TaskSeriesController($auth, $taskSeriesService);
$dashboardRepository = new PdoDashboardRepository($services['pdo']);
$dashboardService = new DashboardService($dashboardRepository, $planningRepository, $services['transactions'], $services['clock']);
$reviewRepository = new PdoReviewRepository($services['pdo']);
$reviewService = new ReviewService($reviewRepository, $planningRepository, $services['transactions'], $services['uuid'], $services['clock']);
$snapshotService = new GoalSnapshotService($reviewRepository, $planningRepository, $planningService, $services['transactions'], $services['uuid'], $services['clock']);
$dashboardController = new DashboardController($auth, $dashboardService);
$reviewController = new ReviewController($auth, $reviewService);
$aiProvider = $config->bool('ai.enabled') && $config->nullableString('ai.key') !== null
    ? new GoogleAIProvider($config->string('ai.key'), $config->string('ai.model'))
    : new DisabledAIProvider($config->string('ai.model'));
$aiRepository = new PdoAIActionRepository($services['pdo']);
$aiService = new AIActionService($aiProvider, new ProposalValidator, $aiRepository, $planningRepository, $planningService, $reviewService, $services['transactions'], $services['uuid'], $services['clock']);
$aiController = new AIActionController($auth, $aiService);
$reminderService = new \Planner\Application\Planning\TaskReminderService(
    new \Planner\Infrastructure\Persistence\Pdo\Planning\PdoReminderRepository($services['pdo']),
    $accountRepository, $services['transactions'],
    new \Planner\Infrastructure\Mail\PasswordResetMailer($config->string('app.env'), $config->string('storage.private_root'), $config->string('mail.from')),
    $services['clock'], $config->string('app.url'),
);
$reminderController = new \Planner\Http\Controller\ReminderController($auth, $reminderService);
$inputValidator = new InputValidator;
$mailer = new \Planner\Infrastructure\Mail\PasswordResetMailer($config->string('app.env'), $config->string('storage.private_root'), $config->string('mail.from'));
$notificationService = new \Planner\Application\Notifications\NotificationService(
    new \Planner\Infrastructure\Persistence\Pdo\Notifications\PdoNotificationRepository($services['pdo']),
    $accountRepository, $reminderService, $mailer, $services['uuid'], $services['clock'], $logger, $config->string('app.url'),
);
$notificationController = new \Planner\Http\Controller\NotificationController($auth, $notificationService, $inputValidator);
$noteShareRepository = new \Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteShareRepository($services['pdo']);
$noteShareService = new \Planner\Application\Notes\NoteShareService($noteRepository, $noteShareRepository, $accountRepository, $notificationService, $services['transactions'], $services['uuid'], $services['clock']);
$systemSettings = new \Planner\Infrastructure\Persistence\Pdo\Admin\PdoSystemSettingRepository($services['pdo']);
$reportService = new \Planner\Application\Admin\ReportService(
    new \Planner\Infrastructure\Persistence\Pdo\Admin\PdoReportRepository($services['pdo']),
    $systemSettings, $accountRepository, $noteShareService, $notificationService, $services['transactions'], $services['uuid'], $services['clock'],
);
$noteService = new NoteService(
    $noteRepository,
    $tagRepository,
    $accountRepository,
    $services['transactions'],
    $noteSerializer,
    $services['clock'],
    $noteShareService,
);
$noteController = new NoteController(
    $auth,
    $noteService,
    new NoteListQuery($noteRepository, $tagRepository),
    new NoteValidator(new InputValidator),
    $noteSerializer,
    $cleanup,
);
$noteShareController = new \Planner\Http\Controller\NoteShareController($auth, $noteShareService, $reportService, new NoteValidator($inputValidator), $inputValidator);
$adminController = new \Planner\Http\Controller\AdminController($auth, $reportService, $inputValidator, $accountController);
$twoFactorService = new \Planner\Application\Account\TwoFactorService(
    $accountRepository,
    new \Planner\Infrastructure\Persistence\Pdo\Account\PdoTwoFactorRepository($services['pdo']),
    $services['transactions'], $rateLimiter, $session,
    SessionCipher::fromEncodedKey($config->nullableString('session.key')),
    $mailer, $services['clock'],
);
$twoFactorController = new \Planner\Http\Controller\TwoFactorController($auth, $twoFactorService, $inputValidator, $session, $views);
$teamService = new \Planner\Application\Teamwork\TeamService(
    new \Planner\Infrastructure\Persistence\Pdo\Teamwork\PdoTeamRepository($services['pdo']),
    $accountRepository, $noteShareRepository, $notificationService, $services['transactions'], $services['uuid'], $services['clock'],
);
$teamController = new \Planner\Http\Controller\TeamController($auth, $teamService, $inputValidator);
$aiChatController = new \Planner\Http\Controller\AIChatController($auth, new \Planner\Application\AI\AIChatService($aiProvider, $aiRepository), $inputValidator);
$taskHistoryService = new \Planner\Application\Planning\TaskHistoryService(
    new \Planner\Infrastructure\Persistence\Pdo\Planning\PdoTaskHistoryRepository($services['pdo']),
    $systemSettings, $services['transactions'], $services['clock'],
);
$routeFactory = require dirname(__DIR__).'/routes/web.php';
$router = new Router($routeFactory(
    $accountController,
    $noteController,
    $labelController,
    $attachmentController,
    $profileFileController,
    $fileContentController,
    $planningController,
    $habitController,
    $taskSeriesController,
    $dashboardController,
    $reviewController,
    $aiController,
    $passwordResetController,
    $reminderController,
    $notificationController,
    $noteShareController,
    $adminController,
    $twoFactorController,
    $teamController,
    $aiChatController,
));
$application = new Application(
    $router,
    $session,
    $auth,
    new CsrfGuard($session, $config->string('app.url')),
    $rateLimiter,
    new ErrorHandler($logger, $config->bool('app.debug')),
);

return [
    'application' => $application,
    'password_reset_service' => $passwordResetService,
    'background_service' => $backgroundService,
    'reminder_service' => $reminderService,
    'notification_service' => $notificationService,
    'note_share_service' => $noteShareService,
    'report_service' => $reportService,
    'two_factor_service' => $twoFactorService,
    'team_service' => $teamService,
    'task_history_service' => $taskHistoryService,
    'note_service' => $noteService,
    'router' => $router,
    'session' => $session,
    'auth' => $auth,
    'account_repository' => $accountRepository,
    'note_repository' => $noteRepository,
    'tag_repository' => $tagRepository,
    'attachment_repository' => $attachmentRepository,
    'pending_deletion_repository' => $pendingDeletionRepository,
    'private_storage' => $storage,
    'file_cleanup' => $cleanup,
    'file_service' => $fileService,
    'planning_repository' => $planningRepository,
    'planning_service' => $planningService,
    'activity_repository' => $activityRepository,
    'habit_repository' => $habitRepository,
    'habit_service' => $habitService,
    'task_series_repository' => $taskSeriesRepository,
    'task_series_service' => $taskSeriesService,
    'dashboard_service' => $dashboardService,
    'review_service' => $reviewService,
    'goal_snapshot_service' => $snapshotService,
    'ai_action_repository' => $aiRepository,
    'ai_action_service' => $aiService,
    'upload_validator' => $uploadValidator,
    ...$services,
];
