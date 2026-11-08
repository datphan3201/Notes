CREATE TABLE users (
	id VARCHAR(36) NOT NULL, 
	email VARCHAR(320) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	password_hash TEXT NOT NULL, 
	timezone VARCHAR(80) NOT NULL, 
	locale VARCHAR(5) NOT NULL, 
	theme VARCHAR(20) NOT NULL, 
	email_verified_at TIMESTAMP WITH TIME ZONE, 
	locked_at TIMESTAMP WITH TIME ZONE, 
	totp_secret TEXT, 
	totp_last_step INTEGER NOT NULL, 
	requires_mfa_reset BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (email)
);

CREATE TABLE rate_buckets (
	key VARCHAR(100) NOT NULL, 
	count INTEGER NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (key)
);

CREATE TABLE legacy_records (
	source_table VARCHAR(100) NOT NULL, 
	source_key VARCHAR(64) NOT NULL, 
	payload JSON NOT NULL, 
	checksum VARCHAR(64) NOT NULL, 
	PRIMARY KEY (source_table, source_key)
);

CREATE TABLE import_receipts (
	snapshot_hash VARCHAR(64) NOT NULL, 
	report JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (snapshot_hash)
);

CREATE TABLE login_sessions (
	token_hash VARCHAR(64) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	csrf VARCHAR(64) NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (token_hash), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_login_sessions_user_id ON login_sessions (user_id);

CREATE TABLE auth_tokens (
	token_hash VARCHAR(64) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	purpose VARCHAR(20) NOT NULL, 
	payload JSON NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (token_hash), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_auth_tokens_user_id ON auth_tokens (user_id);

CREATE TABLE areas (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	content TEXT NOT NULL, 
	importance INTEGER NOT NULL, 
	version INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, id), 
	CHECK (importance BETWEEN 1 AND 5), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX areas_owner_page ON areas (user_id, archived_at, updated_at, id);

CREATE TABLE habits (
	timezone VARCHAR(80) NOT NULL, 
	frequency VARCHAR(10) NOT NULL, 
	target INTEGER NOT NULL, 
	first_check_in_at TIMESTAMP WITH TIME ZONE, 
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	content TEXT NOT NULL, 
	importance INTEGER NOT NULL, 
	version INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, id), 
	CHECK (importance BETWEEN 1 AND 5), 
	CHECK (frequency IN ('daily','weekly')), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX habits_owner_page ON habits (user_id, archived_at, updated_at, id);

CREATE TABLE reviews (
	period VARCHAR(10) NOT NULL, 
	period_date DATE NOT NULL, 
	snapshot JSON NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	content TEXT NOT NULL, 
	importance INTEGER NOT NULL, 
	version INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, id), 
	CHECK (importance BETWEEN 1 AND 5), 
	UNIQUE (user_id, period, period_date), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX reviews_owner_page ON reviews (user_id, archived_at, updated_at, id);

CREATE TABLE task_series (
	frequency VARCHAR(10) NOT NULL, 
	interval_count INTEGER NOT NULL, 
	weekdays JSON NOT NULL, 
	start_date DATE NOT NULL, 
	end_date DATE, 
	cursor DATE, 
	state VARCHAR(10) NOT NULL, 
	timezone VARCHAR(80) NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	content TEXT NOT NULL, 
	importance INTEGER NOT NULL, 
	version INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, id), 
	CHECK (importance BETWEEN 1 AND 5), 
	CHECK (state IN ('active','paused','ended')), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX task_series_owner_page ON task_series (user_id, archived_at, updated_at, id);

CREATE TABLE activities (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	kind VARCHAR(30) NOT NULL, 
	entity_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_activities_user_id ON activities (user_id);

CREATE TABLE jobs (
	id VARCHAR(36) NOT NULL, 
	kind VARCHAR(30) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	key VARCHAR(200) NOT NULL, 
	payload JSON NOT NULL, 
	status VARCHAR(10) NOT NULL, 
	attempts INTEGER NOT NULL, 
	available_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	lease_until TIMESTAMP WITH TIME ZONE, 
	lease_token VARCHAR(36), 
	error_code VARCHAR(100), 
	dispatched_at TIMESTAMP WITH TIME ZONE, 
	dispatch_generation INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	UNIQUE (key)
);

CREATE INDEX jobs_claim ON jobs (status, available_at);

CREATE INDEX ix_jobs_user_id ON jobs (user_id);

CREATE TABLE documents (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	source_kind VARCHAR(20) NOT NULL, 
	source_id VARCHAR(36) NOT NULL, 
	source_version INTEGER NOT NULL, 
	chunk INTEGER NOT NULL, 
	text TEXT NOT NULL, 
	content_hash VARCHAR(64) NOT NULL, 
	embedding VECTOR(1536), 
	embedding_model VARCHAR(100), 
	PRIMARY KEY (id), 
	UNIQUE (source_kind, source_id, chunk), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_documents_user_id ON documents (user_id);

CREATE TABLE ai_runs (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	prompt TEXT NOT NULL, 
	answer TEXT NOT NULL, 
	status VARCHAR(15) NOT NULL, 
	sources JSON NOT NULL, 
	proposal JSON, 
	proposal_hash VARCHAR(64), 
	proposal_expires TIMESTAMP WITH TIME ZONE, 
	applied_at TIMESTAMP WITH TIME ZONE, 
	model VARCHAR(100) NOT NULL, 
	input_tokens INTEGER NOT NULL, 
	output_tokens INTEGER NOT NULL, 
	reserved_tokens INTEGER NOT NULL, 
	cost_usd FLOAT NOT NULL, 
	latency_ms INTEGER NOT NULL, 
	error_code VARCHAR(100), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ai_runs_owner_date ON ai_runs (user_id, created_at);

CREATE INDEX ix_ai_runs_user_id ON ai_runs (user_id);

CREATE TABLE notifications (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	key VARCHAR(200) NOT NULL, 
	message VARCHAR(500) NOT NULL, 
	read BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	UNIQUE (key)
);

CREATE INDEX ix_notifications_user_id ON notifications (user_id);

CREATE TABLE goals (
	area_id VARCHAR(36), 
	parent_goal_id VARCHAR(36), 
	start_date DATE, 
	due_date DATE, 
	status VARCHAR(20) NOT NULL, 
	expected_result TEXT NOT NULL, 
	completion_criteria TEXT NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	content TEXT NOT NULL, 
	importance INTEGER NOT NULL, 
	version INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, id), 
	CHECK (importance BETWEEN 1 AND 5), 
	FOREIGN KEY(user_id, area_id) REFERENCES areas (user_id, id), 
	FOREIGN KEY(user_id, parent_goal_id) REFERENCES goals (user_id, id), 
	CHECK ((area_id IS NULL) <> (parent_goal_id IS NULL)), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX goals_owner_page ON goals (user_id, archived_at, updated_at, id);

CREATE TABLE habit_days (
	habit_id VARCHAR(36) NOT NULL, 
	day DATE NOT NULL, 
	state VARCHAR(10) NOT NULL, 
	PRIMARY KEY (habit_id, day), 
	CHECK (state IN ('done','rest')), 
	FOREIGN KEY(habit_id) REFERENCES habits (id) ON DELETE CASCADE
);

CREATE TABLE milestones (
	goal_id VARCHAR(36) NOT NULL, 
	start_date DATE, 
	due_date DATE, 
	status VARCHAR(20) NOT NULL, 
	completion_criteria TEXT NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	content TEXT NOT NULL, 
	importance INTEGER NOT NULL, 
	version INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, id), 
	CHECK (importance BETWEEN 1 AND 5), 
	FOREIGN KEY(user_id, goal_id) REFERENCES goals (user_id, id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX milestones_owner_page ON milestones (user_id, archived_at, updated_at, id);

CREATE TABLE focus_goals (
	user_id VARCHAR(36) NOT NULL, 
	goal_id VARCHAR(36), 
	PRIMARY KEY (user_id), 
	FOREIGN KEY(user_id, goal_id) REFERENCES goals (user_id, id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE milestone_dependencies (
	user_id VARCHAR(36) NOT NULL, 
	milestone_id VARCHAR(36) NOT NULL, 
	prerequisite_id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (user_id, milestone_id, prerequisite_id), 
	FOREIGN KEY(user_id, milestone_id) REFERENCES milestones (user_id, id), 
	FOREIGN KEY(user_id, prerequisite_id) REFERENCES milestones (user_id, id), 
	CHECK (milestone_id <> prerequisite_id)
);

CREATE TABLE tasks (
	goal_id VARCHAR(36), 
	milestone_id VARCHAR(36), 
	status VARCHAR(20) NOT NULL, 
	start_date DATE, 
	due_date DATE, 
	scheduled_at TIMESTAMP WITH TIME ZONE, 
	reminder_at TIMESTAMP WITH TIME ZONE, 
	estimated_minutes INTEGER, 
	checklist JSON NOT NULL, 
	working_note TEXT NOT NULL, 
	expected_result TEXT NOT NULL, 
	completion_criteria TEXT NOT NULL, 
	series_id VARCHAR(36), 
	occurrence_date DATE, 
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	content TEXT NOT NULL, 
	importance INTEGER NOT NULL, 
	version INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, id), 
	CHECK (importance BETWEEN 1 AND 5), 
	FOREIGN KEY(user_id, goal_id) REFERENCES goals (user_id, id), 
	FOREIGN KEY(user_id, milestone_id) REFERENCES milestones (user_id, id), 
	CHECK (goal_id IS NULL OR milestone_id IS NULL), 
	CHECK (status IN ('todo','doing','blocked','done')), 
	UNIQUE (series_id, occurrence_date), 
	FOREIGN KEY(series_id) REFERENCES task_series (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX tasks_owner_page ON tasks (user_id, archived_at, updated_at, id);

CREATE INDEX tasks_owner_due ON tasks (user_id, due_date);

CREATE TABLE notes (
	lock_hash TEXT, 
	pinned BOOLEAN NOT NULL, 
	tags JSON NOT NULL, 
	goal_id VARCHAR(36), 
	task_id VARCHAR(36), 
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	content TEXT NOT NULL, 
	importance INTEGER NOT NULL, 
	version INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, id), 
	CHECK (importance BETWEEN 1 AND 5), 
	FOREIGN KEY(user_id, goal_id) REFERENCES goals (user_id, id), 
	FOREIGN KEY(user_id, task_id) REFERENCES tasks (user_id, id), 
	CHECK (goal_id IS NULL OR task_id IS NULL), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX notes_owner_page ON notes (user_id, archived_at, updated_at, id);

CREATE TABLE task_selections (
	user_id VARCHAR(36) NOT NULL, 
	task_id VARCHAR(36) NOT NULL, 
	period VARCHAR(10) NOT NULL, 
	day DATE NOT NULL, 
	PRIMARY KEY (user_id, task_id, period, day), 
	FOREIGN KEY(user_id, task_id) REFERENCES tasks (user_id, id), 
	CHECK (period IN ('daily','weekly'))
);

CREATE TABLE note_unlocks (
	token_hash VARCHAR(64) NOT NULL, 
	note_id VARCHAR(36) NOT NULL, 
	lock_hash TEXT NOT NULL, 
	PRIMARY KEY (token_hash, note_id), 
	FOREIGN KEY(token_hash) REFERENCES login_sessions (token_hash) ON DELETE CASCADE, 
	FOREIGN KEY(note_id) REFERENCES notes (id) ON DELETE CASCADE
);

CREATE TABLE note_shares (
	note_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	can_edit BOOLEAN NOT NULL, 
	PRIMARY KEY (note_id, user_id), 
	FOREIGN KEY(note_id) REFERENCES notes (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE attachments (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	note_id VARCHAR(36) NOT NULL, 
	filename VARCHAR(200) NOT NULL, 
	storage_key VARCHAR(100) NOT NULL, 
	size INTEGER NOT NULL, 
	checksum VARCHAR(64) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id, note_id) REFERENCES notes (user_id, id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	UNIQUE (storage_key)
);

CREATE INDEX ix_attachments_user_id ON attachments (user_id);

CREATE INDEX documents_fts ON documents USING gin (to_tsvector('simple', text));
