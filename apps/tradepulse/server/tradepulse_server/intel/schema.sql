-- TradePulse intelligence store.
--
-- Every table here is append-only. Recommendations and valuations are facts
-- about a moment in time: what the AI said, and what it knew when it said it.
-- Rewriting one would destroy the only thing that makes the performance engine
-- and the learning loop meaningful. Corrections are new rows with a higher
-- `version`, never an UPDATE.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER NOT NULL,
    applied_at  TEXT    NOT NULL
);

-- ---------------------------------------------------------------- valuations
-- One row per (symbol, statement date) valuation run. Re-running against the
-- same financials is idempotent on `fingerprint`; new financials produce a new
-- row, which is what gives us the historical intrinsic-value trend for free.
CREATE TABLE IF NOT EXISTS valuations (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol              TEXT    NOT NULL,
    -- Period end of the financials this valuation was computed from.
    as_of               TEXT    NOT NULL,
    computed_at         TEXT    NOT NULL,
    -- Hash of the inputs; lets a refresh skip work when nothing changed.
    fingerprint         TEXT    NOT NULL,
    provider            TEXT    NOT NULL,

    intrinsic_value     REAL,
    fair_value          REAL,
    dcf_value           REAL,
    epv_value           REAL,
    market_price        REAL,
    margin_of_safety    REAL,   -- fraction: 0.28 == 28% below intrinsic
    discount_premium    REAL,   -- fraction: negative == trading at a discount
    financial_health    REAL,   -- 0-100
    business_quality    REAL,   -- 0-100
    -- Full input + intermediate record, so a number on screen can always be
    -- traced back to what produced it.
    detail              TEXT    NOT NULL,

    UNIQUE (symbol, as_of, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_valuations_symbol ON valuations (symbol, as_of DESC);

-- ----------------------------------------------------------- recommendations
-- The AI's permanent record. Never updated, never deleted.
CREATE TABLE IF NOT EXISTS recommendations (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol              TEXT    NOT NULL,
    action              TEXT    NOT NULL,   -- BUY | HOLD | REDUCE | SELL | AVOID
    created_at          TEXT    NOT NULL,
    -- Supersession chain: a later call on the same symbol points back at the
    -- one it replaces. Both rows survive.
    version             INTEGER NOT NULL DEFAULT 1,
    supersedes_id       INTEGER REFERENCES recommendations (id),

    market_price        REAL    NOT NULL,
    intrinsic_value     REAL,
    valuation_id        INTEGER REFERENCES valuations (id),

    confidence          REAL    NOT NULL,   -- 0-100
    technical_score     REAL,
    fundamental_score   REAL,
    macro_score         REAL,
    news_sentiment      REAL,               -- -100..100

    -- Human-readable "why", plus the structured agent outputs behind it.
    reasoning           TEXT    NOT NULL,
    evidence            TEXT    NOT NULL,
    engine_version      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recs_symbol ON recommendations (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recs_created ON recommendations (created_at DESC);

-- ------------------------------------------------------------ agent outputs
-- What each agent contributed to a recommendation. Kept separately so the
-- learning loop can score agents individually rather than only the blend.
CREATE TABLE IF NOT EXISTS agent_outputs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    recommendation_id   INTEGER REFERENCES recommendations (id),
    symbol              TEXT    NOT NULL,
    agent               TEXT    NOT NULL,
    created_at          TEXT    NOT NULL,
    stance              TEXT    NOT NULL,   -- the agent's own call
    score               REAL,               -- -100..100
    confidence          REAL,               -- 0-100
    summary             TEXT    NOT NULL,
    detail              TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_outputs_rec ON agent_outputs (recommendation_id);
CREATE INDEX IF NOT EXISTS idx_agent_outputs_agent ON agent_outputs (agent, created_at DESC);

-- ------------------------------------------------------------------- prices
-- Observed marks for a symbol. The performance engine walks these to compute
-- drawdown and returns; without a price history "maximum drawdown" is not
-- answerable.
CREATE TABLE IF NOT EXISTS price_marks (
    symbol      TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    price       REAL NOT NULL,
    source      TEXT NOT NULL,
    PRIMARY KEY (symbol, observed_at)
);

-- ----------------------------------------------------------------- outcomes
-- Rolling evaluation of a recommendation. This one IS recomputed — it is a
-- derived view of prices, not a historical fact — so it is keyed by
-- recommendation and replaced wholesale on each run.
CREATE TABLE IF NOT EXISTS outcomes (
    recommendation_id   INTEGER PRIMARY KEY REFERENCES recommendations (id),
    evaluated_at        TEXT    NOT NULL,
    current_price       REAL    NOT NULL,
    holding_days        INTEGER NOT NULL,

    -- If the user acted on it.
    entry_price         REAL,
    absolute_return     REAL,   -- fraction
    cagr                REAL,   -- fraction
    max_drawdown        REAL,   -- fraction, negative

    -- If the user did not.
    gain_missed         REAL,
    loss_avoided        REAL,
    capital_protected   REAL,
    opportunity_cost    REAL,

    verdict             TEXT    NOT NULL,   -- CORRECT | INCORRECT | OPEN
    detail              TEXT    NOT NULL
);

-- ------------------------------------------------------------ signal weights
-- The learning loop's output: how much each agent's view should count, derived
-- from how predictive it has actually been. Append-only so weight drift is
-- itself auditable.
CREATE TABLE IF NOT EXISTS signal_weights (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    agent           TEXT    NOT NULL,
    weight          REAL    NOT NULL,
    hit_rate        REAL,
    sample_size     INTEGER NOT NULL,
    computed_at     TEXT    NOT NULL,
    rationale       TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weights_agent ON signal_weights (agent, computed_at DESC);

-- ------------------------------------------------------------------- runs
-- Every orchestrated cycle, with its per-stage outcome. An unattended
-- pipeline that leaves no trace cannot be debugged after the fact, and
-- "the weights moved" is only meaningful next to "this is what ran".
CREATE TABLE IF NOT EXISTS runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at      TEXT    NOT NULL,
    finished_at     TEXT    NOT NULL,
    duration_ms     INTEGER NOT NULL,
    trigger         TEXT    NOT NULL,   -- scheduler | manual | test
    ok              INTEGER NOT NULL,
    stages          TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_started ON runs (started_at DESC);
