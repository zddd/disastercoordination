package repository

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	"github.com/lib/pq"

	"disaster-coordination/internal/model"
)

// ---- Help Repository Implementation ----

func (r *helpPostgresRepo) Create(ctx context.Context, h *model.HelpRequest) error {
	slog.DebugContext(ctx, "creating help request",
		"disaster_id", h.DisasterID,
		"category", h.Category,
		"urgency", h.Urgency,
	)

	query := `
		INSERT INTO help_requests (
			id, disaster_id, submitter_id, category, urgency, description,
			affected_count, precise_geom, offset_geom, offset_meters,
			phone, contact_name, status, review_status, is_isolated_report,
			submitter_credit_score, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			ST_SetSRID(ST_MakePoint($8, $9), 4326),
			ST_SetSRID(ST_MakePoint($10, $11), 4326),
			$12, $13, $14, $15, $16, $17, $18, $19, $20
		)`

	_, err := r.db.ExecContext(ctx, query,
		h.ID, h.DisasterID, nullString(h.SubmitterID), h.Category, h.Urgency, h.Description,
		h.AffectedCount,
		h.PreciseLng, h.PreciseLat, // ST_MakePoint(lon, lat) order
		h.OffsetLng, h.OffsetLat,
		h.OffsetMeters,
		nullString(h.Phone), nullString(h.ContactName),
		h.Status, h.ReviewStatus,
		h.IsIsolatedReport, nullFloat(h.SubmitterCreditScore),
		h.CreatedAt, h.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert help_request: %w", err)
	}
	return nil
}

func (r *helpPostgresRepo) GetByID(ctx context.Context, id string) (*model.HelpRequest, error) {
	query := `
		SELECT id, disaster_id, submitter_id, category, urgency, description,
			   affected_count,
			   ST_Y(precise_geom::geometry) as precise_lat,
			   ST_X(precise_geom::geometry) as precise_lng,
			   ST_Y(offset_geom::geometry) as offset_lat,
			   ST_X(offset_geom::geometry) as offset_lng,
			   offset_meters, phone, contact_name, status, review_status,
			   is_isolated_report, submitter_credit_score,
			   is_archived, created_at, updated_at, reviewed_at
		FROM help_requests WHERE id = $1`

	h := &model.HelpRequest{}
	var submitterID, phone, contactName sql.NullString
	var preciseLat, preciseLng, offsetLat, offsetLng, offsetMeters sql.NullFloat64
	var submitterScore sql.NullFloat64
	var reviewedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&h.ID, &h.DisasterID, &submitterID, &h.Category, &h.Urgency, &h.Description,
		&h.AffectedCount,
		&preciseLat, &preciseLng, &offsetLat, &offsetLng,
		&offsetMeters, &phone, &contactName, &h.Status, &h.ReviewStatus,
		&h.IsIsolatedReport, &submitterScore,
		&h.IsArchived, &h.CreatedAt, &h.UpdatedAt, &reviewedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get help_request: %w", err)
	}

	h.SubmitterID = submitterID.String
	h.Phone = phone.String
	h.ContactName = contactName.String
	if preciseLat.Valid {
		h.PreciseLat = preciseLat.Float64
		h.PreciseLng = preciseLng.Float64
	}
	if offsetLat.Valid {
		h.OffsetLat = offsetLat.Float64
		h.OffsetLng = offsetLng.Float64
		h.OffsetMeters = offsetMeters.Float64
	}
	if submitterScore.Valid {
		h.SubmitterCreditScore = submitterScore.Float64
	}
	if reviewedAt.Valid {
		h.ReviewedAt = &reviewedAt.Time
	}

	return h, nil
}

