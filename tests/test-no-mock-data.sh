#!/bin/bash
# ============================================================
# Automated tests for Issue #2 — No mock data in GlobalContext
# Validates that all mock/hardcoded data has been removed
# and the app relies entirely on backend API
# ============================================================

API="http://localhost:3001/api"
FRONTEND_DIR="$(cd "$(dirname "$0")/../frontend/src" && pwd)"
PASS=0
FAIL=0
FAILURES=""

green()  { printf "\033[32m%s\033[0m\n" "$1"; }
red()    { printf "\033[31m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }

assert_pass() {
    local test_name="$1"
    green "  PASS: $test_name"
    PASS=$((PASS + 1))
}

assert_fail() {
    local test_name="$1" detail="$2"
    red "  FAIL: $test_name — $detail"
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n- ${test_name}: ${detail}"
}

echo ""
echo "============================================================"
echo "  Mock Data Removal Test Suite — Issue #2"
echo "  Frontend source: $FRONTEND_DIR"
echo "============================================================"
echo ""

# ─────────────────────────────────────────────────────────────
# 1. NO HARDCODED USER DATA IN COMPONENTS
# ─────────────────────────────────────────────────────────────
yellow "1. No hardcoded user data in components"

# 1.1 Sidebar must NOT have hardcoded user object
if grep -q "name: 'Eurico\|nome: 'Eurico\|initials: 'ES'" "$FRONTEND_DIR/components/Layout/Sidebar.tsx" 2>/dev/null; then
    assert_fail "Sidebar.tsx no hardcoded user" "Found hardcoded 'Eurico Sapalo' or initials"
else
    assert_pass "Sidebar.tsx no hardcoded user"
fi

# 1.2 Sidebar must import and use useGlobal
if grep -q "useGlobal" "$FRONTEND_DIR/components/Layout/Sidebar.tsx" 2>/dev/null; then
    assert_pass "Sidebar.tsx uses useGlobal()"
else
    assert_fail "Sidebar.tsx uses useGlobal()" "useGlobal not found"
fi

# 1.3 Sidebar must use currentUser from context
if grep -q "currentUser" "$FRONTEND_DIR/components/Layout/Sidebar.tsx" 2>/dev/null; then
    assert_pass "Sidebar.tsx uses currentUser from context"
else
    assert_fail "Sidebar.tsx uses currentUser from context" "currentUser not referenced"
fi

echo ""

# ─────────────────────────────────────────────────────────────
# 2. NO MOCK DATA IN GLOBALCONTEXT
# ─────────────────────────────────────────────────────────────
yellow "2. No mock/hardcoded data in GlobalContext.tsx"

GC="$FRONTEND_DIR/contexts/GlobalContext.tsx"

# 2.1 No hardcoded currentUser initial state
if grep -q "useState.*nome:.*email:.*role:" "$GC" 2>/dev/null; then
    assert_fail "No hardcoded currentUser initial state" "Found inline user object in useState"
else
    assert_pass "No hardcoded currentUser initial state"
fi

# 2.2 currentUser initialized as null
if grep -q "useState<CurrentUser | null>(null)" "$GC" 2>/dev/null; then
    assert_pass "currentUser initialized as null"
else
    assert_fail "currentUser initialized as null" "Expected useState<CurrentUser | null>(null)"
fi

# 2.3 No deprecated EMPRESA_INFO_EMPTY
if grep -q "EMPRESA_INFO_EMPTY" "$GC" 2>/dev/null; then
    assert_fail "No deprecated EMPRESA_INFO_EMPTY" "EMPRESA_INFO_EMPTY still present"
else
    assert_pass "No deprecated EMPRESA_INFO_EMPTY"
fi

# 2.4 Has clean EMPRESA_CONFIG_DEFAULT
if grep -q "EMPRESA_CONFIG_DEFAULT" "$GC" 2>/dev/null; then
    assert_pass "Uses clean EMPRESA_CONFIG_DEFAULT"
else
    assert_fail "Uses clean EMPRESA_CONFIG_DEFAULT" "EMPRESA_CONFIG_DEFAULT not found"
fi

# 2.5 No @deprecated annotations remaining
if grep -q "@deprecated" "$GC" 2>/dev/null; then
    assert_fail "No @deprecated annotations" "Found @deprecated in GlobalContext"
else
    assert_pass "No @deprecated annotations"
fi

# 2.6 All entity states initialized as empty arrays
ENTITIES=(
    "tiposTrabalho" "tiposDocumento" "tiposOT" "funcoesTecnico"
    "moedas" "paises" "provincias" "municipios"
    "clientes" "tecnicos" "fornecedores"
    "modelosEquipamento" "equipInstalados" "planos" "ordens"
    "armazens" "artigos" "taxasIva" "classesArtigo" "familiasArtigo"
    "documentosCompra" "condicoesPagamento" "modosPagamento"
    "faturasFornecedor" "stockArmazem" "movimentosStock"
    "encomendas" "faturas" "logs"
)

ALL_EMPTY=true
for entity in "${ENTITIES[@]}"; do
    # Check it's initialized with useState<...>([])
    if ! grep -q "\[${entity}," "$GC" 2>/dev/null || ! grep "${entity}," "$GC" | grep -q "\(\[\]\)" 2>/dev/null; then
        assert_fail "$entity initialized as empty array" "May have non-empty initial state"
        ALL_EMPTY=false
    fi
done
if [ "$ALL_EMPTY" = true ]; then
    assert_pass "All ${#ENTITIES[@]} entity states initialized as empty arrays []"
fi

# 2.7 taxaIvaGlobal initialized as 0
if grep -q "useState<number>(0)" "$GC" 2>/dev/null; then
    assert_pass "taxaIvaGlobal initialized as 0"
else
    assert_fail "taxaIvaGlobal initialized as 0" "Expected useState<number>(0)"
fi

echo ""

# ─────────────────────────────────────────────────────────────
# 3. NO RAW AXIOS IMPORTS (should use api service)
# ─────────────────────────────────────────────────────────────
yellow "3. No raw axios imports (all should use api service)"

RAW_AXIOS_FILES=$(grep -rl "import axios from 'axios'" "$FRONTEND_DIR" --include="*.tsx" --include="*.ts" | grep -v "services/api.ts" || true)

if [ -z "$RAW_AXIOS_FILES" ]; then
    assert_pass "No raw axios imports outside services/api.ts"
else
    for f in $RAW_AXIOS_FILES; do
        rel=$(echo "$f" | sed "s|$FRONTEND_DIR/||")
        assert_fail "No raw axios in $rel" "Still imports axios directly"
    done
fi

# 3.1 api.ts exists and has interceptor
if [ -f "$FRONTEND_DIR/services/api.ts" ]; then
    assert_pass "services/api.ts exists"
    if grep -q "interceptors.request" "$FRONTEND_DIR/services/api.ts"; then
        assert_pass "api.ts has request interceptor"
    else
        assert_fail "api.ts has request interceptor" "Missing interceptors.request"
    fi
    if grep -q "interceptors.response" "$FRONTEND_DIR/services/api.ts"; then
        assert_pass "api.ts has response interceptor"
    else
        assert_fail "api.ts has response interceptor" "Missing interceptors.response"
    fi
else
    assert_fail "services/api.ts exists" "File not found"
fi

echo ""

# ─────────────────────────────────────────────────────────────
# 4. DATA LOAD GUARDED BY AUTH
# ─────────────────────────────────────────────────────────────
yellow "4. Data loading guarded by authentication"

# 4.1 reloadData only runs when token exists
if grep -q "sgi_token.*reloadData\|token.*reloadData" "$GC" 2>/dev/null; then
    assert_pass "reloadData guarded by token check"
else
    assert_fail "reloadData guarded by token check" "reloadData may run without auth"
fi

# 4.2 Session restore from JWT on mount
if grep -q "auth/me" "$GC" 2>/dev/null; then
    assert_pass "Session restore via /auth/me on mount"
else
    assert_fail "Session restore via /auth/me on mount" "No /auth/me call found"
fi

# 4.3 Logout clears token
if grep -q "removeItem.*sgi_token" "$GC" 2>/dev/null; then
    assert_pass "Logout clears sgi_token from localStorage"
else
    assert_fail "Logout clears sgi_token from localStorage" "Token not cleared on logout"
fi

echo ""

# ─────────────────────────────────────────────────────────────
# 5. BACKEND API VERIFICATION — data comes from API
# ─────────────────────────────────────────────────────────────
yellow "5. Backend API serves real data (not hardcoded frontend)"

# Login first
TOKEN=$(curl -s -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@aquatex.ao","password":"aquatex2024"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    assert_fail "Backend login" "Could not obtain token"
else
    assert_pass "Backend login successful"

    AUTH="Authorization: Bearer $TOKEN"

    # 5.1 Configuracao loads from backend
    RESP=$(curl -s -w "\n%{http_code}" "$API/configuracao" -H "$AUTH")
    STATUS=$(echo "$RESP" | tail -1)
    BODY=$(echo "$RESP" | head -n -1)
    if [ "$STATUS" = "200" ]; then
        assert_pass "GET /configuracao returns 200"
        if echo "$BODY" | grep -q '"nome"'; then
            assert_pass "Configuracao has nome field from DB"
        else
            assert_fail "Configuracao has nome field from DB" "Missing nome in response"
        fi
    else
        assert_fail "GET /configuracao returns 200" "Got HTTP $STATUS"
    fi

    # 5.2 Key entity endpoints return arrays
    ENDPOINTS=("clientes" "tecnicos" "fornecedores" "ordens" "artigos" "armazens" "planos" "faturas" "logs")
    for ep in "${ENDPOINTS[@]}"; do
        RESP=$(curl -s -w "\n%{http_code}" "$API/$ep" -H "$AUTH")
        STATUS=$(echo "$RESP" | tail -1)
        if [ "$STATUS" = "200" ]; then
            assert_pass "GET /$ep returns 200 (data from API)"
        else
            assert_fail "GET /$ep returns 200" "Got HTTP $STATUS"
        fi
    done

    # 5.3 /auth/me returns real user (not mock)
    RESP=$(curl -s -X POST "$API/auth/me" -H "$AUTH")
    if echo "$RESP" | grep -q '"email":"admin@aquatex.ao"'; then
        assert_pass "/auth/me returns real user from DB"
    else
        assert_fail "/auth/me returns real user from DB" "Unexpected response"
    fi
fi

echo ""

# ─────────────────────────────────────────────────────────────
# 6. NO MOCK/HARDCODED PATTERNS ACROSS FRONTEND
# ─────────────────────────────────────────────────────────────
yellow "6. No mock/hardcoded patterns in frontend source"

# 6.1 No mock/dummy keywords in context or service files
MOCK_HITS=$(grep -rn "mock\|Mock\|MOCK\|dummy\|Dummy\|fictíc\|fake data\|sample data" \
    "$FRONTEND_DIR/contexts/" "$FRONTEND_DIR/services/" 2>/dev/null | grep -v "node_modules" || true)

if [ -z "$MOCK_HITS" ]; then
    assert_pass "No mock/dummy keywords in contexts/ and services/"
else
    assert_fail "No mock/dummy keywords" "Found: $(echo "$MOCK_HITS" | head -1)"
fi

# 6.2 No hardcoded user emails in components (except login placeholder)
HARDCODED_EMAILS=$(grep -rn "admin@aquatex\|tecnico@aquatex\|vendas@aquatex" \
    "$FRONTEND_DIR/components/" "$FRONTEND_DIR/contexts/" 2>/dev/null || true)

if [ -z "$HARDCODED_EMAILS" ]; then
    assert_pass "No hardcoded user emails in components/contexts"
else
    assert_fail "No hardcoded user emails" "Found: $(echo "$HARDCODED_EMAILS" | head -1)"
fi

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

exit $FAIL
