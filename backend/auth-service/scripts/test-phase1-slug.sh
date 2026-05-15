#!/bin/bash

# =====================================================================
# Phase 1 Testing Script - Slug ID Migration
# Company: emeelan
# =====================================================================

BASE_URL="http://localhost:4000"

echo "🧪 Phase 1: Slug ID Migration - Testing"
echo "========================================"
echo ""

# Test 1: Generate missing slugs
echo "📝 Test 1: Generate Missing Slugs"
echo "-----------------------------------"
node scripts/generate-missing-slugs.js
echo ""

# Test 2: Register new user (should get slug automatically)
echo "📝 Test 2: Register New User (Auto Slug Generation)"
echo "----------------------------------------------------"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "TestSlug",
    "fatherName": "TestFather",
    "dob": "1990-01-01",
    "gotra": "Pawar",
    "gender": "M",
    "email": "testslug@example.com",
    "password": "password123"
  }')

echo "$REGISTER_RESPONSE" | jq '.'

# Extract slug from response
SLUG=$(echo "$REGISTER_RESPONSE" | jq -r '.data.user.slug')
echo "✅ Generated Slug: $SLUG"
echo ""

# Test 3: Login and check JWT contains slug
echo "📝 Test 3: Login & Verify JWT Contains Slug"
echo "--------------------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testslug@example.com",
    "password": "password123"
  }')

echo "$LOGIN_RESPONSE" | jq '.'

# Extract and decode JWT
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.tokens.accessToken')
echo ""
echo "🔍 Decoding JWT Payload:"
echo "$ACCESS_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '.'
echo ""

# Test 4: Lookup user by slug
echo "📝 Test 4: Lookup User by Slug"
echo "-------------------------------"
SLUG_LOOKUP=$(curl -s "$BASE_URL/api/profile/by-slug/$SLUG")
echo "$SLUG_LOOKUP" | jq '.'
echo ""

# Test 5: Verify slug in /api/auth/me
echo "📝 Test 5: Verify Slug in /api/auth/me"
echo "---------------------------------------"
ME_RESPONSE=$(curl -s "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "$ME_RESPONSE" | jq '.'
echo ""

# Summary
echo "========================================"
echo "✅ Phase 1 Testing Complete!"
echo "========================================"
echo ""
echo "Tested:"
echo "  ✅ Slug generation for existing users"
echo "  ✅ Auto slug on registration"
echo "  ✅ Slug in JWT payload"
echo "  ✅ Slug lookup endpoint"
echo "  ✅ Slug in /me endpoint"
echo ""
echo "Next Steps:"
echo "  1. Verify all tests passed"
echo "  2. Check database for slug column"
echo "  3. Proceed to Phase 2 (Dual-Key Support)"