func (r *helpPostgresRepo) ListByDisaster(ctx context.Context, disasterID string, status string) ([]*model.HelpRequest, error) {
	query := `
		SELECT id, disaster_id, submitter_id, category, urgency, description,
			   affected_count,
			   ST_Y(offset_geom::geometry) as offset_lat,
			   ST_X(offset_geom::geometry) as offset_lng,
			   status, review_status, is_isolated_report, created_at, updated_at
		FROM help_requests
		WHERE disaster_id = $1 AND ($2 = '' OR status = $2)
		ORDER BY CASE urgency WHEN 'critical' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, created_at DESC`

	rows, err := r.db.QueryContext(ctx, query, disasterID, status)
	if err != nil {
		return nil, fmt.Errorf("list help_requests: %w", err)
	}
	defer rows.Close()

	var results []*model.HelpRequest
	for rows.Next() {
		h := &model.HelpRequest{}
		var submitterID sql.NullString
		var offsetLat, offsetLng sql.NullFloat64
		if err := rows.Scan(&h.ID, &h.DisasterID, &submitterID, &h.Category, &h.Urgency, &h.Description,
			&h.AffectedCount, &offsetLat, &offsetLng,
			&h.Status, &h.ReviewStatus, &h.IsIsolatedReport, &h.CreatedAt, &h.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan help_request: %w", err)
		}
		h.SubmitterID = submitterID.String
		if offsetLat.Valid {
			h.OffsetLat = offsetLat.Float64
			h.OffsetLng = offsetLng.Float64
		}
		results = append(results, h)
	}
	return results, rows.Err()
}

func (r *helpPostgresRepo) ListBySubmitter(ctx context.Context, submitterID string) ([]*model.HelpRequest, error) {
	query := `
		SELECT id, disaster_id, category, urgency, description, status, review_status, created_at
		FROM help_requests WHERE submitter_id = $1 ORDER BY created_at DESC LIMIT 50`

	rows, err := r.db.QueryContext(ctx, query, submitterID)
	if err != nil {
		return nil, fmt.Errorf("list by submitter: %w", err)
	}
	defer rows.Close()

	var results []*model.HelpRequest
	for rows.Next() {
		h := &model.HelpRequest{}
		if err := rows.Scan(&h.ID, &h.DisasterID, &h.Category, &h.Urgency,
			&h.Description, &h.Status, &h.ReviewStatus, &h.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		results = append(results, h)
	}
	return results, rows.Err()
}

func (r *helpPostgresRepo) UpdateStatus(ctx context.Context, id string, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE help_requests SET status = $1, updated_at = NOW() WHERE id = $2`,
		status, id)
	return err
}

func (r *helpPostgresRepo) UpdateReviewStatus(ctx context.Context, id string, reviewStatus string, reviewerID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE help_requests SET review_status = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW() WHERE id = $3`,
		reviewStatus, reviewerID, id)
	return err
}

func (r *helpPostgresRepo) ListInPool(ctx context.Context, disasterID string, zone string) ([]*model.HelpRequest, error) {
	// Pool = reviewed helps awaiting dispatch or already assigned
	// Includes both in_pool and assigned statuses for full command visibility
	query := `
		SELECT h.id, h.disaster_id, h.submitter_id, h.category, h.urgency, h.description,
			   h.affected_count,
			   ST_Y(h.offset_geom::geometry) as lat, ST_X(h.offset_geom::geometry) as lng,
			   h.status, h.review_status, h.is_isolated_report,
			   EXTRACT(EPOCH FROM NOW() - h.reviewed_at)/60 as waiting_minutes,
			   h.created_at, h.updated_at
		FROM help_requests h
		WHERE h.disaster_id = $1 AND h.status IN ('in_pool', 'assigned')
		ORDER BY CASE h.urgency WHEN 'critical' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
				 h.reviewed_at ASC`

	rows, err := r.db.QueryContext(ctx, query, disasterID)
	if err != nil {
		return nil, fmt.Errorf("list pool: %w", err)
	}
	defer rows.Close()

	var results []*model.HelpRequest
	for rows.Next() {
		h := &model.HelpRequest{}
		var submitterID sql.NullString
		var lat, lng, waitingMin sql.NullFloat64
		if err := rows.Scan(&h.ID, &h.DisasterID, &submitterID, &h.Category, &h.Urgency, &h.Description,
			&h.AffectedCount, &lat, &lng, &h.Status, &h.ReviewStatus, &h.IsIsolatedReport,
			&waitingMin, &h.CreatedAt, &h.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan pool item: %w", err)
		}
		h.SubmitterID = submitterID.String
		if lat.Valid {
			h.OffsetLat = lat.Float64
			h.OffsetLng = lng.Float64
		}
		results = append(results, h)
	}
	return results, rows.Err()
}

