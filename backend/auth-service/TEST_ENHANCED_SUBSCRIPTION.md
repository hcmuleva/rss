# Testing Enhanced Subscription Endpoints

## Overview
The enhanced subscription endpoints integrate with:
- **Membership Service** (Port 4006) for automatic membership discounts
- **Rewards Service** (Port 4007) for points earning and redemption

---

## Enhanced Endpoints

### 1. Create Enhanced Subscription

**Endpoint**: `POST /api/subscriptions/enhanced`

**Features**:
- ✅ Automatic membership discount (5-20% based on tier)
- ✅ Coupon code support (stackable with membership)
- ✅ Points redemption (NOT stackable with coupon)
- ✅ Automatic points earning (10% of original price × tier multiplier)

**Request**:
```bash
curl -X POST http://localhost:4000/api/subscriptions/enhanced \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": 1,
    "payment_method": "online",
    "coupon_code": "WELCOME50",
    "points_to_redeem": 0
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Subscription created successfully",
  "data": {
    "subscription": {
      "id": 123,
      "service_id": 1,
      "service_name": "Family Tree",
      "status": "active",
      "payment_status": "completed"
    },
    "pricing": {
      "original_price": 299.00,
      "membership_discount": 44.85,
      "coupon_discount": 127.08,
      "points_discount": 0,
      "total_discount": 171.93,
      "final_amount": 127.07,
      "savings": 171.93
    },
    "rewards": {
      "points_redeemed": 0,
      "points_earned": 60,
      "net_points_change": 60
    }
  }
}
```

---

### 2. Example: Using Points Instead of Coupon

**Request**:
```bash
curl -X POST http://localhost:4000/api/subscriptions/enhanced \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": 1,
    "payment_method": "online",
    "points_to_redeem": 100
  }'
```

**Calculation Flow**:
```
Original Price:         ₹299.00
Membership Discount:    -₹44.85 (15% Gold tier)
After Membership:       ₹254.15
Points Redeemed:        -₹100.00 (100 points × ₹1)
─────────────────────────────────
Final Amount:           ₹154.15
Points Earned:          0 (no points when using points for payment)
```

---

### 3. Batch Enhanced Subscription

**Endpoint**: `POST /api/subscriptions/batch-enhanced`

**Request**:
```bash
curl -X POST http://localhost:4000/api/subscriptions/batch-enhanced \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service_ids": [1, 2, 3],
    "payment_method": "online",
    "coupon_code": "WELCOME50",
    "points_to_redeem": 0
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully subscribed to 3 service(s)",
  "data": {
    "subscriptions": [
      {
        "id": 123,
        "service_id": 1,
        "service_name": "Family Tree"
      },
      {
        "id": 124,
        "service_id": 2,
        "service_name": "Vanshavali"
      },
      {
        "id": 125,
        "service_id": 3,
        "service_name": "Temple Services"
      }
    ],
    "total_services": 3,
    "pricing": {
      "subtotal": 997.00,
      "membership_discount": 149.55,
      "coupon_discount": 423.73,
      "points_discount": 0,
      "total_discount": 573.28,
      "final_amount": 423.72,
      "total_savings": 573.28
    },
    "rewards": {
      "points_redeemed": 0,
      "points_earned": 100
    }
  }
}
```

---

### 4. Get Enhanced Subscriptions

**Endpoint**: `GET /api/subscriptions/my-enhanced`

**Request**:
```bash
curl http://localhost:4000/api/subscriptions/my-enhanced \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "subscriptions": [
      {
        "id": 123,
        "service_slug": "family-tree",
        "service_name": "Family Tree",
        "status": "active"
      }
    ],
    "total_subscriptions": 1,
    "membership": {
      "has_membership": true,
      "tier": "gold",
      "benefits": {
        "discount_percentage": 15,
        "point_multiplier": 2.0
      }
    },
    "points": {
      "current_balance": 560,
      "total_earned": 660,
      "total_redeemed": 100
    }
  }
}
```

---

## Discount Stacking Rules

### ✅ Allowed Combinations

| Membership | Coupon | Points | Result |
|------------|--------|--------|--------|
| ✅ Yes | ✅ Yes | ❌ No | **Stackable**: Membership + Coupon |
| ✅ Yes | ❌ No | ✅ Yes | **Stackable**: Membership + Points |
| ❌ No | ✅ Yes | ❌ No | **Allowed**: Coupon only |
| ❌ No | ❌ No | ✅ Yes | **Allowed**: Points only |

### ❌ Not Allowed

| Membership | Coupon | Points | Error |
|------------|--------|--------|-------|
| ✅ Yes | ✅ Yes | ✅ Yes | "Cannot use both coupon and points" |
| ❌ No | ✅ Yes | ✅ Yes | "Cannot use both coupon and points" |

---

## Points Earning Logic

### When Points Are Earned

**Scenario**: User subscribes to Family Tree (₹299) with Gold membership

```
Original Price: ₹299
Membership Discount (15%): -₹44.85
Coupon Discount (50%): -₹127.08
Final Payment: ₹127.07

Points Calculation:
- Base: ₹299 × 10% = 29.9 points
- Gold Multiplier (2x): 29.9 × 2 = 59.8
- Final: 60 points earned
```

**Key Rule**: Points are calculated on **original price**, not discounted price!

### When Points Are NOT Earned

If user redeems points for payment, they don't earn new points on that transaction.

```
Original Price: ₹299
Membership Discount (15%): -₹44.85
Points Redeemed (100): -₹100.00
Final Payment: ₹154.15

Points Earned: 0
(User already used points, so no new points awarded)
```

---

## Testing Checklist

### Basic Tests

- [ ] Subscribe with membership only
- [ ] Subscribe with coupon only  
- [ ] Subscribe with points only
- [ ] Subscribe with membership + coupon
- [ ] Subscribe with membership + points
- [ ] Attempt to use coupon + points (should fail)
- [ ] Subscribe without any discounts
- [ ] Batch subscribe with multiple services

### Edge Cases

- [ ] Redeem more points than available (should fail)
- [ ] Redeem more than 50% of amount (should fail)
- [ ] Use expired coupon (should fail)
- [ ] Subscribe to already subscribed service (should fail)
- [ ] Subscribe with invalid service_id (should fail)

### Integration Tests

- [ ] Verify membership discount is applied correctly
- [ ] Verify points are credited after subscription
- [ ] Verify points are deducted when redeemed
- [ ] Verify coupon usage is incremented
- [ ] Verify subscription is created in database

---

## Error Messages

### Coupon & Points Conflict
```json
{
  "success": false,
  "message": "Cannot use both coupon and points. Please choose one."
}
```

### Insufficient Points
```json
{
  "success": false,
  "message": "Insufficient points. Available: 50, Required: 100"
}
```

### Points Exceed Max Redemption
```json
{
  "success": false,
  "message": "Cannot redeem more than 149 points for this transaction (max 50% of amount)"
}
```

### Already Subscribed
```json
{
  "success": false,
  "message": "Already subscribed to this service"
}
```

---

## Backward Compatibility

The original endpoints are still available:

- `POST /api/subscriptions` - Original subscription (no membership/points)
- `POST /api/subscriptions/batch` - Original batch (no membership/points)
- `GET /api/subscriptions/my` - Original list (no membership/points info)

Use enhanced endpoints for new features!

---

**Updated**: April 13, 2026  
**Status**: ✅ Ready for Testing
