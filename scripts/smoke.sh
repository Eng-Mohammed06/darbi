#!/usr/bin/env bash
# End-to-end API smoke test. Assumes the server is already running.
#   npm start &   (or npm run dev:api)
#   bash scripts/smoke.sh
set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
PASS=0
FAIL=0

check() { # check <label> <actual> <expected>
  if [ "$2" = "$3" ]; then
    printf '  ok    %-46s %s\n' "$1" "$2"; PASS=$((PASS + 1))
  else
    printf '  FAIL  %-46s got %s want %s\n' "$1" "$2" "$3"; FAIL=$((FAIL + 1))
  fi
}

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
json() { curl -s "$@"; }

echo "== public =="
check "GET /api/health"            "$(code "$BASE/api/health")" 200
check "GET /api/majors"            "$(code "$BASE/api/majors")" 200
check "GET /api/jobs"              "$(code "$BASE/api/jobs")" 200

echo "== auth =="
check "login demo student"         "$(code -X POST "$BASE/api/auth/login" -H 'content-type: application/json' -d '{"email":"student@darbi.jo","password":"darbi2026"}')" 200
check "login wrong password"       "$(code -X POST "$BASE/api/auth/login" -H 'content-type: application/json' -d '{"email":"student@darbi.jo","password":"nope"}')" 401
check "login unknown email"        "$(code -X POST "$BASE/api/auth/login" -H 'content-type: application/json' -d '{"email":"ghost@darbi.jo","password":"nope"}')" 401
check "signup duplicate email"     "$(code -X POST "$BASE/api/auth/signup" -H 'content-type: application/json' -d '{"email":"student@darbi.jo","password":"secret123","role":"student","name":"Dup"}')" 409
check "signup weak password"       "$(code -X POST "$BASE/api/auth/signup" -H 'content-type: application/json' -d '{"email":"weak@darbi.jo","password":"12345","role":"student","name":"Weak"}')" 400
check "signup bad role"            "$(code -X POST "$BASE/api/auth/signup" -H 'content-type: application/json' -d '{"email":"badrole@darbi.jo","password":"secret123","role":"admin","name":"X"}')" 400

STUDENT_TOKEN=$(json -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
  -d '{"email":"student@darbi.jo","password":"darbi2026"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
COMPANY_TOKEN=$(json -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
  -d '{"email":"company@darbi.jo","password":"darbi2026"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")

echo "== token handling =="
check "GET /me no token"           "$(code "$BASE/api/auth/me")" 401
check "GET /me bad token"          "$(code "$BASE/api/auth/me" -H 'authorization: Bearer garbage')" 401
check "GET /me valid token"        "$(code "$BASE/api/auth/me" -H "authorization: Bearer $STUDENT_TOKEN")" 200

echo "== role gates =="
check "student -> student route"   "$(code "$BASE/api/students/me" -H "authorization: Bearer $STUDENT_TOKEN")" 200
check "company -> student route"   "$(code "$BASE/api/students/me" -H "authorization: Bearer $COMPANY_TOKEN")" 403
check "company -> company route"   "$(code "$BASE/api/companies/me/jobs" -H "authorization: Bearer $COMPANY_TOKEN")" 200
check "student -> company route"   "$(code "$BASE/api/companies/me/jobs" -H "authorization: Bearer $STUDENT_TOKEN")" 403

echo "== student portal =="
check "PUT profile"                "$(code -X PUT "$BASE/api/students/me" -H "authorization: Bearer $STUDENT_TOKEN" -H 'content-type: application/json' -d '{"interests":["Software","Cybersecurity"],"gpa":3.6}')" 200
check "PUT profile bad gpa"        "$(code -X PUT "$BASE/api/students/me" -H "authorization: Bearer $STUDENT_TOKEN" -H 'content-type: application/json' -d '{"gpa":9}')" 400
check "POST saved-major"           "$(code -X POST "$BASE/api/students/me/saved-majors" -H "authorization: Bearer $STUDENT_TOKEN" -H 'content-type: application/json' -d '{"majorId":1}')" 201
check "POST saved-major unknown"   "$(code -X POST "$BASE/api/students/me/saved-majors" -H "authorization: Bearer $STUDENT_TOKEN" -H 'content-type: application/json' -d '{"majorId":9999}')" 404
check "GET saved-majors"           "$(code "$BASE/api/students/me/saved-majors" -H "authorization: Bearer $STUDENT_TOKEN")" 200

echo "== company portal =="
# Capture the id so the run can delete it again — otherwise every smoke run
# leaves a fake listing on the board and inflates the pathway demand counts.
SMOKE_JOB=$(json -X POST "$BASE/api/companies/me/jobs" -H "authorization: Bearer $COMPANY_TOKEN" -H 'content-type: application/json' \
  -d '{"title":"Smoke Test Engineer","requiredMajors":["Computer Science"],"minGpa":3.0,"requiredSkills":["SQL"]}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).id)}catch{console.log('')}})")
check "POST job"                   "$([ -n "$SMOKE_JOB" ] && echo 201 || echo fail)" 201
check "POST job no title"          "$(code -X POST "$BASE/api/companies/me/jobs" -H "authorization: Bearer $COMPANY_TOKEN" -H 'content-type: application/json' -d '{"minGpa":3.0}')" 400
check "GET student pool"           "$(code "$BASE/api/companies/students?minGpa=3.0" -H "authorization: Bearer $COMPANY_TOKEN")" 200

echo "== recommendations =="
check "POST /api/recommend"        "$(code -X POST "$BASE/api/recommend" -H "authorization: Bearer $STUDENT_TOKEN")" 200
check "POST /api/recommend (auth)" "$(code -X POST "$BASE/api/recommend")" 401
check "company -> recommend"       "$(code -X POST "$BASE/api/recommend" -H "authorization: Bearer $COMPANY_TOKEN")" 403

echo "== cleanup =="
if [ -n "${SMOKE_JOB:-}" ]; then
  check "DELETE smoke job" "$(code -X DELETE "$BASE/api/companies/me/jobs/$SMOKE_JOB" -H "authorization: Bearer $COMPANY_TOKEN")" 204
fi
check "saved-major removed"        "$(code -X DELETE "$BASE/api/students/me/saved-majors/1" -H "authorization: Bearer $STUDENT_TOKEN")" 204

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