func (r *helpPostgresRepo) CheckDuplicate(ctx context.Context, disasterID string, lat, lng float64, descriptionHash string, interval time.Duration) (bool, string, error) {
	// Check for nearby help requests with similar description within time window
	query := `
		SELECT id FROM help_requests
		WHERE disaster_id = $1
		  AND ST_DWithin(offset_geom, ST_SetSRID(ST_MakePoint($2, $3), 4326), 100)  -- 100m radius
		  AND created_at > NOW() - $4::interval
		LIMIT 1`

	var dupID string
	err := r.db.QueryRowContext(ctx, query, disasterID, lng, lat, fmt.Sprintf("%d seconds", int(interval.Seconds()))).Scan(&dupID)
	if err == sql.ErrNoRows {
		return false, "", nil
	}
	if err != nil {
		return false, "", fmt.Errorf("check duplicate: %w", err)
	}
	return true, dupID, nil
}

func (r *helpPostgresRepo) ListPendingReview(ctx context.Context, limit int) ([]*model.HelpRequest, error) {
	query := `
		SELECT id, disaster_id, category, urgency, description, created_at
		FROM help_requests WHERE review_status = 'pending'
		ORDER BY CASE urgency WHEN 'critical' THEN 0 ELSE 1 END, created_at ASC
		LIMIT $1`

	rows, err := r.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []*model.HelpRequest
	for rows.Next() {
		h := &model.HelpRequest{}
		if err := rows.Scan(&h.ID, &h.DisasterID, &h.Category, &h.Urgency,
			&h.Description, &h.CreatedAt); err != nil {
			return nil, err
		}
		results = append(results, h)
	}
	return results, rows.Err()
}

// ---- Disaster Repository Implementation ----

func (r *disasterPostgresRepo) Create(ctx context.Context, d *model.Disaster) error {
	query := `
		INSERT INTO disasters (id, name, type, level, description, status, created_by, started_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

	_, err := r.db.ExecContext(ctx, query,
		d.ID, d.Name, d.Type, d.Level, nullString(d.Description),
		d.Status, d.CreatedBy, d.StartedAt, d.CreatedAt, d.UpdatedAt,
	)
	return err
}

func (r *disasterPostgresRepo) GetByID(ctx context.Context, id string) (*model.Disaster, error) {
	query := `SELECT id, name, type, level, description, status, created_by, started_at, closed_at, created_at, updated_at
			  FROM disasters WHERE id = $1`

	d := &model.Disaster{}
	var desc sql.NullString
	var closedAt sql.NullTime
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&d.ID, &d.Name, &d.Type, &d.Level, &desc, &d.Status,
		&d.CreatedBy, &d.StartedAt, &closedAt, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	d.Description = desc.String
	if closedAt.Valid {
		d.ClosedAt = &closedAt.Time
	}
	return d, nil
}

func (r *disasterPostgresRepo) List(ctx context.Context, status string) ([]*model.Disaster, error) {
	query := `SELECT id, name, type, level, status, started_at, closed_at, created_at
			  FROM disasters WHERE ($1 = '' OR status = $1) ORDER BY created_at DESC LIMIT 50`

	rows, err := r.db.QueryContext(ctx, query, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []*model.Disaster
	for rows.Next() {
		d := &model.Disaster{}
		var closedAt sql.NullTime
		if err := rows.Scan(&d.ID, &d.Name, &d.Type, &d.Level, &d.Status,
			&d.StartedAt, &closedAt, &d.CreatedAt); err != nil {
			return nil, err
		}
		if closedAt.Valid {
			d.ClosedAt = &closedAt.Time
		}
		results = append(results, d)
	}
	return results, rows.Err()
}

func (r *disasterPostgresRepo) ListActive(ctx context.Context) ([]*model.Disaster, error) {
	return r.List(ctx, "active")
}

func (r *disasterPostgresRepo) Close(ctx context.Context, id string, closedAt time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE disasters SET status = 'closed', closed_at = $1, updated_at = NOW() WHERE id = $2`,
		closedAt, id)
	return err
}

