#!/bin/bash
# ============================================================
# Automated tests for JWT Authentication (Issue #1)
# Run against live Docker environment at localhost:3001
# ============================================================

API="http://localhost:3001/api"
PASS=0
FAIL=0
FAILURES=""

green()  { printf "\033[32m%s\033[0m\n" "$1"; }
red()    { printf "\033[31m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }

assert_status() {
    local test_name="$1" expected="$2" actual="$3"
    if [ "$expected" = "$actual" ]; then
        green "  PASS: $test_name (HTTP $actual)"
        PASS=$((PASS + 1))
    else
        red "  FAIL: $test_name (expected HTTP $expected, got HTTP $actual)"
        FAIL=$((FAIL + 1))
        FAILURES="${FAILURES}\n- ${test_name}: expected ${expected}, got ${actual}"
    fi
}

assert_contains() {
    local test_name="$1" body="$2" expected="$3"
    if echo "$body" | grep -q "$expected"; then
        green "  PASS: $test_name"
        PASS=$((PASS + 1))
    else
        red "  FAIL: $test_name (response does not contain '$expected')"
        FAIL=$((FAIL + 1))
        FAILURES="${FAILURES}\n- ${test_name}: response missing '${expected}'"
    fi
}

assert_not_contains() {
    local test_name="$1" body="$2" unexpected="$3"
    if echo "$body" | grep -q "$unexpected"; then
        red "  FAIL: $test_name (response should NOT contain '$unexpected')"
        FAIL=$((FAIL + 1))
        FAILURES="${FAILURES}\n- ${test_name}: response unexpectedly contains '${unexpected}'"
    else
        green "  PASS: $test_name"
        PASS=$((PASS + 1))
    fi
}

echo ""
echo "============================================================"
echo "  JWT Authentication Test Suite — Issue #1"
echo "  Target: $API"
echo "============================================================"
echo ""

# ─────────────────────────────────────────────────────────────
# 1. PUBLIC ROUTES (should work without token)
# ─────────────────────────────────────────────────────────────
yellow "1. Public Routes (no token required)"

# 1.1 Login with valid credentials
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@aquatex.ao","password":"aquatex2024"}')
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -1)
assert_status "POST /auth/login (valid credentials)" "200" "$STATUS"
assert_contains "Login returns access_token" "$BODY" "access_token"
assert_contains "Login returns user data" "$BODY" "admin@aquatex.ao"

# Extract admin token
ADMIN_TOKEN=$(echo "$BODY" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# 1.2 Login with invalid credentials
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@aquatex.ao","password":"wrongpassword"}')
assert_status "POST /auth/login (invalid password)" "401" "$STATUS"

# 1.3 Login with non-existent user
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"nonexistent@test.com","password":"test"}')
assert_status "POST /auth/login (non-existent user)" "401" "$STATUS"

# 1.4 Forgot password (public)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/forgot-password" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@aquatex.ao"}')
assert_status "POST /auth/forgot-password (public)" "200" "$STATUS"

# 1.5 Reset password with invalid token (public but should fail gracefully)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/reset-password" \
    -H "Content-Type: application/json" \
    -d '{"token":"INVALIDTOKEN","newPassword":"newpass123"}')
assert_status "POST /auth/reset-password (invalid token)" "400" "$STATUS"

echo ""

# ─────────────────────────────────────────────────────────────
# 2. PROTECTED ROUTES WITHOUT TOKEN (should return 401)
# ─────────────────────────────────────────────────────────────
yellow "2. Protected Routes WITHOUT token (expect 401)"

PROTECTED_ROUTES=(
    "GET /clientes"
    "GET /tecnicos"
    "GET /fornecedores"
    "GET /ordens"
    "GET /artigos"
    "GET /armazens"
    "GET /planos"
    "GET /faturas"
    "GET /compras"
    "GET /logs"
    "GET /configuracao"
    "GET /users"
    "GET /modelos-equipamento"
    "GET /equip-instalados"
)

for route in "${PROTECTED_ROUTES[@]}"; do
    METHOD=$(echo "$route" | cut -d' ' -f1)
    PATH_PART=$(echo "$route" | cut -d' ' -f2)
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X "$METHOD" "$API$PATH_PART")
    assert_status "$route without token" "401" "$STATUS"
done

echo ""

