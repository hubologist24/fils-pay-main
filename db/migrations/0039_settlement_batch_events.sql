--hatice This table was created because of the 0054_views file. This view is called settlement_batch_events, but it does not exist.
CREATE TABLE IF NOT EXISTS settlement_batch_events (
    id BIGSERIAL PRIMARY KEY,
    transaction_event_id BIGINT REFERENCES transaction_events(id),
    batch_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