func (r *disasterPostgresRepo) GetSummary(ctx context.Context, id string) (*model.DisasterSummary, error) {
	var s model.DisasterSummary
	s.DisasterID = id

	// Count total helps
	r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM help_requests WHERE disaster_id = $1`, id).Scan(&s.TotalHelps)

	// Count unique helps (non-merged)
	r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM help_requests WHERE disaster_id = $1 AND review_status != 'merged'`, id).Scan(&s.UniqueHelps)

	// Count completed tasks
	r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM rescue_tasks WHERE disaster_id = $1 AND status = 'completed'`, id).Scan(&s.CompletedTasks)

	// Count unable tasks
	r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM rescue_tasks WHERE disaster_id = $1 AND status = 'unable'`, id).Scan(&s.UnableTasks)

	// Sum affected_count as people rescued
	r.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(affected_count), 0) FROM help_requests
		 INNER JOIN rescue_tasks ON rescue_tasks.help_request_id = help_requests.id
		 WHERE help_requests.disaster_id = $1 AND rescue_tasks.status = 'completed'`, id).Scan(&s.PeopleRescued)

	// Count deployed teams
	r.db.QueryRowContext(ctx,
		`SELECT COUNT(DISTINCT team_id) FROM rescue_tasks WHERE disaster_id = $1`, id).Scan(&s.TeamsDeployed)

	return &s, nil
}

// ---- Team Repository Implementation ----

func (r *teamPostgresRepo) Create(ctx context.Context, t *model.RescueTeam) error {
	slog.DebugContext(ctx, "creating rescue team record",
		"team_id", t.ID,
		"name", t.Name,
		"type", t.Type,
	)

	query := `
		INSERT INTO rescue_teams (id, name, type, capabilities, contact_phone, contact_person, member_count, status, verified, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`

	_, err := r.db.ExecContext(ctx, query,
		t.ID, t.Name, t.Type, pq.Array(t.Capabilities), t.ContactPhone,
		nullString(t.ContactPerson), t.MemberCount, t.Status, t.Verified,
		t.CreatedAt, t.UpdatedAt,
	)
	if err != nil {
		slog.ErrorContext(ctx, "failed to create rescue team record",
			"team_id", t.ID,
			"error", err,
		)
		return fmt.Errorf("create rescue_team: %w", err)
	}
	return nil
}

func (r *teamPostgresRepo) GetByID(ctx context.Context, id string) (*model.RescueTeam, error) {
	query := `SELECT id, name, type, capabilities, contact_phone, contact_person, member_count, status, verified, created_at
			  FROM rescue_teams WHERE id = $1`

	t := &model.RescueTeam{}
	var contactPerson sql.NullString
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&t.ID, &t.Name, &t.Type, pq.Array(&t.Capabilities), &t.ContactPhone,
		&contactPerson, &t.MemberCount, &t.Status, &t.Verified, &t.CreatedAt,
	)
	if err != nil {
		slog.ErrorContext(ctx, "failed to get rescue team by ID",
			"team_id", id,
			"error", err,
		)
		return nil, fmt.Errorf("get rescue_team by ID: %w", err)
	}
	t.ContactPerson = contactPerson.String
	return t, nil
}

func (r *teamPostgresRepo) List(ctx context.Context) ([]*model.RescueTeam, error) {
	query := `SELECT id, name, type, capabilities, contact_phone, member_count, status, verified, created_at
			  FROM rescue_teams ORDER BY created_at DESC LIMIT 100`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		slog.ErrorContext(ctx, "failed to query rescue teams list",
			"error", err,
		)
		return nil, fmt.Errorf("list rescue_teams query: %w", err)
	}
	defer rows.Close()

	var results []*model.RescueTeam
	for rows.Next() {
		t := &model.RescueTeam{}
		if err := rows.Scan(&t.ID, &t.Name, &t.Type, pq.Array(&t.Capabilities), &t.ContactPhone,
			&t.MemberCount, &t.Status, &t.Verified, &t.CreatedAt); err != nil {
			slog.ErrorContext(ctx, "failed to scan rescue team row",
				"error", err,
			)
			return nil, fmt.Errorf("scan rescue_team row: %w", err)
		}
		results = append(results, t)
	}
	if err := rows.Err(); err != nil {
		slog.ErrorContext(ctx, "error iterating rescue teams rows",
			"error", err,
		)
		return nil, fmt.Errorf("rescue_teams rows iteration: %w", err)
	}

	slog.DebugContext(ctx, "rescue teams list loaded",
		"count", len(results),
	)
	return results, nil
}

func (r *teamPostgresRepo) FindNearby(ctx context.Context, lat, lng float64, radiusMeters int) ([]*model.RescueTeam, error) {
	query := `
		SELECT id, name, type, capabilities, contact_phone, member_count, status, verified,
			   ST_Y(current_location::geometry) as lat, ST_X(current_location::geometry) as lng,
			   ST_Distance(current_location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) as distance_m
		FROM rescue_teams
		WHERE status = 'active' AND verified = true
		  AND current_location IS NOT NULL
		  AND ST_DWithin(current_location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
		ORDER BY distance_m ASC LIMIT 20`

	rows, err := r.db.QueryContext(ctx, query, lng, lat, radiusMeters)
	if err != nil {
		slog.ErrorContext(ctx, "failed to query nearby rescue teams",
			"lat", lat, "lng", lng, "radius_m", radiusMeters,
			"error", err,
		)
		return nil, fmt.Errorf("find nearby rescue_teams query: %w", err)
	}
	defer rows.Close()

	var results []*model.RescueTeam
	for rows.Next() {
		t := &model.RescueTeam{}
		if err := rows.Scan(&t.ID, &t.Name, &t.Type, pq.Array(&t.Capabilities), &t.ContactPhone,
			&t.MemberCount, &t.Status, &t.Verified, &t.CurrentLat, &t.CurrentLng); err != nil {
			slog.ErrorContext(ctx, "failed to scan nearby rescue team row",
				"error", err,
			)
			return nil, fmt.Errorf("scan nearby rescue_team row: %w", err)
		}
		results = append(results, t)
	}
	if err := rows.Err(); err != nil {
		slog.ErrorContext(ctx, "error iterating nearby rescue teams rows",
			"error", err,
		)
		return nil, fmt.Errorf("nearby rescue_teams rows iteration: %w", err)
	}
	return results, nil
}

func (r *teamPostgresRepo) UpdateStatus(ctx context.Context, id string, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE rescue_teams SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	return err
}

func (r *teamPostgresRepo) Verify(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE rescue_teams SET verified = true, status = 'active', updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *teamPostgresRepo) Reject(ctx context.Context, id string, reason string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE rescue_teams SET status = 'rejected', updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *teamPostgresRepo) UpdateLocation(ctx context.Context, id string, lat, lng float64) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE rescue_teams SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326), updated_at = NOW() WHERE id = $3`,
		lng, lat, id)
	return err
}

