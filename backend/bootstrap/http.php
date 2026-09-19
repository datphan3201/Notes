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
$noteRepository = new PdoNoteRepository($services['pdo']);
$tagRepository = new PdoTagRepository($services['pdo']);
$labelSerializer = new LabelSerializer;
$noteSerializer = new NoteSerializer($labelSerializer);
$noteService = new NoteService(
    $noteRepository,
    $tagRepository,
    $accountRepository,
    $services['transactions'],
    $noteSerializer,
    $services['clock'],
);
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
$noteController = new NoteController(
    $auth,
    $noteService,
    new NoteListQuery($noteRepository, $tagRepository),
    new NoteValidator(new InputValidator),
    $noteSerializer,
    $cleanup,
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
$profileFileController = new ProfileFileController(
    $auth,
    $fileService,
    $uploadValidator,
    new AccountSerializer,
);
$fileContentController = new FileContentController($auth, $fileService, new FileStreamer);
$activityRepository = new PdoActivityRepository($services['pdo']);
$planningService = new PlanningService(
    $planningRepository,
    $services['transactions'],
    new GraphGuard,
    new GoalProgressCalculator,
    $services['uuid'],
    $services['clock'],
    $activityRepository,
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
$taskSeriesRepository = new PdoTaskSeriesRepository($services['pdo']);
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
