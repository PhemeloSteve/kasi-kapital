#!/usr/bin/env bash
# Runs every SQL test against its OWN fresh throwaway database (stub + all migrations), so
# tests can never affect each other, then drops the database. Never touches your Supabase project.
#
# Needs a local PostgreSQL with PostGIS and a user that may create databases. Uses the standard
# PG* variables, e.g.:  PGHOST=localhost PGUSER=postgres ./supabase/tests/run_tests.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

DB=""
cleanup() { [ -n "$DB" ] && psql -d postgres -qc "drop database if exists ${DB}" >/dev/null 2>&1 || true; }
trap cleanup EXIT

fail=0
for test in supabase/tests/*_test.sql; do
  DB="kk_test_$$"
  psql -d postgres -qc "drop database if exists ${DB}" -c "create database ${DB}" >/dev/null 2>&1
  psql -d "${DB}" -v ON_ERROR_STOP=1 -q -f supabase/tests/stub_supabase.sql
  for migration in supabase/migrations/*.sql; do
    PGOPTIONS="-c search_path=public" psql -d "${DB}" -v ON_ERROR_STOP=1 -q -1 -f "$migration"
  done

  echo "== $(basename "$test") =="
  # The tests print PASS lines as notices and stop with an error on the first failure.
  if ! output=$(psql -d "${DB}" -q -f "$test" 2>&1); then fail=1; fi
  echo "$output" | grep -E "PASS|FAIL|ERROR" | sed -E 's/^psql:[^ ]+ (NOTICE:  )?//' || true
  cleanup
done
[ "$fail" -eq 0 ] && echo "ALL DATABASE TESTS PASSED" || { echo "DATABASE TESTS FAILED"; exit 1; }