// ---- Task Repository Implementation ----

func (r *taskPostgresRepo) Create(ctx context.Context, t *model.RescueTask) error {
	query := `
		INSERT INTO rescue_tasks (id, help_request_id, team_id, disaster_id, status, assigned_by, status_history, notes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`

	_, err := r.db.ExecContext(ctx, query,
		t.ID, t.HelpRequestID, t.TeamID, t.DisasterID, t.Status,
		t.AssignedBy, "[]", nullString(t.Notes), t.CreatedAt, t.UpdatedAt,
	)
	return err
}

func (r *taskPostgresRepo) GetByID(ctx context.Context, id string) (*model.RescueTask, error) {
	query := `SELECT id, help_request_id, team_id, disaster_id, status, assigned_by, notes, accepted_at, completed_at, created_at, updated_at
			  FROM rescue_tasks WHERE id = $1`

	t := &model.RescueTask{}
	var notes sql.NullString
	var acceptedAt, completedAt sql.NullTime
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&t.ID, &t.HelpRequestID, &t.TeamID, &t.DisasterID, &t.Status, &t.AssignedBy,
		&notes, &acceptedAt, &completedAt, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	t.Notes = notes.String
	if acceptedAt.Valid {
		t.AcceptedAt = &acceptedAt.Time
	}
	if completedAt.Valid {
		t.CompletedAt = &completedAt.Time
	}
	return t, nil
}

