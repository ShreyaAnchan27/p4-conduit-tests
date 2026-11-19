# Profile page and following an author

## Application Overview

Conduit profile page /profile/practice-author. Signed out, the page shows heading "practice-author", bio "I write about testing and quality.", tabs "My Articles" and "Favorited Articles", 7 articles, and no follow button. Signed in as practice-reader, a button named "Follow practice-author" or "Unfollow practice-author" appears. Observed: practice-reader already follows practice-author on fresh data (button starts as "Unfollow practice-author"). Scenarios assume that start state.

## Test Scenarios

### 1. Profile follow

**Seed:** `tests/seed.spec.ts`

#### 1.1. Signed-out visitor sees the profile without a follow button

**File:** `tests/profile-follow/signed-out-profile.spec.ts`

**Steps:**
  1. Without signing in, open /profile/practice-author.
    - expect: Heading "practice-author" is visible.
    - expect: Text "I write about testing and quality." is visible.
    - expect: Links "My Articles" and "Favorited Articles" are visible.
    - expect: Article heading "Your first end-to-end test" is visible.
    - expect: No button named "Follow practice-author" or "Unfollow practice-author" exists.
  2. Reload the page.
    - expect: Same result: still no follow or unfollow button.

#### 1.2. Signed-in reader unfollows and follows an author, and the state survives a reload

**File:** `tests/profile-follow/follow-author.spec.ts`

**Steps:**
  1. Sign in at /login with Email practice-reader@example.com and Password Practice123 (button "Sign in"), then open /profile/practice-author.
    - expect: Button "Unfollow practice-author" is visible (practice-reader already follows the author on fresh data).
    - expect: No button "Follow practice-author" is visible.
  2. Click button "Unfollow practice-author".
    - expect: The button is now named "Follow practice-author".
    - expect: No button "Unfollow practice-author" is visible.
  3. Reload the page.
    - expect: Button "Follow practice-author" is still visible (the unfollow was saved, not just shown).
  4. Click button "Follow practice-author".
    - expect: The button is now named "Unfollow practice-author".
  5. Reload the page.
    - expect: Button "Unfollow practice-author" is still visible; the author's heading and article list are unchanged. Finish with practice-reader following again, as at the start.