# ─────────────────────────────────────────────────────────────
# 3. PROTECTED ROUTES WITH VALID TOKEN (should return 200)
# ─────────────────────────────────────────────────────────────
yellow "3. Protected Routes WITH valid admin token (expect 200)"

AUTH_HEADER="Authorization: Bearer $ADMIN_TOKEN"

for route in "${PROTECTED_ROUTES[@]}"; do
    METHOD=$(echo "$route" | cut -d' ' -f1)
    PATH_PART=$(echo "$route" | cut -d' ' -f2)
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X "$METHOD" "$API$PATH_PART" -H "$AUTH_HEADER")
    assert_status "$route with admin token" "200" "$STATUS"
done

echo ""

# ─────────────────────────────────────────────────────────────
# 4. INVALID TOKEN (should return 401)
# ─────────────────────────────────────────────────────────────
yellow "4. Request with invalid/expired token (expect 401)"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/clientes" \
    -H "Authorization: Bearer invalidtoken123")
assert_status "GET /clientes with invalid token" "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/users" \
    -H "Authorization: Bearer invalidtoken123")
assert_status "GET /users with invalid token" "401" "$STATUS"

echo ""

# ─────────────────────────────────────────────────────────────
# 5. POST /auth/me — SESSION RESTORE
# ─────────────────────────────────────────────────────────────
yellow "5. Session restore via POST /auth/me"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/me" -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -1)
assert_status "POST /auth/me with valid token" "200" "$STATUS"
assert_contains "/auth/me returns user email" "$BODY" "admin@aquatex.ao"
assert_contains "/auth/me returns user role" "$BODY" "admin"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/me")
assert_status "POST /auth/me without token" "401" "$STATUS"

echo ""

# ─────────────────────────────────────────────────────────────
# 6. ROLE-BASED ACCESS CONTROL
# ─────────────────────────────────────────────────────────────
yellow "6. Role-Based Access Control (RBAC)"

# Login as tecnico (role: campo)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"tecnico@aquatex.ao","password":"aquatex2024"}')
BODY=$(echo "$RESP" | head -n -1)
TECNICO_TOKEN=$(echo "$BODY" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
TECNICO_HEADER="Authorization: Bearer $TECNICO_TOKEN"

# Tecnico should access regular routes
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/clientes" -H "$TECNICO_HEADER")
assert_status "GET /clientes with tecnico token" "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/ordens" -H "$TECNICO_HEADER")
assert_status "GET /ordens with tecnico token" "200" "$STATUS"

# Tecnico should NOT access admin-only routes (users management)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/users" -H "$TECNICO_HEADER")
assert_status "GET /users with tecnico token (expect 403)" "403" "$STATUS"

# Tecnico should NOT be able to update configuracao
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$API/configuracao" \
    -H "$TECNICO_HEADER" -H "Content-Type: application/json" \
    -d '{"nome":"Test"}')
assert_status "PUT /configuracao with tecnico token (expect 403)" "403" "$STATUS"

# Tecnico should NOT be able to delete logs
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/logs/999" -H "$TECNICO_HEADER")
assert_status "DELETE /logs/:id with tecnico token (expect 403)" "403" "$STATUS"

# Admin should access admin-only routes
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/users" -H "$AUTH_HEADER")
assert_status "GET /users with admin token (expect 200)" "200" "$STATUS"

# Login as vendedor
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"vendas@aquatex.ao","password":"aquatex2024"}')
BODY=$(echo "$RESP" | head -n -1)
VENDEDOR_TOKEN=$(echo "$BODY" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
VENDEDOR_HEADER="Authorization: Bearer $VENDEDOR_TOKEN"

# Vendedor should NOT access admin-only routes
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/users" -H "$VENDEDOR_HEADER")
assert_status "GET /users with vendedor token (expect 403)" "403" "$STATUS"

echo ""

# ─────────────────────────────────────────────────────────────
# 7. CHANGE PASSWORD (authenticated)
# ─────────────────────────────────────────────────────────────
yellow "7. Change Password (authenticated)"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/change-password" \
    -H "Content-Type: application/json")
assert_status "POST /auth/change-password without token" "401" "$STATUS"

echo ""

# ─────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────
echo "============================================================"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
    green "  ALL $TOTAL TESTS PASSED"
else
    red "  $FAIL/$TOTAL TESTS FAILED"
    echo ""
    red "  Failures:"
    printf "$FAILURES\n"
fi
echo "============================================================"
echo ""

# Exit with code for CI usage
exit $FAIL