func (r *taskPostgresRepo) ListByTeam(ctx context.Context, teamID string, status string) ([]*model.RescueTask, error) {
	query := `
		SELECT id, help_request_id, team_id, disaster_id, status, assigned_by, notes, created_at, updated_at
		FROM rescue_tasks WHERE team_id = $1 AND ($2 = '' OR status = $2)
		ORDER BY created_at DESC LIMIT 50`

	rows, err := r.db.QueryContext(ctx, query, teamID, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []*model.RescueTask
	for rows.Next() {
		t := &model.RescueTask{}
		var notes sql.NullString
		if err := rows.Scan(&t.ID, &t.HelpRequestID, &t.TeamID, &t.DisasterID, &t.Status,
			&t.AssignedBy, &notes, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		t.Notes = notes.String
		results = append(results, t)
	}
	return results, rows.Err()
}

func (r *taskPostgresRepo) ListByDisaster(ctx context.Context, disasterID string) ([]*model.RescueTask, error) {
	query := `SELECT id, help_request_id, team_id, disaster_id, status, assigned_by, created_at
			  FROM rescue_tasks`
	args := []interface{}{}
	if disasterID != "" {
		query += ` WHERE disaster_id = $1`
		args = append(args, disasterID)
	}
	query += ` ORDER BY created_at DESC LIMIT 200`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []*model.RescueTask
	for rows.Next() {
		t := &model.RescueTask{}
		if err := rows.Scan(&t.ID, &t.HelpRequestID, &t.TeamID, &t.DisasterID, &t.Status,
			&t.AssignedBy, &t.CreatedAt); err != nil {
			return nil, err
		}
		results = append(results, t)
	}
	return results, rows.Err()
}

func (r *taskPostgresRepo) UpdateStatus(ctx context.Context, id string, status string, operatorID string, notes string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE rescue_tasks SET status = $1, updated_at = NOW() WHERE id = $2`,
		status, id)
	return err
}

func (r *taskPostgresRepo) AppendStatusHistory(ctx context.Context, id string, entry model.StatusHistoryEntry) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE rescue_tasks SET status_history = status_history || $1::jsonb, updated_at = NOW() WHERE id = $2`,
		fmt.Sprintf(`[{"status":"%s","timestamp":"%s","operator_id":"%s","notes":"%s"}]`,
			entry.Status, entry.Timestamp.Format(time.RFC3339), entry.OperatorID, entry.Notes),
		id)
	return err
}

func (r *taskPostgresRepo) Reject(ctx context.Context, id string, reason string, operatorID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE rescue_tasks SET status = 'rejected', notes = $1, updated_at = NOW() WHERE id = $2`,
		reason, id)
	return err
}

// ---- User Repository Implementation ----

func (r *userPostgresRepo) Create(ctx context.Context, u *model.User) error {
	query := `
		INSERT INTO users (id, username, password_hash, display_name, phone, role, credit_score, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

	_, err := r.db.ExecContext(ctx, query,
		u.ID, u.Username, u.PasswordHash, nullString(""), nullString(u.Phone),
		u.Role, u.CreditScore, u.Status, u.CreatedAt, u.UpdatedAt,
	)
	return err
}

func (r *userPostgresRepo) GetByID(ctx context.Context, id string) (*model.User, error) {
	query := `SELECT id, username, phone, role, credit_score, status, created_at, updated_at
			  FROM users WHERE id = $1`

	u := &model.User{}
	var phone sql.NullString
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&u.ID, &u.Username, &phone, &u.Role, &u.CreditScore, &u.Status, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	u.Phone = phone.String
	return u, nil
}

func (r *userPostgresRepo) GetByUsername(ctx context.Context, username string) (*model.User, error) {
	query := `SELECT id, username, password_hash, phone, role, team_id, credit_score, status, created_at, updated_at
			  FROM users WHERE username = $1`

	u := &model.User{}
	var phone, teamID sql.NullString
	err := r.db.QueryRowContext(ctx, query, username).Scan(
		&u.ID, &u.Username, &u.PasswordHash, &phone, &u.Role, &teamID, &u.CreditScore,
		&u.Status, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	u.Phone = phone.String
	u.TeamID = teamID.String
	return u, nil
}

func (r *userPostgresRepo) UpdateCreditScore(ctx context.Context, id string, delta float64) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE users SET credit_score = GREATEST(0, credit_score + $1), updated_at = NOW() WHERE id = $2`,
		delta, id)
	return err
}

// ---- Helper functions ----

func nullString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nullFloat(f float64) interface{} {
	if f == 0 {
		return nil
	}
	return f
}
